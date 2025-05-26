// scripts/backfill-splits.ts

/**
 * @file backfill-splits.ts
 * @description Script to backfill player hitting/pitching splits data from the MLB Stats API.
 *
 * Usage:
 *   tsx scripts/backfill-splits.ts [options]
 *
 * Options:
 *   --help             Show help                                             [boolean]
 *   --version          Show version number                                   [boolean]
 *   --season           Season(s) to backfill (e.g., 2023 or 2023,2024).
 *                                                     [array] [required unless --test]
 *   --role             Player role to backfill.
 *          [string] [choices: "batter", "pitcher", "all"] [default: "all"]
 *   --players          Comma-separated list of player IDs to backfill for the
 *                      specified season(s) and role. If provided, --role cannot be 'all'.
 *                                                                      [string]
 *   --test             Run in test mode with predefined player IDs, season, and role.
 *                      Overrides other scoping options.
 *                                                      [boolean] [default: false]
 *
 * Examples:
 *   // Run in test mode (uses predefined settings)
 *   tsx scripts/backfill-splits.ts --test
 *
 *   // Backfill all batters and pitchers for the 2024 season
 *   tsx scripts/backfill-splits.ts --season 2024
 *
 *   // Backfill only batters for the 2023 season
 *   tsx scripts/backfill-splits.ts --season 2023 --role batter
 *
 *   // Backfill specific players (as batters) for the 2024 season
 *   tsx scripts/backfill-splits.ts --season 2024 --role batter --players 660271,660670
 */

import { createClient } from '@supabase/supabase-js';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Environment variables should be checked if Supabase is to be used.
// For example:
// if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
//   console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the environment.');
//   process.exit(1);
// }
// const supabase = createClient(
//   process.env.SUPABASE_URL!,
//   process.env.SUPABASE_SERVICE_ROLE_KEY!
// );

// --- Predefined Test Configuration ---
interface PredefinedTeamTestCase {
  teamId: number;
  role: 'batter' | 'pitcher';
  season: number;
  description: string;
}
const PREDEFINED_TEAM_TEST_CASES: PredefinedTeamTestCase[] = [
  { teamId: 119, role: 'batter', season: 2024, description: "Los Angeles Dodgers (Batters) - 2024" }, // LAD
  { teamId: 117, role: 'pitcher', season: 2023, description: "Houston Astros (Pitchers) - 2023" }, // HOU
];

const MLB_API_BASE_URL = 'https://statsapi.mlb.com/api/v1';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_OUTPUT_DIR = path.join(__dirname, 'test_output'); // Output directory for test files

// --- MLB API Response Type Definitions ---
interface MlbPlayer {
  id: number;
  fullName?: string;
}

interface MlbTeam {
  id: number;
  name?: string;
}

interface MlbTeamsResponse {
  teams: MlbTeam[];
}

interface MlbRosterPerson {
  id: number;
  fullName?: string;
}

interface MlbRosterEntry {
  person: MlbRosterPerson;
  jerseyNumber?: string;
  position?: { code?: string; name?: string; type?: string; abbreviation?: string };
  status?: { code?: string; description?: string };
}

interface MlbRosterResponse {
  roster: MlbRosterEntry[];
}

interface MlbPlayerStat {
  avg?: string;
  obp?: string;
  slg?: string;
  ops?: string;
  hits?: number;
  atBats?: number;
  baseOnBalls?: number; // walks
  homeRuns?: number;
  runs?: number; // runs scored
  doubles?: number;
  triples?: number;
  rbi?: number;
  strikeOuts?: number;
  stolenBases?: number;
  groundOuts?: number;
  airOuts?: number;
}

interface MlbStatSplit {
  stat: MlbPlayerStat;
  player?: MlbPlayer;
}

interface MlbStatsApiResponse {
  stats?: Array<{
    splits?: MlbStatSplit[];
  }>;
}

// --- Script Type Definitions ---
type SplitRow = {
  player_id: number;
  player_type: 'batter' | 'pitcher';
  season: number;
  vs_handedness: 'L' | 'R';
  xwoba: number | null;
  launch_angle: number | null;
  groundball_pct: number | null;
  line_drive_pct: number | null;
  // New fields for traditional stats
  avg: string | null;
  obp: string | null;
  slg: string | null;
  ops: string | null;
  hits: number | null;
  atBats: number | null;
  baseOnBalls: number | null;
  homeRuns: number | null;
  runs: number | null;
  doubles: number | null;
  triples: number | null;
  rbi: number | null;
  strikeOuts: number | null;
  stolenBases: number | null;
};

interface PlayerInfo {
  id: number;
  type: 'batter' | 'pitcher';
}

async function fetchTeamIds(): Promise<number[]> {
  const teamsUrl = `${MLB_API_BASE_URL}/teams?sportId=1`;
  const teamsRes = await fetch(teamsUrl);
  if (!teamsRes.ok) {
    console.error(`API Error fetching teams: ${teamsRes.status} ${teamsRes.statusText} for URL: ${teamsUrl}`);
    throw new Error(`Failed to fetch team list: ${teamsRes.status} ${teamsRes.statusText}`);
  }
  const teamsJson = (await teamsRes.json()) as MlbTeamsResponse;
  if (!teamsJson.teams || !Array.isArray(teamsJson.teams)) {
    console.error('Could not find teams in response from:', teamsUrl);
    throw new Error('No teams array in API response');
  }
  return teamsJson.teams.map(team => team.id).filter(id => id != null); // Filter out any null/undefined IDs
}


async function fetchPlayerList(role: 'batter' | 'pitcher'): Promise<PlayerInfo[]> {
  // 1. Fetch all teams
  const teamsUrl = `${MLB_API_BASE_URL}/teams?sportId=1`;
  const teamsRes = await fetch(teamsUrl);
  if (!teamsRes.ok) {
    console.error(`API Error: ${teamsRes.status} ${teamsRes.statusText} for URL: ${teamsUrl}`);
    throw new Error(`Failed to fetch team list: ${teamsRes.status} ${teamsRes.statusText}`);
  }
  const teamsJson = (await teamsRes.json()) as MlbTeamsResponse;
  const players: PlayerInfo[] = [];
  if (!teamsJson.teams || !Array.isArray(teamsJson.teams)) {
    console.error('Could not find teams in response from:', teamsUrl);
    throw new Error('No teams array in API response');
  }

  // 2. For each team, fetch its roster sequentially
  for (const team of teamsJson.teams) {
    if (!team.id) continue; // Skip if team has no ID
    const rosterUrl = `${MLB_API_BASE_URL}/teams/${team.id}/roster?sportId=1`;
    try {
      // console.log(`Fetching roster for team ID: ${team.id}`);
      const rosterRes = await fetch(rosterUrl);
      if (!rosterRes.ok) {
        console.error(`API Error fetching roster: ${rosterRes.status} ${rosterRes.statusText} for URL: ${rosterUrl}. Body: ${await rosterRes.text().catch(() => 'N/A')}`);
        console.warn(`Skipping roster for team ${team.id} due to HTTP error ${rosterRes.status}.`);
        continue; // Skip this team
      }
      const rosterJson = (await rosterRes.json()) as MlbRosterResponse;
      if (rosterJson.roster && Array.isArray(rosterJson.roster)) {
        rosterJson.roster.forEach((p: MlbRosterEntry) => {
          if (p.person && p.person.id) {
            players.push({
              id: p.person.id,
              type: role,
            });
          }
        });
      }
    } catch (networkErr: unknown) {
      const errorMessage = networkErr instanceof Error ? networkErr.message : String(networkErr);
      console.error(`Network Error fetching roster for team ${team.id} (URL: ${rosterUrl}): ${errorMessage}`);
      if (networkErr instanceof Error && networkErr.stack) {
        console.error(networkErr.stack);
      }
      console.warn(`Skipping roster for team ${team.id} due to this error.`);
      continue; // Skip this team
    }
  }

  return players;
}

async function fetchSplitsForTeam(
  teamId: number,
  role: 'batter' | 'pitcher',
  season: number,
  sitCode: 'vl' | 'vr', // Specific handedness
  isTestMode: boolean = false
): Promise<SplitRow[]> {
  const results: SplitRow[] = [];
  const params = new URLSearchParams({
    stats: 'statSplits',
    season: season.toString(),
    sportId: '1',
    group: role === 'batter' ? 'hitting' : 'pitching',
    teamId: teamId.toString(),
    sitCodes: sitCode,
    playerPool: 'all', // Use all players in the team pool
    limit: '2000', // API might paginate for large teams, but 2000 is a high limit
  });

  const url = `${MLB_API_BASE_URL}/stats?${params.toString()}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`API Error for team ${teamId}, sitCode ${sitCode}: ${res.status} ${res.statusText} for URL: ${url}. Body: ${await res.text().catch(() => 'N/A')}`);
      return results; // Return empty if this specific fetch fails
    }
    const json = (await res.json()) as MlbStatsApiResponse;

    if (isTestMode) { // Note: Test mode file saving might need adjustment if called per team/sitCode
      const rawOutputFileName = `team_${teamId}_${season}_${role}_${sitCode}_raw.json`;
      const rawOutputFilePath = path.join(TEST_OUTPUT_DIR, rawOutputFileName);
      try {
        await fs.writeFile(rawOutputFilePath, JSON.stringify(json, null, 2));
        console.log(`   💾 Team Raw API response saved to: ${rawOutputFilePath}`);
      } catch (writeErr) {
        console.error(`   ❌ Error saving team raw API response to ${rawOutputFilePath}:`, writeErr);
      }
    }

    const allSplitsForTeam: MlbStatSplit[] = json.stats?.[0]?.splits || [];

    allSplitsForTeam.forEach((playerSplitData) => {
      if (playerSplitData.player && playerSplitData.player.id && playerSplitData.stat) {
        const playerId = playerSplitData.player.id;
        const stat: MlbPlayerStat = playerSplitData.stat;
        const groundOuts = stat.groundOuts ?? 0;
        const airOuts = stat.airOuts ?? 0;
        const totalBattedBalls = groundOuts + airOuts;

        results.push({
          player_id: playerId,
          player_type: role,
          season,
          vs_handedness: sitCode === 'vl' ? 'L' : 'R',
          xwoba: null, launch_angle: null,
          groundball_pct: totalBattedBalls > 0 ? groundOuts / totalBattedBalls : null,
          line_drive_pct: null,
          avg: stat.avg ?? null, obp: stat.obp ?? null, slg: stat.slg ?? null, ops: stat.ops ?? null,
          hits: stat.hits ?? null, atBats: stat.atBats ?? null, baseOnBalls: stat.baseOnBalls ?? null,
          homeRuns: stat.homeRuns ?? null, runs: stat.runs ?? null, doubles: stat.doubles ?? null,
          triples: stat.triples ?? null, rbi: stat.rbi ?? null, strikeOuts: stat.strikeOuts ?? null,
          stolenBases: stat.stolenBases ?? null,
        } as SplitRow);
      }
    });
  } catch (apiOrNetworkErr: unknown) {
    console.error(`Error fetching/processing splits for team ${teamId}, sitCode ${sitCode}, URL ${url}: ${apiOrNetworkErr instanceof Error ? apiOrNetworkErr.message : String(apiOrNetworkErr)}`);
  }
  return results;
}

async function fetchSplitsForPlayer(
  playerId: number,
  role: 'batter' | 'pitcher',
  season: number,
  isTestMode: boolean = false // Added flag for test mode specific actions
): Promise<SplitRow[]> {
  const results: SplitRow[] = [];
  const handednessCodes = ['vl', 'vr']; // vs Left, vs Right

  for (const sitCode of handednessCodes) {
    const params = new URLSearchParams({
      stats: 'statSplits',
      season: season.toString(),
      sportId: '1',
      group: role === 'batter' ? 'hitting' : 'pitching',
      sitCodes: sitCode,
      limit: '2000', // Keep a reasonable limit, though we filter client-side
      playerIds: playerId.toString(),
    });
    // Note: `playerPool` is intentionally omitted here when specific `playerIds` are used,
    // as it was causing API errors. The API infers the pool from `playerIds`.

    const url = `${MLB_API_BASE_URL}/stats?${params.toString()}`;

    let playerSplitData = null;
    try { // NOSONAR
      const res = await fetch(url);
      if (!res.ok) {
        console.error(`API Error for ${sitCode}: ${res.status} ${res.statusText} for URL: ${url}. Body: ${await res.text().catch(() => 'N/A')}`);
        continue; // Skip this handedness if there's an API error
      }
      const json = (await res.json()) as MlbStatsApiResponse;

      if (isTestMode) {
        const rawOutputFileName = `${playerId}_${season}_${role}_${sitCode}_raw.json`;
        const rawOutputFilePath = path.join(TEST_OUTPUT_DIR, rawOutputFileName);
        try {
          await fs.writeFile(rawOutputFilePath, JSON.stringify(json, null, 2));
          console.log(`   💾 Raw API response saved to: ${rawOutputFilePath}`);
        } catch (writeErr) {
          console.error(`   ❌ Error saving raw API response to ${rawOutputFilePath}:`, writeErr);
        }
      }
      const allSplits: MlbStatSplit[] = json.stats?.[0]?.splits || [];

      // Find the specific player's data in the response
      playerSplitData = allSplits.find((s: MlbStatSplit) => s.player && s.player.id === playerId);

      if (playerSplitData) {
        const stat: MlbPlayerStat = playerSplitData.stat;
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
          // Populate new fields
          avg: stat.avg ?? null,
          obp: stat.obp ?? null,
          slg: stat.slg ?? null,
          ops: stat.ops ?? null,
          hits: stat.hits ?? null,
          atBats: stat.atBats ?? null,
          baseOnBalls: stat.baseOnBalls ?? null,
          homeRuns: stat.homeRuns ?? null,
          runs: stat.runs ?? null,
          doubles: stat.doubles ?? null,
          triples: stat.triples ?? null,
          rbi: stat.rbi ?? null,
          strikeOuts: stat.strikeOuts ?? null,
          stolenBases: stat.stolenBases ?? null,
        } as SplitRow);
      }
    } catch (apiOrNetworkErr: unknown) {
      console.error(`Error fetching/processing splits for ${sitCode}, URL ${url}: ${apiOrNetworkErr instanceof Error ? apiOrNetworkErr.message : String(apiOrNetworkErr)}`);
      if (apiOrNetworkErr instanceof Error && apiOrNetworkErr.stack) {
        console.error(apiOrNetworkErr.stack);
      }
      continue; // Skip this handedness if there's a network error
    }
  }
  return results;
}

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option('season', {
      alias: 's',
      type: 'string', // Read as string to handle comma separation
      description: 'Season(s) to backfill (e.g., 2023 or 2023,2024)',
      coerce: (arg: string) => arg.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 1900 && n < 2100),
    })
    .option('role', {
      alias: 'r',
      type: 'string',
      choices: ['batter', 'pitcher', 'all'] as const,
      default: 'all' as 'all',
      description: 'Player role to backfill',
    })
    .option('players', {
      alias: 'p',
      type: 'string',
      description: 'Comma-separated list of player IDs to backfill',
      coerce: (arg?: string) => arg ? arg.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n)) : undefined,
    })
    .option('test', {
      type: 'boolean',
      default: false,
      description: 'Run in test mode with predefined player IDs, season, and role. Overrides other scoping options.',
    })
    .check((argv) => {
      if (!argv.test && (!argv.season || argv.season.length === 0)) {
        throw new Error('Error: --season is required unless --test mode is enabled.');
      }
      if (argv.players && argv.players.length > 0 && argv.role === 'all') {
        throw new Error("Error: --role cannot be 'all' when specific --players are provided. Please specify 'batter' or 'pitcher'.");
      }
      return true;
    })
    .help()
    .alias('help', 'h')
    .argv;

  let seasonsToProcess: number[];
  let rolesToProcess: Array<'batter' | 'pitcher'>;
  let playerIdsToProcess: number[] | undefined;

  if (argv.test) {
    console.log(`🧪 Running in TEST mode.`);
    try {
      await fs.mkdir(TEST_OUTPUT_DIR, { recursive: true });
      console.log(`   📂 Test output directory ensured at: ${TEST_OUTPUT_DIR}`);
    } catch (dirErr) {
      console.error(`   ❌ Error creating test output directory ${TEST_OUTPUT_DIR}:`, dirErr);
      // Decide if you want to proceed or exit if directory creation fails
    }

   console.log("\n--- Running Team Test Cases ---");
    for (const teamTestCase of PREDEFINED_TEAM_TEST_CASES) {
      console.log(`\n▶️  Running Team Test Case: ${teamTestCase.description}`);
      const handednessCodes: Array<'vl' | 'vr'> = ['vl', 'vr'];
      let allTeamSplitsForCase: SplitRow[] = [];

      for (const sitCode of handednessCodes) {
        console.log(`  🔄 Fetching ${teamTestCase.role} splits for team ${teamTestCase.teamId} (vs ${sitCode === 'vl' ? 'L' : 'R'}) in ${teamTestCase.season}`);
        // `fetchSplitsForTeam` already saves its own raw data if isTestMode is true
        const teamSplits = await fetchSplitsForTeam(teamTestCase.teamId, teamTestCase.role, teamTestCase.season, sitCode, true);
        if (teamSplits.length > 0) {
          console.log(`   ✅ Fetched ${teamSplits.length} ${teamTestCase.role} split rows for team ${teamTestCase.teamId} (vs ${sitCode === 'vl' ? 'L' : 'R'})`);
          allTeamSplitsForCase = allTeamSplitsForCase.concat(teamSplits);
        } else {
          console.log(`   ⚠️ No splits data returned for team ${teamTestCase.teamId} (vs ${sitCode === 'vl' ? 'L' : 'R'}) in ${teamTestCase.season} as ${teamTestCase.role}`);
        }
      }
      if (allTeamSplitsForCase.length > 0) {
        const parsedOutputFileName = `team_${teamTestCase.teamId}_${teamTestCase.season}_${teamTestCase.role}_parsed.json`;
        const parsedOutputFilePath = path.join(TEST_OUTPUT_DIR, parsedOutputFileName);
        try {
          await fs.writeFile(parsedOutputFilePath, JSON.stringify(allTeamSplitsForCase, null, 2));
          console.log(`   💾 Team Parsed data (all handedness) saved to: ${parsedOutputFilePath}`);
        } catch (writeErr) {
          console.error(`   ❌ Error saving team parsed data to ${parsedOutputFilePath}:`, writeErr);
        }
      }
    }
    console.log('\n🎉 Test mode complete');
    return;
  } else {
    seasonsToProcess = argv.season!; // Already checked by yargs .check
    if (argv.role === 'all') {
      rolesToProcess = ['batter', 'pitcher'];
    } else {
      rolesToProcess = [argv.role!];
    }
    playerIdsToProcess = argv.players;
  }

  for (const season of seasonsToProcess) {
    for (const role of rolesToProcess) {
      console.log(`\n▶️  Backfilling ${role}s for ${season}`);
      if (playerIdsToProcess && playerIdsToProcess.length > 0) {
        // --- Process Specific Players (existing logic) ---
        console.log(`⚙️  Processing specific player IDs: ${playerIdsToProcess.join(', ')} as ${role}s`);
        const players: PlayerInfo[] = playerIdsToProcess.map(id => ({ id, type: role }));

        for (const player of players) {
          console.log(`  🔄 Fetching splits for individual player ${role} ${player.id} in ${season}`);
          const individualSplits = await fetchSplitsForPlayer(player.id, role, season); // isTestMode is false here
          if (individualSplits.length > 0) {
            // TODO: Upsert individualSplits to Supabase
            console.log(`   ✅ Fetched ${individualSplits.length} split rows for player ${player.id} (Supabase upsert commented out)`);
          } else {
            console.log(`   ⚠️ No splits data returned for player ${player.id} in ${season} as ${role}`);
          }
        }
      } else {
        // --- Process All Teams (New Logic) ---
        console.log(`⚙️  Fetching all team IDs for ${season} to process ${role}s...`);
        const teamIds = await fetchTeamIds();
        if (teamIds.length === 0) {
          console.log(`ℹ️ No teams found to process.`);
          continue;
        }
        console.log(`Found ${teamIds.length} teams. Fetching ${role} splits for each.`);

        for (const teamId of teamIds) {
          console.log(`  🔄 Fetching ${role} splits for team ${teamId} in ${season}`);
          const handednessCodes: Array<'vl' | 'vr'> = ['vl', 'vr'];
          for (const sitCode of handednessCodes) {
            const teamSplits = await fetchSplitsForTeam(teamId, role, season, sitCode); // isTestMode is false here
            if (teamSplits.length > 0) {
              // TODO: Upsert teamSplits to Supabase
              console.log(`   ✅ Fetched ${teamSplits.length} ${role} split rows for team ${teamId} (vs ${sitCode === 'vl' ? 'L' : 'R'}) (Supabase upsert commented out)`);
            } // No "no data" message here to avoid verbosity, as it's per handedness
          }
        }
      }
    }
  }

  console.log('\n🎉 Backfill complete');
}

main().catch(error => {
  // Yargs errors are often handled before this, but this is a general catch-all
  if (error.name === 'YError') { // Yargs specific error
    console.error(`\n❌ Argument Error: ${error.message}`);
  } else {
    console.error('🔴 Backfill script encountered a fatal error:');
  }
  if (error instanceof Error) {
    console.error('Error Name:', error.name);
    console.error('Error Message:', error.message);
    console.error('Stack Trace:', error.stack);
  } else {
    console.error('Raw error object (not an Error instance):', error);
    if (typeof error === 'object' && error !== null) {
      try {
        console.error('Error stringified:', JSON.stringify(error));
      } catch (e) { /* Ignore if it cannot be stringified */ }
    }
  }
  process.exit(1);
});
