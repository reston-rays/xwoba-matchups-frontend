// scripts/compute-weighted-stats.ts

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import Papa from 'papaparse';
import path from 'path';
import { fileURLToPath } from 'url';
import { PlayerSplit } from '../src/types/player.types'; // Adjust path if needed

// --- File Path Setup ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

// --- Configuration ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const OUTPUT_CSV_PATH = path.resolve(path.join(__dirname, 'savant_csv_output', 'weighted_player_stats.csv'));
const SUPABASE_TABLE_NAME = 'player_splits'; // Adjust if your table name is different

// Define season weights (e.g., 50% for 2025, 30% for 2024, 20% for 2023)
// These are the 'recencyWeights' for the computeWeightedStats function.
const SEASON_WEIGHTS: Record<number, number> = {
  2025: 0.50,
  2024: 0.30,
  2023: 0.20,
  // Add more seasons and weights as needed. Ensure they sum to 1 if that's the assumption of your weighting logic.
  // The provided computeWeightedStats function normalizes by sum of (recencyWeight * pa),
  // so the sum of SEASON_WEIGHTS themselves doesn't strictly need to be 1, but it's a common convention.
};

const SEASONS_TO_CONSIDER = Object.keys(SEASON_WEIGHTS).map(Number);

// Interface for the data structure expected by computeWeightedStats
interface SeasonStatInput {
  season: number;
  pa: number;
  woba: number;
  xwoba: number;
  hardHitPct: number;   // expressed as 0–1 (e.g. 0.20 for 20%)
  avg_launch_angle: number;
  avg_exit_velocity: number;
  barrels_per_pa: number;   // expressed as 0–1 (e.g. 0.05)
}

// Interface for the output of computeWeightedStats
interface ComputedWeightedStats {
  weightedWoba: number;
  weightedXwoba: number;
  weightedHardHitPct: number;
  weightedAvgLaunchAngle: number;
  weightedAvgExitVelocity: number;
  weightedBarrelsPerPa: number;
  totalPA: number; // Adding this to capture sumWeight
}

// Interface for the rows to be written to the CSV
interface WeightedCsvRow {
  player_id: number;
  player_name: string | null;
  player_type: 'batter' | 'pitcher';
  vs_handedness: 'L' | 'R';
  season: 0; // to represent weighted data
  season_descriptor: string;
  weighted_woba: number | null;
  weighted_xwoba: number | null;
  weighted_hard_hit_pct: number | null;
  weighted_avg_launch_angle: number | null;
  weighted_avg_exit_velocity: number | null;
  weighted_barrels_per_pa: number | null;
  total_pa: number | null;
  contributing_seasons: string; // e.g., "2024,2023"
  last_updated: string;
}

/**
 * Compute a combined recency × volume weighted average of two rate stats.
 * @param data Array of per‐season stats
 * @param recencyWeights Map from season → recency weight (must sum to 1)
 */
function computeWeightedStats(
  data: SeasonStatInput[],
  recencyWeights: Record<number, number>
): ComputedWeightedStats {
  let sumWeight = 0;
  let sumW = 0;
  let sumXw = 0;
  let sumHH = 0;
  let sumLaunch = 0;
  let sumExit = 0;
  let sumBarrelsPPA = 0;
  let sumPA = 0;

  for (const { season, pa, woba, xwoba, hardHitPct, avg_launch_angle, avg_exit_velocity, barrels_per_pa } of data) {
    const rw = recencyWeights[season] ?? 0;
    const w = rw * pa;
    sumWeight += w;
    sumW += w * woba;
    sumXw += w * xwoba;
    sumHH += w * hardHitPct;
    sumLaunch += w * avg_launch_angle;
    sumExit += w * avg_exit_velocity;
    sumBarrelsPPA += w * barrels_per_pa;
    sumPA += pa; // Total plate appearances for this player
  }

  if (sumWeight === 0) {
    // Return an object with nulls or specific values indicating no valid data/weight
    // This allows the calling function to handle it gracefully (e.g., by skipping the row or logging)
    // instead of crashing the whole script.
    return {
        weightedWoba: NaN, // Or null, depending on how you want to represent this in CSV
        weightedXwoba: NaN,
        weightedHardHitPct: NaN,
        weightedAvgLaunchAngle: NaN,
        weightedAvgExitVelocity: NaN,
        weightedBarrelsPerPa: NaN,
        totalPA: 0,
    };
  }

  return {
    weightedWoba: sumW / sumWeight,
    weightedXwoba: sumXw / sumWeight,
    weightedHardHitPct: sumHH / sumWeight,
    weightedAvgLaunchAngle: sumLaunch / sumWeight,
    weightedAvgExitVelocity: sumExit / sumWeight,
    weightedBarrelsPerPa: sumBarrelsPPA / sumWeight,
    totalPA: sumPA, // Total plate appearances across all seasons
  };
}

// ────────────────────────────────────────────────────────────────────────────────
// Example usage on your sample player
// ────────────────────────────────────────────────────────────────────────────────
/*
const seasons: SeasonStatInput[] = [
  { season: 2025, pa: 100, woba: 0.300, xwoba: 0.325, hardHitPct: 0.20, avg_launch_angle: 10.0, avg_exit_velocity: 90, barrels_per_pa: 0.05 },
  { season: 2024, pa: 300, woba: 0.290, xwoba: 0.300, hardHitPct: 0.185, avg_launch_angle: 12.5, avg_exit_velocity: 92, barrels_per_pa: 0.04 }, 
  { season: 2023, pa: 350, woba: 0.320, xwoba: 0.310, hardHitPct: 0.19, avg_launch_angle: 15.0, avg_exit_velocity: 88, barrels_per_pa: 0.06 }
];

try {
  const { weightedWoba, weightedXwoba, weightedHardHitPct, weightedAvgLaunchAngle, weightedAvgExitVelocity, weightedBarrelsPerPa, totalPA } = computeWeightedStats(seasons, SEASON_WEIGHTS);

  console.log(`🔹 Weighted wOBA:      ${weightedWoba.toFixed(4)}`);
  console.log(`🔹 Weighted xwOBA:     ${weightedXwoba.toFixed(4)}`);      // ~0.3093
  console.log(`🔹 Weighted Hard Hit%: ${(weightedHardHitPct * 100).toFixed(2)}%`); // ~19.02%
  console.log(`🔹 Weighted Launch Angle: ${(weightedAvgLaunchAngle).toFixed(2)}`);
  console.log(`🔹 Weighted Exit Velocity: ${(weightedAvgExitVelocity).toFixed(2)}`); // ~90
  console.log(`🔹 Weighted Barrels/PA: ${(weightedBarrelsPerPa).toFixed(2)}`); //
  console.log(`🔹 Total PA: ${totalPA}`); // Total plate appearances across all seasons

} catch (err) {
  console.error(err);
  process.exit(1);
}
*/

function getSeasonDescriptor(): string {
  return "WEIGHTED_AVG_" + Object.entries(SEASON_WEIGHTS)
    .map(([s, w]) => `${s}_${Math.round(w * 100)}`)
    .sort()
    .join('_');
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Supabase URL or Service Role Key is not defined. Check your .env file.');
    process.exit(1);
  }

  const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  console.log('Supabase client initialized.');

  console.log(`Fetching all player_splits data for seasons: ${SEASONS_TO_CONSIDER.join(', ')}...`);
  let allSplitsData: PlayerSplit[] = [];
  let fetchError: any = null;
  let page = 0;
  const pageSize = 1000; // Supabase default limit

  while (true) {
    const { data: pageData, error: pageError, count } = await supabase
      .from('player_splits')
      .select('*', { count: 'exact' })
      .in('season', SEASONS_TO_CONSIDER)
      .range(page * pageSize, (page + 1) * pageSize - 1) as { data: PlayerSplit[] | null, error: any, count: number | null };

    if (pageError) {
      fetchError = pageError;
      break;
    }

    if (pageData) {
      allSplitsData = allSplitsData.concat(pageData);
    }

    if (!pageData || pageData.length < pageSize) {
      break; // No more data or last page fetched
    }
    page++;
    console.log(`Fetched page ${page}, ${allSplitsData.length} records so far...`);
  }

  if (fetchError) {
    console.error('Error fetching data from Supabase:', fetchError);
    process.exit(1);
  }

  if (!allSplitsData || allSplitsData.length === 0) {
    console.log('No player splits found for the specified seasons. Exiting.');
    return;
  }
  console.log(`Fetched ${allSplitsData.length} records.`);

  const groupedSplits = new Map<string, PlayerSplit[]>();
  for (const split of allSplitsData) {
    const key = `${split.player_id}-${split.player_type}-${split.vs_handedness}`;
    if (!groupedSplits.has(key)) {
      groupedSplits.set(key, []);
    }
    groupedSplits.get(key)!.push(split);
  }
  console.log(`Grouped splits into ${groupedSplits.size} unique player-type-handedness combinations.`);

  const weightedCsvRows: WeightedCsvRow[] = [];
  const seasonDescriptor = getSeasonDescriptor();

  for (const [_groupKey, splitsInGroup] of groupedSplits.entries()) {
    if (splitsInGroup.length === 0) continue;

    const { player_id, player_type, vs_handedness } = splitsInGroup[0];
    const playerName = splitsInGroup.sort((a,b) => b.season - a.season).find(s => s.player_name)?.player_name || null;

    const seasonStatsForCalc: SeasonStatInput[] = [];
    const contributingSeasonsSet = new Set<number>();

    for (const split of splitsInGroup) {
      if (
        typeof split.pa === 'number' && split.pa > 0 && // PA must be positive
        SEASON_WEIGHTS[split.season] !== undefined && // Season must have a weight defined
        typeof split.woba === 'number' &&
        typeof split.xwoba === 'number' &&
        typeof split.hard_hit_pct === 'number' &&
        typeof split.avg_launch_angle === 'number' &&
        typeof split.avg_exit_velocity === 'number' &&
        typeof split.barrels_per_pa === 'number'
      ) {
        seasonStatsForCalc.push({
          season: split.season,
          pa: split.pa,
          woba: split.woba,
          xwoba: split.xwoba,
          hardHitPct: split.hard_hit_pct, // DB stores as 0.xxxx
          avg_launch_angle: split.avg_launch_angle,
          avg_exit_velocity: split.avg_exit_velocity,
          barrels_per_pa: split.barrels_per_pa, // DB stores as 0.xxxx
        });
        contributingSeasonsSet.add(split.season);
      }
    }

    if (seasonStatsForCalc.length > 0) {
      const computed = computeWeightedStats(seasonStatsForCalc, SEASON_WEIGHTS);

      if (computed.totalPA > 0 && !isNaN(computed.weightedXwoba)) { // Check if computation was valid
        weightedCsvRows.push({
          player_id,
          player_name: playerName,
          player_type,
          vs_handedness,
          season: 0, // This is a weighted average, so we use 0 to indicate that
          season_descriptor: seasonDescriptor,
          weighted_woba: computed.weightedWoba,
          weighted_xwoba: computed.weightedXwoba,
          weighted_hard_hit_pct: computed.weightedHardHitPct,
          weighted_avg_launch_angle: computed.weightedAvgLaunchAngle,
          weighted_avg_exit_velocity: computed.weightedAvgExitVelocity,
          weighted_barrels_per_pa: computed.weightedBarrelsPerPa,
          total_pa: computed.totalPA,
          contributing_seasons: Array.from(contributingSeasonsSet).sort((a,b) => b-a).join(','),
          last_updated: new Date().toISOString(),
        });
      } else {
        console.warn(`Skipping player ${player_id} (${player_type} vs ${vs_handedness}) due to zero total weight or invalid computed stats.`);
      }
    }
  }

  if (weightedCsvRows.length === 0) {
    console.log('No weighted stats generated. Exiting.');
    return;
  }

  console.log(`Generated ${weightedCsvRows.length} weighted stat lines.`);

  const headers = Object.keys(weightedCsvRows[0]);
  const csvString = Papa.unparse({
    fields: headers,
    data: weightedCsvRows,
  });

  try {
    await fs.writeFile(OUTPUT_CSV_PATH, csvString);
    console.log(`Successfully wrote weighted player stats to: ${OUTPUT_CSV_PATH}`);
  } catch (writeError) {
    console.error(`Error writing CSV file to ${OUTPUT_CSV_PATH}:`, writeError);
  }
}

main().catch(error => {
  console.error('Unhandled error in main function:', error);
  process.exit(1);
});