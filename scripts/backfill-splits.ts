/* eslint-disable @typescript-eslint/no-explicit-any */
// scripts/backfill-splits.ts

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

// const supabase = createClient(
//   process.env.SUPABASE_URL!,
//   process.env.SUPABASE_SERVICE_ROLE_KEY!
// );

type SplitRow = {
  player_id: number;
  player_type: 'batter' | 'pitcher';
  season: number;
  vs_handedness: 'L' | 'R';
  xwoba: number | null;
  launch_angle: number | null;
  groundball_pct: number | null;
  line_drive_pct: number | null;
  flyball_pct: number | null;
  // New fields for traditional stats
  avg: string | null;
  obp: string | null;
  slg: string | null;
  ops: string | null;
  hits: number | null;
  atBats: number | null;
  baseOnBalls: number | null;
  homeRuns: number | null;
  runs: number | null; // Note: API might use 'r' for runs scored
  doubles: number | null;
  triples: number | null;
  rbi: number | null;
  strikeOuts: number | null;
  stolenBases: number | null;
};

// If you set TEST_PLAYER_IDS in your env, only those IDs will be backfilled
const testPlayerIdsEnv = process.env.TEST_PLAYER_IDS;  
const TEST_PLAYER_IDS: number[] = testPlayerIdsEnv 
  ? testPlayerIdsEnv.split(',').map(s => +s) 
  : [];

async function fetchPlayerList(role: 'batter'|'pitcher') {
  // 1. Fetch all teams
  const teamsUrl = `https://statsapi.mlb.com/api/v1/teams?sportId=1`;
  const teamsRes = await fetch(teamsUrl);
  if (!teamsRes.ok) {
    console.error(`API Error: ${teamsRes.status} ${teamsRes.statusText} for URL: ${teamsUrl}`);
    throw new Error(`Failed to fetch team list: ${teamsRes.status}`);
  }
  const teamsJson: any = await teamsRes.json();
  const players: any[] = [];

  if (!teamsJson.teams || !Array.isArray(teamsJson.teams)) {
    console.error('Could not find teams in response from:', teamsUrl);
    throw new Error('No teams array in API response');
  }

  // 2. For each team, fetch its roster
  for (const team of teamsJson.teams) {
    if (!team.id) continue; // Skip if team has no ID
    const rosterUrl = `https://statsapi.mlb.com/api/v1/teams/${team.id}/roster?sportId=1`;
    try {
      // console.log(`Fetching roster for team ID: ${team.id}`);
      const rosterRes = await fetch(rosterUrl);
      if (!rosterRes.ok) {
        console.error(`API Error fetching roster: ${rosterRes.status} ${rosterRes.statusText} for URL: ${rosterUrl}`);
        console.warn(`Skipping roster for team ${team.id} due to HTTP error ${rosterRes.status}.`);
        continue; 
      }
      const rosterJson: any = await rosterRes.json();
      if (rosterJson.roster && Array.isArray(rosterJson.roster)) {
        rosterJson.roster.forEach((p: any) => {
          if (p.person && p.person.id) {
            players.push({ 
              id: p.person.id, 
              type: role // Role is passed to fetchPlayerList, used to tag player type
            });
          }
        });
      }
    } catch (networkErr: any) {
      console.error(`Network Error fetching roster for team ${team.id} (URL: ${rosterUrl}): ${networkErr.message}`);
      console.warn(`Skipping roster for team ${team.id} due to this network error.`);
      continue; // Skip this team and continue with the next one
    }
  }
  console.log(`fetchPlayerList found ${players.length} players for role ${role}. Test IDs: ${TEST_PLAYER_IDS.join(', ')}`);
  return players;
}

async function fetchSplitsForPlayer(
  playerId: number,
  role: 'batter' | 'pitcher',
  season: number
): Promise<SplitRow[]> {
  const results: SplitRow[] = [];
  const handednessCodes = ['vl', 'vr']; // vs Left, vs Right

  for (const sitCode of handednessCodes) {
    const url = `https://statsapi.mlb.com/api/v1/stats` +
      `?stats=statSplits` +
      `&season=${season}` +
      `&sportId=1` +
      `&group=${role === 'batter' ? 'hitting' : 'pitching'}` +
      `&playerPool=All` + // Use playerPool=All
      `&sitCodes=${sitCode}` +
      `&limit=2000` + // Keep a reasonable limit, though we filter client-side
      `&playerIds=${playerId}`; // This might not filter exclusively, so we handle it below

    let playerSplitData = null;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.error(`API Error for ${sitCode}: ${res.status} ${res.statusText} for URL: ${url}`);
        continue; // Skip this handedness if there's an API error
      }
      const json: any = await res.json();
      const allSplits = json.stats?.[0]?.splits || [];
      
      // Find the specific player's data in the response
      playerSplitData = allSplits.find((s: any) => s.player && s.player.id === playerId);

      if (playerSplitData) {
        const stat = playerSplitData.stat;
        const groundOuts = stat.groundOuts ?? 0;
        const airOuts = stat.airOuts ?? 0;
        // As per findings, lineDrives and flyBalls are not directly available.
        // total_batted_balls is groundOuts + airOuts for this context.
        const totalBattedBalls = groundOuts + airOuts;

        results.push({
          player_id: playerId,
          player_type: role,
          season,
          vs_handedness: sitCode === 'vl' ? 'L' : 'R',
          xwoba: null,
          launch_angle: null,
          groundball_pct: totalBattedBalls > 0 ? groundOuts / totalBattedBalls : null,
          line_drive_pct: null,
          flyball_pct: null,
          // Populate new fields
          avg: stat.avg ?? null,
          obp: stat.obp ?? null,
          slg: stat.slg ?? null,
          ops: stat.ops ?? null,
          hits: stat.hits ?? null,
          atBats: stat.atBats ?? null,
          baseOnBalls: stat.baseOnBalls ?? null,
          homeRuns: stat.homeRuns ?? null,
          runs: stat.runs ?? stat.rbi ?? null, // API might use "rbi" for runs if "runs" isn't present, or this needs specific check if runs is a different field
          doubles: stat.doubles ?? null,
          triples: stat.triples ?? null,
          rbi: stat.rbi ?? null,
          strikeOuts: stat.strikeOuts ?? null,
          stolenBases: stat.stolenBases ?? null,
        } as SplitRow);
      } else {
        console.log(`   ⚠️ No data for player ${playerId} with sitCode ${sitCode} in season ${season}`);
      }
    } catch (networkErr: any) {
      console.error(`Network Error for ${sitCode} URL ${url}: ${networkErr.message}`);
      continue; // Skip this handedness if there's a network error
    }
  }
  if (results.length > 0) {
    console.log('Sample SplitRow:', JSON.stringify(results[0], null, 2));
  }
  return results;
}

async function backfill() {
  const seasons = [2023]; // Set seasons to [2023] for this test
  const roles: Array<'batter'|'pitcher'> = ['batter']; // Process only 'batter' role for this test

  for (const season of seasons) {
    for (const role of roles) {
      console.log(`\n▶️  Backfilling ${role}s for ${season}`);
      
      // 1. Get the full list (as before)
      let players = await fetchPlayerList(role);

      // 2. If TEST_PLAYER_IDS is set, filter down to just those
      if (TEST_PLAYER_IDS.length) {
        console.log(`⚙️  TEST mode: only these IDs→ ${TEST_PLAYER_IDS.join(', ')}`);
        players = players.filter(p => TEST_PLAYER_IDS.includes(p.id));
      }

      for (const { id } of players) {
        console.log(`  🔄 Fetching splits for ${role} ${id} in ${season}`);
        const splits = await fetchSplitsForPlayer(id, role, season);
        if (splits.length) {
          // const { error } = await supabase
          //   .from('player_splits')
          //   .upsert(splits, { onConflict: 'player_id,player_type,season,vs_handedness' });
          // if (error) console.error('   ❌ Upsert error:', error);
          // else console.log('   ✅ Upserted', splits.length, 'rows');
          console.log('   ✅ Fetched', splits.length, 'split rows (Supabase upsert commented out)');
        } else {
          console.log('   ⚠️ No splits returned for this player');
        }
      }
    }
  }

  console.log('\n🎉 Backfill complete');
}

backfill().catch(err => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
