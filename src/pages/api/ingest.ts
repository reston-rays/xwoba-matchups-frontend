/* eslint-disable @typescript-eslint/no-explicit-any */
// src/pages/api/ingest.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseServer } from '@/lib/supabaseServerClient';

// simple fetch with retry, now declared to return any
const fetchWithRetry = async (url: string, retries = 3): Promise<any> => {
  for (let i = 1; i <= retries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      console.log(`Fetch success: ${url}`);
      return res.json();
    } catch (err) {
      console.error(`Fetch ${url} (attempt ${i}) failed:`, err);
      if (i === retries) throw err;
    }
  }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any>
) {
  const logs: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    logs.push(msg);
  };

  try {
    // 1. Determine date
    const dateParam = typeof req.query.date === 'string' ? req.query.date : null;
    const today = new Date().toISOString().slice(0, 10);
    const gameDate = dateParam || today;
    log(`🗓️ Ingest date: ${gameDate}`);

    // 2. Fetch schedule + probables (singular)
    const sched: any = await fetchWithRetry(
      `https://statsapi.mlb.com/api/v1/schedule` +
      `?date=${gameDate}&sportId=1&hydrate=probablePitcher`
    );
    const games: any[] = sched.dates?.[0]?.games || [];
    if (!games.length) {
      log(`⏭️ No games found for ${gameDate}`);
      return res.status(200).json({ success: true, count: 0, logs });
    }
    log(`🏟️ Fetched schedule: ${games.length} games`);
    log(`Sample game object:\n${JSON.stringify(games[0], null, 2)}`);

    // Helper: get starter with fallback
    async function getStarter(
      game: any,
      side: 'home' | 'away'
    ): Promise<{ id: number; fullName: string } | null> {
      // 1. Try the hydrated data under game.teams[side].probablePitcher
      const info = (game.teams?.[side]?.probablePitcher) as any;
      if (info?.id) {
        log(`✅ Hydrated ${side} starter: ${info.fullName} (${info.id})`);
        return info;
      }

      // 2. Fallback to the live‐feed if needed
      const feed: any = await fetchWithRetry(
        `https://statsapi.mlb.com/api/v1.1/game/${game.gamePk}/feed/live`
      );
      const pList: number[] = feed.liveData?.boxscore?.teams?.[side]?.pitchers || [];
      if (pList.length) {
        const pid = pList[0];
        const person = (feed.gameData?.players as any)?.[`ID${pid}`] as any;
        const fullName = person?.fullName || `<unknown ${pid}>`;
        log(`🔄 Fallback ${side} starter: ${fullName} (${pid})`);
        return { id: pid, fullName };
      }

      log(`⚠️ No ${side} starter for game ${game.gamePk}`);
      return null;
    }

    // 3. Build roster cache
    const teamIds = Array.from(
      new Set(games.flatMap(g => [g.teams.home.team.id, g.teams.away.team.id]))
    );
    log(`📋 Teams: ${teamIds.join(', ')}`);
    const rosters: Record<number, any[]> = {};
    await Promise.all(
      teamIds.map(async (tid: number) => {
        const j: any = await fetchWithRetry(
          `https://statsapi.mlb.com/api/v1/teams/${tid}/roster` +
          `?rosterType=active&sportId=1`
        );
        rosters[tid] = j.roster;
        log(`👥 Roster[${tid}]: ${j.roster.length} players`);
      })
    );

    // 4. Gather lookup pairs & player IDs
    const lookupPairs: Array<{ pit: number; bat: number; batName: string; pitName: string }> = [];
    const playerIds = new Set<number>();

    for (const g of games) {
      const homeStarter = await getStarter(g, 'home');
      const awayStarter = await getStarter(g, 'away');
      if (!homeStarter || !awayStarter) {
        log(`⏭️ Skipping game ${g.gamePk}`);
        continue;
      }

      // Home lineup vs away starter
      rosters[g.teams.home.team.id]?.forEach((p: any) => {
        playerIds.add(p.person.id);
        playerIds.add(awayStarter.id);
        lookupPairs.push({
          bat: p.person.id,
          pit: awayStarter.id,
          batName: p.person.fullName,
          pitName: awayStarter.fullName,
        });
      });

      // Away lineup vs home starter
      rosters[g.teams.away.team.id]?.forEach((p: any) => {
        playerIds.add(p.person.id);
        playerIds.add(homeStarter.id);
        lookupPairs.push({
          bat: p.person.id,
          pit: homeStarter.id,
          batName: p.person.fullName,
          pitName: homeStarter.fullName,
        });
      });
    }

    const uniquePlayerIds = Array.from(playerIds);
    log(`🔢 Lookup pairs: ${lookupPairs.length}`);
    log(`🆔 Unique player IDs: ${uniquePlayerIds.length}`);

    // 5. Batch-fetch splits
    const { data: allSplits }: any = await supabaseServer
      .from('player_splits')
      .select('player_id,player_type,vs_handedness,xwoba')
      .in('player_id', uniquePlayerIds);
    log(`📊 Splits fetched: ${allSplits?.length ?? 0}`);

    // 6. Batch-fetch handedness
    const batMap = new Map<number, string>();
    const pitMap = new Map<number, string>();
    if (uniquePlayerIds.length) {
      const persons: any = await fetchWithRetry(
        `https://statsapi.mlb.com/api/v1/people?personIds=${uniquePlayerIds.join(',')}`
      );
      log(`👤 Player details: ${persons.people?.length ?? 0}`);
      (persons.people || []).forEach((p: any) => {
        if (p.batSide?.code) batMap.set(p.id, p.batSide.code);
        if (p.pitchHand?.code) pitMap.set(p.id, p.pitchHand.code);
      });
      log(`🗺️ BatMap: ${batMap.size}, PitMap: ${pitMap.size}`);
    } else {
      log(`⚠️ No player IDs—skipping handedness lookup`);
    }

    // 7. Build upserts
    const upserts = lookupPairs.reduce<any[]>((acc, { pit, bat, batName, pitName }) => {
      const batSide = batMap.get(bat);
      const pitSide = pitMap.get(pit);
      if (!batSide || !pitSide) return acc;

      const pitXw = allSplits?.find((s: any) =>
        s.player_type === 'pitcher' && s.player_id === pit && s.vs_handedness === batSide
      )?.xwoba;
      const batXw = allSplits?.find((s: any) =>
        s.player_type === 'batter' && s.player_id === bat && s.vs_handedness === pitSide
      )?.xwoba;

      if (pitXw != null && batXw != null) {
        acc.push({
          game_date: gameDate,
          batter_id: bat,
          pitcher_id: pit,
          avg_xwoba: (pitXw + batXw) / 2,
          batter_name: batName,
          pitcher_name: pitName,
        });
      }
      return acc;
    }, []);

    log(`💾 Prepared ${upserts.length} records to upsert`);

    // 8. Upsert into Supabase
    if (upserts.length) {
      const { error: upsertError } = await supabaseServer
        .from('daily_matchups')
        .upsert(upserts);
      if (upsertError) {
        log(`❌ Upsert error: ${upsertError.message}`);
        throw upsertError;
      }
      log(`✅ Upsert successful`);
    }

    const result: any = { success: true, count: upserts.length };
    if (req.query.debug === 'true') result.logs = logs;
    return res.status(200).json(result);
  } catch (err: any) {
    console.error('Ingest error:', err);
    return res.status(500).json({
      error: err.message,
      logs: ['Error: ' + err.message],
    });
  }
}
