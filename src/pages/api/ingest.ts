/* eslint-disable @typescript-eslint/no-explicit-any */
// src/pages/api/ingest.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseServer } from '@/lib/supabaseServerClient';

// simple fetch with retry
const fetchWithRetry = async (url: string, retries = 3) => {
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 1. Determine date
    const dateParam = typeof req.query.date === 'string' ? req.query.date : null;
    const today = new Date().toISOString().slice(0, 10);
    const gameDate = dateParam || today;
    console.log(`Ingest triggered for date: ${gameDate}`);

    // 2. Fetch schedule + probables
    const sched = await fetchWithRetry(
      `https://statsapi.mlb.com/api/v1/schedule?date=${gameDate}&sportId=1&hydrate=probablePitcher`
    );
    const games = sched.dates?.[0]?.games || [];
    console.log(`Fetched schedule: ${games.length} games found`);
    if (!games.length) {
      console.log('No games today, exiting ingest early');
      return res.status(200).json({ success: true, count: 0 });
    }

    // 3. Build roster cache
    const teamIds: number[] = Array.from(
      new Set(games.flatMap((g: any) => [g.teams.home.team.id, g.teams.away.team.id]))
    );
    console.log(`Teams to fetch rosters for: ${teamIds.join(', ')}`);
    const rosters: Record<number, any[]> = {};
    await Promise.all(
      teamIds.map(async (tid: number) => {
        const j = await fetchWithRetry(
          `https://statsapi.mlb.com/api/v1/teams/${tid}/roster?rosterType=active&sportId=1`
        );
        rosters[tid] = j.roster;
        console.log(`Roster for team ${tid}: ${j.roster.length} players`);
      })
    );

    // 4. Gather lookup pairs and unique IDs
    const lookupPairs: Array<{ pit: number; bat: number; batName: string; pitName: string }> = [];
    const playerIds = new Set<number>();
    for (const g of games) {
      const homePid = g.probablePitchers?.home?.id;
      const awayPid = g.probablePitchers?.away?.id;
      if (!homePid || !awayPid) continue;

      rosters[g.teams.home.team.id]?.forEach((p) => {
        playerIds.add(p.person.id);
        playerIds.add(awayPid);
        lookupPairs.push({
          pit: awayPid,
          bat: p.person.id,
          batName: p.person.fullName,
          pitName: g.probablePitchers.away.fullName,
        });
      });
      rosters[g.teams.away.team.id]?.forEach((p) => {
        playerIds.add(p.person.id);
        playerIds.add(homePid);
        lookupPairs.push({
          pit: homePid,
          bat: p.person.id,
          batName: p.person.fullName,
          pitName: g.probablePitchers.home.fullName,
        });
      });
    }
    const uniquePlayerIds = Array.from(playerIds);
    console.log(`Lookup pairs built: ${lookupPairs.length} total`);
    console.log(`Unique player IDs to fetch splits & handedness: ${uniquePlayerIds.length}`);

    // 5. Batch‐fetch splits
    const { data: allSplits } = await supabaseServer
      .from('player_splits')
      .select('player_id, player_type, vs_handedness, xwoba')
      .in('player_id', uniquePlayerIds);
    console.log(`Fetched splits: ${allSplits?.length ?? 0} records`);
    const splitMap = new Map<string, number>();
    (allSplits || []).forEach((s: any) => {
      splitMap.set(`${s.player_type}:${s.player_id}|${s.vs_handedness}`, s.xwoba);
    });

    // 6. Batch‐fetch handedness
    const batMap = new Map<number, string>();
    const pitMap = new Map<number, string>();
    if (uniquePlayerIds.length > 0) {
      const persons = await fetchWithRetry(
        `https://statsapi.mlb.com/api/v1/people?personIds=${uniquePlayerIds.join(',')}`
      );
      console.log(`Fetched player details: ${persons.people?.length ?? 0}`);
      (persons.people || []).forEach((p: any) => {
        if (p.batSide?.code) batMap.set(p.id, p.batSide.code);
        if (p.pitchHand?.code) pitMap.set(p.id, p.pitchHand.code);
      });
      console.log(`BatMap entries: ${batMap.size}, PitMap entries: ${pitMap.size}`);
    } else {
      console.warn('No player IDs to fetch handedness for, skipping people lookup');
    }

    // 7. Build upserts
    const upserts = lookupPairs.reduce<any[]>((acc, { pit, bat, batName, pitName }) => {
      const batSide = batMap.get(bat);
      const pitSide = pitMap.get(pit);
      if (!batSide || !pitSide) return acc;

      const pitXw = splitMap.get(`pitcher:${pit}|${batSide}`);
      const batXw = splitMap.get(`batter:${bat}|${pitSide}`);
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
    console.log(`Prepared ${upserts.length} matchup records to upsert`);

    // 8. Upsert
    if (upserts.length) {
      const { error: upsertError } = await supabaseServer
        .from('daily_matchups')
        .upsert(upserts);
      if (upsertError) {
        console.error('Upsert error:', upsertError);
        throw upsertError;
      }
      console.log('Upsert completed successfully');
    }

    return res.status(200).json({ success: true, count: upserts.length });
  } catch (err: any) {
    console.error('Ingest error:', err);
    return res.status(500).json({ error: err.message });
  }
}
