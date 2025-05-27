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
    // For CLI, req will be undefined. For API, req.query will be used.
    const dateQueryParam = req?.query?.date; // Use optional chaining
    const dateParam = typeof dateQueryParam === 'string' ? dateQueryParam : null;

    const today = new Date();
    // Optional: Adjust for a specific timezone if MLB API is sensitive, e.g., for "today" in US time
    // today.setHours(today.getHours() - 8); // Example: Roughly shift to Pacific Time for "today"
    const gameDate = dateParam || today.toISOString().slice(0, 10);
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
    ).filter(id => id != null); // Ensure no null team IDs
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

    // 4. Fetch boxscores to get batting orders and then gather lookup pairs & player IDs
    const lookupPairs: Array<{ pit: number; bat: number; batName: string; pitName: string; lineupPosition: number | null }> = [];
    const playerIds = new Set<number>();
    // Store batting orders: Map<gamePk_teamId, playerId[]>
    // Example key: "712345_119" -> [playerId1, playerId2, ...]
    const gameTeamBattingOrders = new Map<string, number[]>();

    for (const g of games) {
      const homeStarter = await getStarter(g, 'home');
      const awayStarter = await getStarter(g, 'away');
      if (!homeStarter || !awayStarter) {
        log(`⏭️ Skipping game ${g.gamePk}`);
        continue;
      }

      // Fetch boxscore for batting orders
      try {
        const boxscoreUrl = `https://statsapi.mlb.com/api/v1/game/${g.gamePk}/boxscore`;
        const boxscoreData: any = await fetchWithRetry(boxscoreUrl);

        const homeTeamId = g.teams.home.team.id;
        const awayTeamId = g.teams.away.team.id;

        const homeBattingOrder = boxscoreData?.teams?.home?.battingOrder;
        if (homeBattingOrder && Array.isArray(homeBattingOrder) && homeBattingOrder.length > 0) {
          gameTeamBattingOrders.set(`${g.gamePk}_${homeTeamId}`, homeBattingOrder);
          log(`⚾️ Home batting order for game ${g.gamePk} (Team ${homeTeamId}): ${homeBattingOrder.length} players`);
        } else {
          log(`⚠️ No home batting order found in boxscore for game ${g.gamePk} (Team ${homeTeamId}). Will use full roster.`);
        }

        const awayBattingOrder = boxscoreData?.teams?.away?.battingOrder;
        if (awayBattingOrder && Array.isArray(awayBattingOrder) && awayBattingOrder.length > 0) {
          gameTeamBattingOrders.set(`${g.gamePk}_${awayTeamId}`, awayBattingOrder);
          log(`⚾️ Away batting order for game ${g.gamePk} (Team ${awayTeamId}): ${awayBattingOrder.length} players`);
        } else {
          log(`⚠️ No away batting order found in boxscore for game ${g.gamePk} (Team ${awayTeamId}). Will use full roster.`);
        }
      } catch (boxscoreError) {
        log(`❌ Error fetching boxscore for game ${g.gamePk}: ${boxscoreError instanceof Error ? boxscoreError.message : String(boxscoreError)}. Proceeding with full rosters.`);
      }

      const processTeamLineup = (
        teamType: 'home' | 'away',
        opponentStarter: { id: number; fullName: string }
      ) => {
        const teamData = g.teams[teamType];
        const teamId = teamData.team.id;
        const battingOrderPlayerIds = gameTeamBattingOrders.get(`${g.gamePk}_${teamId}`);
        
        // Use batting order if available, otherwise fall back to the fetched active roster
        const playersToProcess = battingOrderPlayerIds
          ? battingOrderPlayerIds.map(playerId => rosters[teamId]?.find(p => p.person.id === playerId)).filter(p => p) // Find full player object from roster
          : rosters[teamId];

        playersToProcess?.forEach((p: any, index: number) => {
          if (!p || !p.person || !p.person.id) return; // Skip if player data is incomplete

          playerIds.add(p.person.id);
          playerIds.add(opponentStarter.id);
          
          // Lineup position is 1-indexed if from battingOrder, null otherwise
          const lineupPosition = battingOrderPlayerIds ? index + 1 : null;

          lookupPairs.push({
            bat: p.person.id,
            pit: opponentStarter.id,
            batName: p.person.fullName,
            pitName: opponentStarter.fullName,
            lineupPosition: lineupPosition,
          });
        });
      };

      processTeamLineup('home', awayStarter);
      processTeamLineup('away', homeStarter);

      log(`🔍 Processed game ${g.gamePk}: ${lookupPairs.length} matchups found`);
    }

    const uniquePlayerIds = Array.from(playerIds);
    log(`🔢 Lookup pairs: ${lookupPairs.length}`);
    log(`🆔 Unique player IDs: ${uniquePlayerIds.length}`);

    // 5. Batch-fetch splits
    const { data: allSplits }: any = await supabaseServer
      .from('player_splits')
      .select('player_id, season, player_type,vs_handedness,xwoba,avg_launch_angle,barrels_per_pa,hard_hit_pct,avg_exit_velocity')
      .eq('season', 0) // Fetch only weighted average data (season 0)
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
    const upserts = lookupPairs.reduce<any[]>((acc, { pit, bat, batName, pitName, lineupPosition }) => {
      const batSide = batMap.get(bat);
      const pitSide = pitMap.get(pit);
      if (!batSide || !pitSide) return acc;

      const pitcherSplitData = allSplits?.find((s: any) =>
        s.player_type === 'pitcher' && s.player_id === pit && s.vs_handedness === batSide
      );
      const batterSplitData = allSplits?.find((s: any) =>
        s.player_type === 'batter' && s.player_id === bat && s.vs_handedness === pitSide
      );

      if (
        pitcherSplitData && batterSplitData &&
        pitcherSplitData.xwoba != null && batterSplitData.xwoba != null &&
        pitcherSplitData.avg_launch_angle != null && batterSplitData.avg_launch_angle != null &&
        pitcherSplitData.barrels_per_pa != null && batterSplitData.barrels_per_pa != null &&
        pitcherSplitData.hard_hit_pct != null && batterSplitData.hard_hit_pct != null &&
        pitcherSplitData.avg_exit_velocity != null && batterSplitData.avg_exit_velocity != null
      ) {
        acc.push({
          game_date: gameDate,
          batter_id: bat,
          pitcher_id: pit,
          batter_name: batName,
          pitcher_name: pitName,
          lineup_position: lineupPosition,
          // Calculate averages for all required stats
          avg_xwoba: (pitcherSplitData.xwoba + batterSplitData.xwoba) / 2,
          avg_launch_angle: (pitcherSplitData.avg_launch_angle + batterSplitData.avg_launch_angle) / 2,
          avg_barrels_per_pa: (pitcherSplitData.barrels_per_pa + batterSplitData.barrels_per_pa) / 2,
          avg_hard_hit_pct: (pitcherSplitData.hard_hit_pct + batterSplitData.hard_hit_pct) / 2,
          avg_exit_velocity: (pitcherSplitData.avg_exit_velocity + batterSplitData.avg_exit_velocity) / 2,
        });
      } else {
        // Log if a matchup is skipped due to missing data, which would violate NOT NULL constraints
        // This helps in debugging data issues in player_splits
        log(`⚠️ Skipping matchup Bat:${bat}(${batName}) vs Pit:${pit}(${pitName}) due to missing one or more required player_split stats.`);
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
