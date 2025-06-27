// scripts/fetch-savant-stats.ts
/**
 * @file fetch-savant-stats.ts
 * @description Script to construct URLs and then download CSV files containing
 *              aggregated player statistics from Baseball Savant's Statcast search
 *              for specified seasons, player types (batter/pitcher), and handedness matchups.
 *              The downloaded CSVs are saved to an output directory.
 *
 * Usage:
 *   tsx scripts/fetch-savant-stats.ts
 *
 * This script will download CSV files containing Statcast data for specified seasons,
 * player types (batter/pitcher), and handedness matchups.
 */

import fs from 'fs/promises';
import path from 'path';

import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// --- File Path Setup ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const BASE_SAVANT_URL = 'https://baseballsavant.mlb.com/statcast_search/csv';

// Define player types
const PLAYER_TYPES: ('batter' | 'pitcher')[] = ['batter', 'pitcher'];

// Define the handedness of the opponent.
// For batters, this is the pitcher's throwing hand.
// For pitchers, this is the batter's standing side.
const HANDEDNESS_OPPONENT: ('R' | 'L')[] = ['R', 'L'];

// Common query parameters based on the example URLs provided.
// These parameters define the data columns, filters, and sorting.
const COMMON_PARAMS: Record<string, string> = {
  all: 'true',
  hfPT: '', // Pitch Type (empty for all)
  hfAB: '', // Type of Batted Ball (empty for all)
  hfGT: 'R|', // Game Type: Regular Season only
  hfPR: '', // Pitch Result (empty for all)
  hfZ: '', // Zone (empty for all)
  hfStadium: '', // Stadium (empty for all)
  hfBBL: '', // Batted Ball Location (empty for all)
  hfNewZones: '', // New Zones (empty for all)
  hfPull: '', // Pull/Opposite field (empty for all)
  hfC: '', // Count (empty for all)
  hfSit: '', // Situation (empty for all)
  hfOuts: '', // Outs (empty for all)
  hfOpponent: '', // Opponent Team (empty for all)
  hfSA: '', // Hit Spray Angle (empty for all)
  game_date_gt: '', // Game date greater than (empty)
  game_date_lt: '', // Game date less than (empty)
  hfMo: '', // Month (empty for all)
  hfTeam: '', // Player's Team (empty for all)
  home_road: '', // Home or Road (empty for all)
  hfRO: '', // Runners On (empty for all)
  position: '', // Fielder Position (empty for all)
  hfInfield: '', // Infield Alignment (empty for all)
  hfOutfield: '', // Outfield Alignment (empty for all)
  hfInn: '', // Inning (empty for all)
  hfBBT: '', // Batted Ball Type (e.g., fly_ball, ground_ball) (empty for all)
  hfFlag: 'is\\..bunt\\..not|', // Filter: Exclude bunts. Note: Backslashes are escaped for JS string.
  metric_1: '', // Secondary metric (empty)
  group_by: 'name', // Group results by player name
  min_pitches: '0', // Minimum pitches thrown (more relevant for pitchers if not grouping by PA)
  min_results: '0', // Minimum batted ball results
  min_pas: '5', // Minimum Plate Appearances to qualify
  sort_col: 'xwoba', // Primary sort column
  player_event_sort: 'api_p_release_speed', // Default secondary sort from UI, may not be impactful with group_by=name
  sort_order: 'desc', // Sort order: descending
  // Checkboxes for stats to include in the CSV output:
  chk_stats_pa: 'on',
  chk_stats_hrs: 'on', // Home Runs
  chk_stats_k_percent: 'on',
  chk_stats_bb_percent: 'on',
  chk_stats_ba: 'on',
  chk_stats_obp: 'on',
  chk_stats_slg: 'on',
  chk_stats_woba: 'on',
  chk_stats_xwoba: 'on',
  chk_stats_barrels_total: 'on', // Total Barrels
  chk_stats_iso: 'on', // Isolated Power
  chk_stats_swing_miss_percent: 'on', // Swing and Miss Percentage
  chk_stats_launch_speed: 'on', // Average Exit Velocity
  chk_stats_hyper_speed: 'on', // Adjusted Exit Velocity (Hyper Speed)
  chk_stats_launch_angle: 'on', // Average Launch Angle
  chk_stats_hardhit_percent: 'on', // Hard Hit Percentage
  chk_stats_barrels_per_pa_percent: 'on', // Barrels per Plate Appearance Percentage
  chk_stats_abs: 'on', // At Bats
  minors: 'false', // Exclude minor league games
};
const SAVANT_CSV_OUTPUT_DIR = path.join(__dirname, 'savant_csv_output'); // Output directory for downloaded CSVs

const DOWNLOAD_DELAY_MS = 15000; // 15 seconds delay between downloads

// --- Function to Construct URLs and Download CSVs ---

async function constructAndDownloadSavantCsvs(targetSeasons: number[]): Promise<void> {
  console.log('Constructing Baseball Savant Statcast URLs and downloading CSVs...\n');
  await fs.mkdir(SAVANT_CSV_OUTPUT_DIR, { recursive: true });
  console.log(`📂 CSVs will be saved to: ${SAVANT_CSV_OUTPUT_DIR}\n`);

  let firstDownload = true;

  for (const season of targetSeasons) {
    for (const playerType of PLAYER_TYPES) {
      for (const opponentHand of HANDEDNESS_OPPONENT) {

        const params = new URLSearchParams(COMMON_PARAMS);

        params.set('hfSea', `${season}|`); // Set season (e.g., "2024|")
        params.set('player_type', playerType);

        if (playerType === 'batter') {
          // For batters, specify the pitcher's throwing hand
          params.set('pitcher_throws', opponentHand);
          params.set('batter_stands', ''); // Batter's own stance is not filtered here
        } else { // playerType === 'pitcher'
          // For pitchers, specify the batter's standing side
          params.set('batter_stands', opponentHand);
          params.set('pitcher_throws', ''); // Pitcher's own throwing hand is not filtered here
        }

        const url = `${BASE_SAVANT_URL}?${params.toString()}`;
        const description = `Season: ${season}, Type: ${playerType}, vs ${opponentHand}H Opponent`;
        const fileName = `savant_stats_${season}_${playerType}_vs_${opponentHand}H.csv`;
        const filePath = path.join(SAVANT_CSV_OUTPUT_DIR, fileName);

        if (!firstDownload) {
          console.log(`⏳ Waiting for ${DOWNLOAD_DELAY_MS / 1000} seconds before next download...`);
          await new Promise(resolve => setTimeout(resolve, DOWNLOAD_DELAY_MS));
        } else {
          firstDownload = false;
        }

        console.log(`Attempting to download: ${description}`);
        console.log(`  URL: ${url}`);

        try {
          const response = await fetch(url);
          if (!response.ok) {
            const errorBody = await response.text().catch(() => 'Could not read error body');
            console.error(`  ❌ Error fetching CSV for ${description}: ${response.status} ${response.statusText}`);
            console.error(`     Response body: ${errorBody.substring(0, 500)}${errorBody.length > 500 ? '...' : ''}`);
            console.log('---');
            continue; // Skip to the next URL
          }

          const csvData = await response.text();
          await fs.writeFile(filePath, csvData);
          console.log(`  ✅ Successfully downloaded and saved to: ${filePath}`);
        } catch (error) {
          console.error(`  ❌ Failed to download or save CSV for ${description}:`, error instanceof Error ? error.message : error);
        }
        console.log('---');
      }
    }
  }
  console.log('All downloads attempted.');
}

// --- Main Execution ---

async function main() {
  const currentYear = new Date().getFullYear();
  let targetSeasons: number[] = [currentYear]; // Default to current year

  // Check for command-line arguments for specific seasons
  const seasonArgIndex = process.argv.indexOf('--season');
  if (seasonArgIndex > -1 && process.argv[seasonArgIndex + 1]) {
    const seasonsInput = process.argv[seasonArgIndex + 1];
    targetSeasons = seasonsInput.split(',').map(s => parseInt(s.trim(), 10)).filter(s => !isNaN(s));
    if (targetSeasons.length === 0) {
      console.warn('No valid seasons provided with --season flag. Defaulting to current year.');
      targetSeasons = [currentYear];
    }
  } else if (process.argv.includes('--all-seasons')) {
    // Example for fetching all historical seasons (adjust as needed)
    targetSeasons = [2022, 2023, 2024, 2025]; // Or dynamically determine range
    console.log('Fetching all historical seasons.');
  }

  try {
    await constructAndDownloadSavantCsvs(targetSeasons);
    console.log('\n🎉 Script finished.');
  } catch (error) {
    console.error('🔴 An unexpected error occurred during script execution:', error);
    process.exit(1);
  }
}

main();