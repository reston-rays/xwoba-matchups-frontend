// scripts/upload-savant-csvs-to-supabase.ts

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Papa from 'papaparse';

import { Database } from '../src/types/database.types';
type PlayerSplit = Database['public']['Tables']['player_splits']['Row'];

/**
 * @file upload-savant-csvs-to-supabase.ts
 * @description Script to read pre-downloaded Savant CSV files from a local directory,
 *              parse them, and upsert the player statistics into a Supabase database table.
 *
 * Assumes CSV files are named in the format: savant_stats_${season}_${playerType}_vs_${opponentHand}H.csv
 * and are located in the SAVANT_CSV_INPUT_DIR.
 *
 * Usage:
 *   Ensure .env file has SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 *   tsx scripts/upload-savant-csvs-to-supabase.ts
 */

// --- File Path Setup ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SAVANT_CSV_INPUT_DIR = path.join(__dirname, 'savant_csv_output'); // Input directory for downloaded CSVs
const WEIGHTED_STATS_CSV_FILENAME = 'weighted_player_stats.csv'; // Expected name of the weighted stats CSV

// --- Supabase Setup ---
const SUPABASE_TABLE_NAME = 'player_splits'; // Target table in Supabase

let supabase: SupabaseClient;

if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  console.log('Supabase client initialized.');
} else {
  console.error(
    '🔴 Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the environment variables.'
  );
  console.error('Please create a .env file with these values.');
  process.exit(1);
}

// --- Helper Functions ---
function parseFloatOrNull(value: string | undefined | null): number | null {
  if (value === null || value === undefined || typeof value !== 'string' || value.trim() === '' || value.trim() === '--' || value.trim().toLowerCase() === 'null') {
    return null;
  }
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

// Helper function to parse float, optionally divide by 100 (for percentages), and round
function parseFloatAndRound(
  value: string | null | undefined,
  decimalPlaces: number,
  isPercentageToConvert: boolean = false
): number | null {
  if (value === null || value === undefined || typeof value !== 'string' || value.trim() === '' || value.trim() === '--' || value.trim().toLowerCase() === 'null') {
    return null;
  }
  let parsed = parseFloat(value);
  if (isNaN(parsed)) {
    return null;
  }
  if (isPercentageToConvert) {
    parsed /= 100;
  }
  const factor = Math.pow(10, decimalPlaces);
  return Math.round(parsed * factor) / factor;
}

function parseIntOrNull(value: string | undefined | null): number | null {
  if (value === null || value === undefined || typeof value !== 'string' || value.trim() === '' || value.trim() === '--' || value.trim().toLowerCase() === 'null') {
    return null;
  }
  const num = parseInt(value, 10);
  return isNaN(num) ? null : num;
}

function extractInfoFromFilename(filename: string): { season: number; playerType: 'batter' | 'pitcher'; opponentHand: 'L' | 'R' } | null {
  const match = filename.match(/savant_stats_(\d{4})_(batter|pitcher)_vs_([RL])H\.csv/);
  if (match) {
    return {
      season: parseInt(match[1], 10),
      playerType: match[2] as 'batter' | 'pitcher',
      opponentHand: match[3] as 'L' | 'R',
    };
  }
  return null;
}

// --- Main Processing Function ---
async function processAndUploadSavantCsvs(): Promise<void> {
  if (!supabase) {
    console.error('🔴 Supabase client is not initialized. Exiting.');
    return;
  }

  console.log(`Reading CSV files from: ${SAVANT_CSV_INPUT_DIR}\n`);

  try {
    const files = await fs.readdir(SAVANT_CSV_INPUT_DIR);
    const csvFiles = files.filter(file => file.endsWith('.csv'));

    if (csvFiles.length === 0) {
      console.log(`No CSV files found in ${SAVANT_CSV_INPUT_DIR}.`);
      return;
    }

    for (const csvFile of csvFiles) {
      const filePath = path.join(SAVANT_CSV_INPUT_DIR, csvFile);
      console.log(`--- Processing file: ${csvFile} ---`);

      const fileInfo = extractInfoFromFilename(csvFile);
      if (!fileInfo) {
        console.warn(`  ⚠️ Could not extract metadata from filename: ${csvFile}. Skipping.`);
        continue;
      }

      const { season, playerType, opponentHand } = fileInfo;

      try {
        const csvData = await fs.readFile(filePath, 'utf-8');
        const parseResult = Papa.parse(csvData, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: false,
        });

        if (parseResult.errors.length > 0) {
          console.error(`  ❌ Error parsing CSV ${csvFile}:`, parseResult.errors);
          continue;
        }

        const recordsToUpsert: PlayerSplit[] = parseResult.data.map((row: any): PlayerSplit => ({
          // Identifiers
          player_id: parseIntOrNull(row.player_id) as number, // Assert as number; filter will remove nulls
          season: season,
          player_type: playerType, // Already typed from extractInfoFromFilename
          vs_handedness: opponentHand, // Already typed from extractInfoFromFilename
          player_name: row['last_name, first_name'] || row.player_name || null,

          // Core Plate Appearance Stats
          pa: parseIntOrNull(row.pa),
          ab: parseIntOrNull(row.ab), // New DB field, CSV header: ab

          // Rate Stats
          // Assuming these are NUMERIC(4,3) or similar, needing 3 decimal places
          ba: parseFloatAndRound(row.ba, 3),
          obp: parseFloatAndRound(row.obp, 3),
          slg: parseFloatAndRound(row.slg, 3),
          woba: parseFloatAndRound(row.woba, 3),
          xwoba: parseFloatAndRound(row.xwoba, 3),
          xba: parseFloatAndRound(row.xba, 3),
          xobp: parseFloatAndRound(row.xobp, 3),
          xslg: parseFloatAndRound(row.xslg, 3),
          iso: parseFloatAndRound(row.iso, 3),
          babip: parseFloatAndRound(row.babip, 3),

          // Batted Ball Stats
          barrels: parseIntOrNull(row.barrels_total), // Renamed DB field (was barrels_total), CSV header: barrels
          // Percentages from CSV (e.g., 20.5%) converted to decimal (e.g., 0.2050) for NUMERIC(5,4)
          barrels_per_pa: parseFloatAndRound(row.barrels_per_pa_percent, 4, true), // Uses CSV: barrels_per_pa_percent
          hard_hit_pct: parseFloatAndRound(row.hardhit_percent, 4, true),       // Uses CSV: hardhit_percent
          groundball_pct: parseFloatAndRound(row.gb_percent, 4, true),           // Uses CSV: gb_percent
          line_drive_pct: parseFloatAndRound(row.ld_percent, 4, true),           // Uses CSV: ld_percent
          flyball_pct: parseFloatAndRound(row.fb_percent, 4, true),             // Uses CSV: fb_percent
          // Averages, typically NUMERIC(X,2)
          avg_exit_velocity: parseFloatAndRound(row.launch_speed, 2),      // Renamed DB field (was avg_launch_speed), CSV: launch_speed
          max_exit_velocity: parseFloatAndRound(row.max_launch_speed, 2),  // New DB field, CSV: max_launch_speed
          avg_launch_angle: parseFloatAndRound(row.launch_angle, 2),       // DB field: avg_launch_angle, CSV: launch_angle
          hrs: parseIntOrNull(row.hrs),                                    // DB field: hrs, CSV: hrs
          swing_miss_percent: parseFloatAndRound(row.swing_miss_percent, 4, true), // CSV: swing_miss_percent, DB: numeric(5,4)
          hyper_speed: parseFloatAndRound(row.hyper_speed, 1),                   // CSV: hyper_speed, DB: numeric(4,1)

          // Add missing properties for PlayerSplit
          k_percent: parseFloatAndRound(row.k_percent, 4, true), // CSV: k_percent (as percentage, e.g., "23.4")
          bb_percent: parseFloatAndRound(row.bb_percent, 4, true), // CSV: bb_percent (as percentage, e.g., "8.7")

          last_updated: new Date().toISOString(), // Set last_updated to current time
        })).filter((record): record is PlayerSplit => // Type guard to ensure non-null PK fields
          record.player_id !== null &&
          record.season !== null // player_type and vs_handedness are guaranteed by fileInfo
        );

        if (recordsToUpsert.length > 0) {
          console.log(`  ⏳ Upserting ${recordsToUpsert.length} records from ${csvFile} to Supabase table "${SUPABASE_TABLE_NAME}"...`);
          const { error: upsertError } = await supabase
            .from(SUPABASE_TABLE_NAME)
            .upsert(recordsToUpsert, { onConflict: 'player_id,season,player_type,vs_handedness' });

          if (upsertError) {
            console.error(`  ❌ Supabase upsert error for ${csvFile}:`, upsertError.message);
          } else {
            console.log(`  ✅ Successfully upserted ${recordsToUpsert.length} records from ${csvFile}.`);
          }
        } else {
          console.log(`  ℹ️ No valid records to upsert from ${csvFile}.`);
        }
      } catch (fileError) {
        console.error(`  ❌ Error reading or processing file ${csvFile}:`, fileError);
      }
    }
  } catch (readDirError) {
    console.error(`🔴 Error reading directory ${SAVANT_CSV_INPUT_DIR}:`, readDirError);
    process.exit(1);
  }

  console.log('\nAll CSV processing attempted.');
}

// --- Function to Process Weighted Stats CSV ---
async function processAndUploadWeightedStats(): Promise<void> {
  if (!supabase) {
    console.error('🔴 Supabase client is not initialized. Exiting.');
    return;
  }

  const filePath = path.join(SAVANT_CSV_INPUT_DIR, WEIGHTED_STATS_CSV_FILENAME);
  console.log(`--- Processing weighted stats file: ${WEIGHTED_STATS_CSV_FILENAME} ---`);

  try {
    await fs.access(filePath); // Check if file exists
  } catch (accessError) {
    console.error(`  ❌ Weighted stats file not found at: ${filePath}. Please generate it first.`);
    return;
  }

  try {
    const csvData = await fs.readFile(filePath, 'utf-8');
    const parseResult = Papa.parse(csvData, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false, // Keep as strings for consistent parsing
    });

    if (parseResult.errors.length > 0) {
      console.error(`  ❌ Error parsing CSV ${WEIGHTED_STATS_CSV_FILENAME}:`, parseResult.errors);
      return;
    }

    const recordsToUpsert: PlayerSplit[] = parseResult.data.map((row: any): PlayerSplit => ({
      player_id: parseIntOrNull(row.player_id) as number, // Assuming player_id is non-null after filter
      season: parseIntOrNull(row.season) as number, // Should be 0, assuming non-null after filter
      player_type: row.player_type as 'batter' | 'pitcher', // Asserting type from CSV
      vs_handedness: row.vs_handedness as 'L' | 'R', // Asserting type from CSV
      player_name: row.player_name || null,
      pa: parseIntOrNull(row.total_pa), // from weighted_player_stats.csv
      ab: null, // Not in weighted_player_stats.csv
      ba: null, // Not directly calculated as weighted_ba, but could be derived if needed. For now, null.
      obp: parseFloatOrNull(row.weighted_obp),
      slg: parseFloatOrNull(row.weighted_slg),
      woba: parseFloatOrNull(row.weighted_woba),
      xwoba: parseFloatOrNull(row.weighted_xwoba),
      xba: parseFloatOrNull(row.weighted_xba),
      xobp: parseFloatOrNull(row.weighted_xobp),
      xslg: parseFloatOrNull(row.weighted_xslg),
      iso: parseFloatOrNull(row.weighted_iso),
      babip: parseFloatOrNull(row.weighted_babip),
      barrels: parseIntOrNull(row.weighted_barrels), // Weighted count, maps to integer 'barrels'
      barrels_per_pa: parseFloatOrNull(row.weighted_barrels_per_pa),
      hard_hit_pct: parseFloatOrNull(row.weighted_hard_hit_pct),
      avg_exit_velocity: parseFloatOrNull(row.weighted_avg_exit_velocity),
      max_exit_velocity: null, // Not in weighted_player_stats.csv
      avg_launch_angle: parseFloatOrNull(row.weighted_avg_launch_angle),
      hrs: parseIntOrNull(row.weighted_hrs), // Weighted count, maps to integer 'hrs'
      swing_miss_percent: parseFloatOrNull(row.weighted_swing_miss_percent),
      hyper_speed: parseFloatOrNull(row.weighted_hyper_speed),

      // These are not typically part of weighted averages in this context
      groundball_pct: null, // Not in weighted_player_stats.csv
      line_drive_pct: null,
      flyball_pct: null,

      // Add missing properties for PlayerSplit
      k_percent: parseFloatOrNull(row.weighted_k_percent), // Read from weighted_player_stats.csv
      bb_percent: parseFloatOrNull(row.weighted_bb_percent), // Read from weighted_player_stats.csv

      last_updated: new Date().toISOString(),
    })).filter((record): record is PlayerSplit => // Type guard for weighted stats
      record.player_id !== null &&
      record.season === 0 && // Ensure we are only processing season 0 records
      (record.player_type === 'batter' || record.player_type === 'pitcher') &&
      (record.vs_handedness === 'L' || record.vs_handedness === 'R')
    );

    if (recordsToUpsert.length > 0) {
      console.log(`  ⏳ Upserting ${recordsToUpsert.length} records from ${WEIGHTED_STATS_CSV_FILENAME} to Supabase table "${SUPABASE_TABLE_NAME}"...`);
      const { error: upsertError } = await supabase
        .from(SUPABASE_TABLE_NAME)
        .upsert(recordsToUpsert, { onConflict: 'player_id,season,player_type,vs_handedness' });

      if (upsertError) {
        console.error(`  ❌ Supabase upsert error for ${WEIGHTED_STATS_CSV_FILENAME}:`, upsertError.message);
      } else {
        console.log(`  ✅ Successfully upserted ${recordsToUpsert.length} records from ${WEIGHTED_STATS_CSV_FILENAME}.`);
      }
    } else {
      console.log(`  ℹ️ No valid records (with season 0) to upsert from ${WEIGHTED_STATS_CSV_FILENAME}.`);
    }
  } catch (fileError) {
    console.error(`  ❌ Error reading or processing file ${WEIGHTED_STATS_CSV_FILENAME}:`, fileError);
  }
}

// --- Main Execution ---
async function main() {
  try {
    if (process.argv.includes('--weighted')) {
      await processAndUploadWeightedStats();
    } else {
      await processAndUploadSavantCsvs();
    }
    console.log('\n🎉 Script finished.');
  } catch (error) {
    console.error('🔴 An unexpected error occurred during script execution:', error);
    process.exit(1);
  }
}

main();