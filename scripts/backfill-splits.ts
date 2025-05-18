/* eslint-disable @typescript-eslint/no-explicit-any */
// scripts/backfill-splits.ts

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type SplitRow = {
  player_id: number;
  player_type: 'batter' | 'pitcher';
  season: number;
  vs_handedness: 'L' | 'R';
  xwoba: number;
  launch_angle: number | null;       // average launch angle
  groundball_pct: number | null;     // % of batted balls on ground
  line_drive_pct: number | null;     // % of line drives
  flyball_pct: number | null;        // % of fly balls
};

// If you set TEST_PLAYER_IDS in your env, only those IDs will be backfilled
const testPlayerIdsEnv = process.env.TEST_PLAYER_IDS;  
const TEST_PLAYER_IDS: number[] = testPlayerIdsEnv 
  ? testPlayerIdsEnv.split(',').map(s => +s) 
  : [];

async function fetchPlayerList(role: 'batter'|'pitcher') {
  // Example: fetch all active players for the season via the MLB API
  const res = await fetch(
    `https://statsapi.mlb.com/api/v1/teams?sportId=1&hydrate=roster(person(detail))`
  );
  const json: any = await res.json();
  const players: any[] = [];
  json.teams.forEach((team: any) => {
    team.roster.roster.forEach((p: any) => {
      players.push({ 
        id: p.person.id, 
        type: role 
      });
    });
  });
  return players;
}

async function fetchSplitsForPlayer(
  playerId: number,
  role: 'batter' | 'pitcher',
  season: number
): Promise<SplitRow[]> {
  // Query the statSplits endpoint for vs-pitcherHandedness (h=vs-R, a=vs-L)
  const res = await fetch(
    `https://statsapi.mlb.com/api/v1/stats` +
    `?stats=statSplits` +
    `&season=${season}` +
    `&sportId=1` +
    `&group=${role === 'batter' ? 'hitting' : 'pitching'}` +
    `&playerPool=Qualified` +
    `&sitCodes=pitcherHandedness` +
    `&limit=2000` +
    `&playerIds=${playerId}`
  );
  const json: any = await res.json();

  // statSplits come back under json.stats[0].splits[]
  const splits = json.stats?.[0]?.splits || [];
  return splits.map((s: any) => {
    // Extract the basic xwOBA if present, otherwise fallback to wOBA
    const xwoba = s.stat.xwoba ?? s.stat.wobaNew ?? null;

    // These raw counts:
    const ground = s.stat.groundOuts ?? 0;
    const line = s.stat.lineDrives ?? 0;
    const fly   = s.stat.flyBalls ?? 0;
    const total = ground + line + fly;

    return {
      player_id: playerId,
      player_type: role,
      season,
      vs_handedness: s.split ? (s.split.code === 'a' ? 'L' : 'R') : 'R',

      xwoba,
      launch_angle: s.stat.launchAngle ?? null,
      groundball_pct: total > 0 ? ground / total : null,
      line_drive_pct: total > 0 ? line / total : null,
      flyball_pct:    total > 0 ? fly / total : null,
    } as SplitRow;
  });
}

async function backfill() {
  const seasons = [2023, 2024];
  const roles: Array<'batter'|'pitcher'> = ['batter','pitcher'];

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
          const { error } = await supabase
            .from('player_splits')
            .upsert(splits, { onConflict: 'player_id,player_type,season,vs_handedness' });
          if (error) console.error('   ❌ Upsert error:', error);
          else console.log('   ✅ Upserted', splits.length, 'rows');
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
