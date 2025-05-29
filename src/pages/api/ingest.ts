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

    // 3.5 Fetch team details for abbreviations
    const teamAbbrMap = new Map<number, string>();
    if (teamIds.length > 0) {
      log(`ℹ️ Fetching team details for ${teamIds.length} teams to get abbreviations...`);
      await Promise.all(
        teamIds.map(async (tid: number) => {
          try {
            const teamDetails: any = await fetchWithRetry(`https://statsapi.mlb.com/api/v1/teams/${tid}`);
            if (teamDetails?.teams?.[0]?.abbreviation) {
              teamAbbrMap.set(tid, teamDetails.teams[0].abbreviation);
              log(`🏷️ Team Abbr [${tid}]: ${teamDetails.teams[0].abbreviation}`);
            }
          } catch (err) {
            log(`⚠️ Error fetching team details for ID ${tid}: ${err instanceof Error ? err.message : String(err)}`);
          }
        })
      );
    }

    // 4. Fetch boxscores to get batting orders and then gather lookup pairs & player IDs
    type LookupPair = {
      gamePk: string | number;
      homeTeamId: number;
      awayTeamId: number;
      homeTeamAbbr: string | null;
      awayTeamAbbr: string | null;
      pit: number;
      bat: number;
      batName: string;
      pitName: string;
      lineupPosition: number | null;
      batterTeam: string | null;
      pitcherTeam: string | null;
    };
    const lookupPairs: LookupPair[] = [];
    const playerIds = new Set<number>();
    // Store batting orders: Map<gamePk_teamId, playerId[]>
    // Example key: "712345_119" -> [playerId1, playerId2, ...]
    const gameTeamBattingOrders = new Map<string, number[]>();

    // Helper to get abbreviation or fallback to name
    const getTeamIdentifier = (teamId: number, fallbackName?: string | null): string | null => {
      return teamAbbrMap.get(teamId) || fallbackName || null;
    };

    for (const g of games) {
      const homeStarter = await getStarter(g, 'home');
      const awayStarter = await getStarter(g, 'away');

      if (!homeStarter && !awayStarter) {
        log(`⏭️ Skipping game ${g.gamePk} - NEITHER probable pitcher is known.`);
        continue;
      }

      const gameHomeTeamId = g.teams.home.team.id;
      const gameAwayTeamId = g.teams.away.team.id;
      const actualGameHomeAbbr = getTeamIdentifier(gameHomeTeamId, g.teams.home.team.name);
      const actualGameAwayAbbr = getTeamIdentifier(gameAwayTeamId, g.teams.away.team.name);

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
        opponentStarter: { id: number; fullName: string },
        gameData: any,
        gameHomeTeamIdParam: number,
        gameAwayTeamIdParam: number,
        actualGameHomeAbbrParam: string | null,
        actualGameAwayAbbrParam: string | null
      ) => {
        const teamData = gameData.teams[teamType];
        const teamId = teamData.team.id;
        const batterTeamIdentifier = getTeamIdentifier(teamId, teamData.team.name);
        
        const opponentTeamId = (teamType === 'home' ? gameData.teams.away.team.id : gameData.teams.home.team.id);
        const pitcherTeamIdentifier = getTeamIdentifier(opponentTeamId, (teamType === 'home' ? gameData.teams.away.team.name : gameData.teams.home.team.name));
        
        const battingOrderPlayerIds = gameTeamBattingOrders.get(`${gameData.gamePk}_${teamId}`);
        const fullRoster = rosters[teamId];

        // Always process the full active roster
        fullRoster?.forEach((p: any) => {
          if (!p || !p.person || !p.person.id) return; // Skip if player data is incomplete

          const playerId = p.person.id;
        
          playerIds.add(playerId);
          playerIds.add(opponentStarter.id);
          
          // Lineup position is 1-indexed if from battingOrder, null otherwise
          // Find the lineup position if the player is in the batting order
          const lineupIndex = battingOrderPlayerIds ? battingOrderPlayerIds.indexOf(playerId) : -1;
          const lineupPosition = lineupIndex !== -1 ? lineupIndex + 1 : null;

          lookupPairs.push({
            gamePk: gameData.gamePk,
            homeTeamId: gameHomeTeamIdParam,
            awayTeamId: gameAwayTeamIdParam,
            homeTeamAbbr: actualGameHomeAbbrParam,
            awayTeamAbbr: actualGameAwayAbbrParam,
            bat: playerId,
            pit: opponentStarter.id,
            batName: p.person.fullName,
            pitName: opponentStarter.fullName,
            lineupPosition: lineupPosition,
            batterTeam: batterTeamIdentifier,
            pitcherTeam: pitcherTeamIdentifier,
          });
        });
      };

      // Process home team batting against away starter, if away starter is known
      if (awayStarter) {
        processTeamLineup('home', awayStarter, g, gameHomeTeamId, gameAwayTeamId, actualGameHomeAbbr, actualGameAwayAbbr);
      } else {
        log(`ℹ️ No away starter for game ${g.gamePk}. Skipping home team batting matchups.`);
      }

      // Process away team batting against home starter, if home starter is known
      if (homeStarter) {
        processTeamLineup('away', homeStarter, g, gameHomeTeamId, gameAwayTeamId, actualGameHomeAbbr, actualGameAwayAbbr);
      } else {
        log(`ℹ️ No home starter for game ${g.gamePk}. Skipping away team batting matchups.`);
      }
      log(`🔍 Finished processing game ${g.gamePk}. Current lookupPairs count: ${lookupPairs.length} (may be one-sided if a pitcher is unknown).`);
    }

    const uniquePlayerIds = Array.from(playerIds);
    log(`🔢 Lookup pairs: ${lookupPairs.length}`);
    log(`🆔 Unique player IDs: ${uniquePlayerIds.length}`);

    // 5. Batch-fetch splits
    let allSplits: any[] = [];
    const BATCH_SIZE_PLAYER_IDS = 100; // Number of player IDs per Supabase query batch

    if (uniquePlayerIds.length > 0) {
      log(`ℹ️ Batch fetching player_splits for ${uniquePlayerIds.length} players in batches of ${BATCH_SIZE_PLAYER_IDS}...`);
      for (let i = 0; i < uniquePlayerIds.length; i += BATCH_SIZE_PLAYER_IDS) {
        const playerIdsBatch = uniquePlayerIds.slice(i, i + BATCH_SIZE_PLAYER_IDS);
        log(`🔄 Fetching splits for player ID batch ${Math.floor(i / BATCH_SIZE_PLAYER_IDS) + 1} (IDs: ${playerIdsBatch.length})`);
        
        const { data: batchData, error: batchError } = await supabaseServer
          .from('player_splits')
          .select('player_id, season, player_type, vs_handedness, xwoba, avg_launch_angle, barrels_per_pa, hard_hit_pct, avg_exit_velocity, k_percent, bb_percent, iso, swing_miss_percent, hrs, pa')
          .eq('season', 0)
          .in('player_id', playerIdsBatch) // Fetch all season 0 splits for players in the batch
          .limit(playerIdsBatch.length * 6); // Increased limit: assuming max ~6 relevant splits (e.g., B/P vs L/R/S) per player for season 0

        if (batchError) {
          log(`❌ Error fetching player_splits batch: ${batchError.message}`);
          // Decide if you want to throw or continue with partial data
          // For now, we'll log and continue, potentially leading to skipped matchups later
        } else if (batchData) {
          allSplits = allSplits.concat(batchData);
          log(`👍 Fetched ${batchData.length} splits in this batch. Total splits so far: ${allSplits.length}`);
        }
      }
      log(`📊 Total splits fetched after batching: ${allSplits.length}`);
    } else {
      log('⚠️ No unique player IDs found, skipping player_splits fetch.');
    }
    
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
    const upserts = lookupPairs.reduce<any[]>((acc, { gamePk, homeTeamId, awayTeamId, homeTeamAbbr, awayTeamAbbr, pit, bat, batName, pitName, lineupPosition, batterTeam, pitcherTeam }) => {
      const batSide = batMap.get(bat);
      const pitSide = pitMap.get(pit);

      if (!batSide || !pitSide) {
        let missingHandednessReason = "";
        if (!batSide) missingHandednessReason += `Batter (ID:${bat}, Name:${batName}) batSide not found. `;
        if (!pitSide) missingHandednessReason += `Pitcher (ID:${pit}, Name:${pitName}) pitchHand not found. `;
        log(`⚠️ Skipping matchup Bat:${bat}(${batName}) vs Pit:${pit}(${pitName}) due to missing handedness: ${missingHandednessReason}`);
        return acc;
      }

      // Determine the actual handedness the pitcher is facing.
      // This is important if the batter is a switch hitter.
      let handednessPitcherFaces = batSide; // Default to batter's listed side
      if (batSide === 'S') {
        if (pitSide === 'R') {
          handednessPitcherFaces = 'L'; // Switch hitter bats Left against RHP
        } else if (pitSide === 'L') {
          handednessPitcherFaces = 'R'; // Switch hitter bats Right against LHP
        } else {
          // This case implies pitSide is defined but not 'R' or 'L' (e.g., 'S' itself, or bad data from API).
          // This is highly unlikely for a pitcher's throwing hand.
          log(`⚠️ Cannot determine effective batter hand for pitcher splits: Batter ${batName}(ID:${bat}) is Switch, but Pitcher ${pitName}(ID:${pit}) has unexpected pitSide '${pitSide}'. Skipping matchup.`);
          return acc;
        }
      }
      // If batSide was 'R' or 'L', handednessPitcherFaces remains as batSide.

      const pitcherSplitData = allSplits?.find((s: any) =>
        s.player_type === 'pitcher' && s.player_id === pit && s.vs_handedness === handednessPitcherFaces
      );      

      // Batter split data lookup remains the same: it's how the batter performs against the pitcher's actual throwing hand.
      // The player_splits table for a batter should have vs_handedness = 'R' (meaning vs RHP)
      // and vs_handedness = 'L' (meaning vs LHP). For a switch hitter, these entries already
      // reflect them batting from the optimal side against that type of pitcher.
      const batterSplitData = allSplits?.find((s: any) =>
        s.player_type === 'batter' && s.player_id === bat && s.vs_handedness === pitSide // pitSide is the pitcher's actual throwing hand
      );
      let detailedSkipReason = "";

      if (
        pitcherSplitData && batterSplitData &&
        pitcherSplitData.xwoba != null && batterSplitData.xwoba != null &&
        pitcherSplitData.avg_launch_angle != null && batterSplitData.avg_launch_angle != null &&
        pitcherSplitData.barrels_per_pa != null && batterSplitData.barrels_per_pa != null &&
        pitcherSplitData.hard_hit_pct != null && batterSplitData.hard_hit_pct != null &&
        pitcherSplitData.avg_exit_velocity != null && batterSplitData.avg_exit_velocity != null &&
        pitcherSplitData.k_percent != null && batterSplitData.k_percent != null &&
        pitcherSplitData.bb_percent != null && batterSplitData.bb_percent != null &&
        pitcherSplitData.iso != null && batterSplitData.iso != null &&
        pitcherSplitData.swing_miss_percent != null && batterSplitData.swing_miss_percent != null &&
        pitcherSplitData.hrs != null && batterSplitData.hrs != null &&
        pitcherSplitData.pa != null && batterSplitData.pa != null &&
        pitcherSplitData.pa > 0 && batterSplitData.pa > 0
      ) {
        // All conditions met, add to upserts
        acc.push({
          game_date: gameDate,
          game_pk: gamePk,
          home_team_id: homeTeamId,
          away_team_id: awayTeamId,
          game_home_team_abbreviation: homeTeamAbbr,
          game_away_team_abbreviation: awayTeamAbbr,
          batter_id: bat,
          pitcher_id: pit,
          batter_name: batName,
          pitcher_name: pitName,
          batter_team: batterTeam,
          pitcher_team: pitcherTeam,
          lineup_position: lineupPosition,
          pitcher_hand: pitSide as 'L' | 'R', // Add pitcher hand
          batter_hand: batSide as 'L' | 'R' | 'S', // Add batter hand
          // Calculate averages for all required stats
          avg_xwoba: (pitcherSplitData.xwoba + batterSplitData.xwoba) / 2,
          avg_launch_angle: (pitcherSplitData.avg_launch_angle + batterSplitData.avg_launch_angle) / 2,
          avg_barrels_per_pa: (pitcherSplitData.barrels_per_pa + batterSplitData.barrels_per_pa) / 2,
          avg_hard_hit_pct: (pitcherSplitData.hard_hit_pct + batterSplitData.hard_hit_pct) / 2,
          avg_exit_velocity: (pitcherSplitData.avg_exit_velocity + batterSplitData.avg_exit_velocity) / 2,
          avg_k_percent: (pitcherSplitData.k_percent + batterSplitData.k_percent) / 2,
          avg_bb_percent: (pitcherSplitData.bb_percent + batterSplitData.bb_percent) / 2,
          avg_iso: (pitcherSplitData.iso + batterSplitData.iso) / 2,
          avg_swing_miss_percent: (pitcherSplitData.swing_miss_percent + batterSplitData.swing_miss_percent) / 2,
          avg_hr_per_pa: ((pitcherSplitData.hrs / pitcherSplitData.pa) + 
                         (batterSplitData.hrs / batterSplitData.pa)) / 2,
        });
      } else {
        // Determine the exact reason for skipping
        if (!pitcherSplitData) {
          detailedSkipReason += `Pitcher split data not found (Criteria: PitID:${pit}, Type:pitcher, VsHand:${handednessPitcherFaces}, Season:0). `;
        } else {
          if (pitcherSplitData.xwoba == null) detailedSkipReason += `Pitcher xwoba is null. `;
          if (pitcherSplitData.avg_launch_angle == null) detailedSkipReason += `Pitcher LA is null. `;
          if (pitcherSplitData.barrels_per_pa == null) detailedSkipReason += `Pitcher barrels_per_pa is null. `;
          if (pitcherSplitData.hard_hit_pct == null) detailedSkipReason += `Pitcher hard_hit_pct is null. `;
          if (pitcherSplitData.avg_exit_velocity == null) detailedSkipReason += `Pitcher avg_exit_velocity is null. `;
          if (pitcherSplitData.k_percent == null) detailedSkipReason += `Pitcher k_percent is null. `;
          if (pitcherSplitData.bb_percent == null) detailedSkipReason += `Pitcher bb_percent is null. `;
          if (pitcherSplitData.iso == null) detailedSkipReason += `Pitcher iso is null. `;
          if (pitcherSplitData.swing_miss_percent == null) detailedSkipReason += `Pitcher swing_miss_percent is null. `;
          if (pitcherSplitData.hr_per_pa == null) detailedSkipReason += `Pitcher hr_per_pa is null. `;
        }
        if (!batterSplitData) {
          detailedSkipReason += `Batter split data not found (Criteria: BatID:${bat}, Type:batter, VsHand:${pitSide}, Season:0). `;
        } else {
          if (batterSplitData.xwoba == null) detailedSkipReason += `Batter xwoba is null. `;
          if (batterSplitData.avg_launch_angle == null) detailedSkipReason += `Batter LA is null. `;
          if (batterSplitData.k_percent == null) detailedSkipReason += `Batter k_percent is null. `;
          if (batterSplitData.bb_percent == null) detailedSkipReason += `Batter bb_percent is null. `;
          if (batterSplitData.iso == null) detailedSkipReason += `Batter iso is null. `;
          if (batterSplitData.swing_miss_percent == null) detailedSkipReason += `Batter swing_miss_percent is null. `;
          if (batterSplitData.hr_per_pa == null) detailedSkipReason += `Batter hr_per_pa is null. `;
        }
        log(`⚠️ Skipping matchup Bat:${bat}(${batName}) vs Pit:${pit}(${pitName}). Reason(s): ${detailedSkipReason || "One or more required player_split stats are null or records not found."}`);
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