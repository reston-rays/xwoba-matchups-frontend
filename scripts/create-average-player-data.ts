// scripts/create-average-player-data.ts

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import Papa from 'papaparse';
import path from 'path';
import { fileURLToPath } from 'url';
import { PlayerSplit } from '../src/types/database'; // Adjust path if needed

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
  2025: 0.40,
  2024: 0.30,
  2023: 0.20,
  2022: 0.10,
  // Add more seasons and weights as needed. Ensure they sum to 1 if that's the assumption of your weighting logic.
  // The provided computeWeightedStats function normalizes by sum of (recencyWeight * pa),
  // so the sum of SEASON_WEIGHTS themselves doesn't strictly need to be 1, but it's a common convention.
};

const SEASONS_TO_CONSIDER = Object.keys(SEASON_WEIGHTS).map(Number);

// Define the keys from PlayerSplit that are needed for weighted calculation
type WeightedStatCalculationKeys =
  | 'season'
  | 'pa'
  | 'obp'
  | 'slg'
  | 'woba'
  | 'xwoba'
  | 'xba'
  | 'xobp'
  | 'xslg'
  | 'iso'
  | 'babip'
  | 'barrels'
  | 'hard_hit_pct'
  | 'avg_launch_angle'
  | 'avg_exit_velocity'
  | 'swing_miss_percent'
  | 'hyper_speed'
  | 'hrs'
  | 'barrels_per_pa';

// This type represents the data structure required by computeWeightedStats,
// derived from PlayerSplit fields and ensuring they are non-nullable.
// This effectively replaces the old SeasonStatInput interface.
type SeasonStatInput = {
  [K in WeightedStatCalculationKeys]: NonNullable<PlayerSplit[K]>;
};

// Interface for the output of computeWeightedStats
interface ComputedWeightedStats {
  weightedObp: number;
  weightedSlg: number;
  weightedWoba: number;
  weightedXwoba: number;
  weightedXba: number;
  weightedXobp: number;
  weightedXslg: number;
  weightedIso: number;
  weightedBabip: number;
  weightedBarrels: number; // Weighted count
  weightedHardHitPct: number;
  weightedAvgLaunchAngle: number;
  weightedAvgExitVelocity: number;
  weightedSwingMissPercent: number;
  weightedHyperSpeed: number;
  weightedBarrelsPerPa: number;
  weightedHrs: number; // Weighted count
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
  weighted_obp: number | null;
  weighted_slg: number | null;
  weighted_woba: number | null;
  weighted_xwoba: number | null;
  weighted_xba: number | null;
  weighted_xobp: number | null;
  weighted_xslg: number | null;
  weighted_iso: number | null;
  weighted_babip: number | null;
  weighted_barrels: number | null;
  weighted_hard_hit_pct: number | null;
  weighted_avg_launch_angle: number | null;
  weighted_avg_exit_velocity: number | null;
  weighted_swing_miss_percent: number | null;
  weighted_hyper_speed: number | null;
  weighted_barrels_per_pa: number | null;
  weighted_hrs: number | null;
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
  let sumPA = 0;

  let sumObp = 0;
  let sumSlg = 0;
  let sumWoba = 0;
  let sumXwoba = 0;
  let sumXba = 0;
  let sumXobp = 0;
  let sumXslg = 0;
  let sumIso = 0;
  let sumBabip = 0;
  let sumBarrels = 0;
  let sumHardHitPct = 0;
  let sumAvgLaunchAngle = 0;
  let sumAvgExitVelocity = 0;
  let sumSwingMissPercent = 0;
  let sumHyperSpeed = 0;
  let sumBarrelsPPA = 0;
  let sumHrs = 0;

  for (const stat of data) {
    const rw = recencyWeights[stat.season] ?? 0;
    const w = rw * stat.pa;
    sumWeight += w;

    sumObp += w * stat.obp;
    sumSlg += w * stat.slg;
    sumWoba += w * stat.woba;
    sumXwoba += w * stat.xwoba;
    sumXba += w * stat.xba;
    sumXobp += w * stat.xobp;
    sumXslg += w * stat.xslg;
    sumIso += w * stat.iso;
    sumBabip += w * stat.babip;
    sumBarrels += w * stat.barrels;
    sumHardHitPct += w * stat.hard_hit_pct;
    sumAvgLaunchAngle += w * stat.avg_launch_angle;
    sumAvgExitVelocity += w * stat.avg_exit_velocity;
    sumSwingMissPercent += w * stat.swing_miss_percent;
    sumHyperSpeed += w * stat.hyper_speed;
    sumBarrelsPPA += w * stat.barrels_per_pa;
    sumHrs += w * stat.hrs;

    sumPA += stat.pa; // Total plate appearances for this player
  }

  if (sumWeight === 0) {
    return {
        weightedObp: NaN,
        weightedSlg: NaN,
        weightedWoba: NaN,
        weightedXwoba: NaN,
        weightedXba: NaN,
        weightedXobp: NaN,
        weightedXslg: NaN,
        weightedIso: NaN,
        weightedBabip: NaN,
        weightedBarrels: NaN,
        weightedHardHitPct: NaN,
        weightedAvgLaunchAngle: NaN,
        weightedAvgExitVelocity: NaN,
        weightedSwingMissPercent: NaN,
        weightedHyperSpeed: NaN,
        weightedBarrelsPerPa: NaN,
        weightedHrs: NaN,
        totalPA: 0,
    };
  }

  return {
    weightedWoba: sumWoba / sumWeight,
    weightedXwoba: sumXwoba / sumWeight,
    weightedObp: sumObp / sumWeight,
    weightedSlg: sumSlg / sumWeight,
    weightedXba: sumXba / sumWeight,
    weightedXobp: sumXobp / sumWeight,
    weightedXslg: sumXslg / sumWeight,
    weightedIso: sumIso / sumWeight,
    weightedBabip: sumBabip / sumWeight,
    weightedBarrels: sumBarrels / sumWeight,
    weightedHardHitPct: sumHardHitPct / sumWeight,
    weightedAvgLaunchAngle: sumAvgLaunchAngle / sumWeight,
    weightedAvgExitVelocity: sumAvgExitVelocity / sumWeight,
    weightedSwingMissPercent: sumSwingMissPercent / sumWeight,
    weightedHyperSpeed: sumHyperSpeed / sumWeight,
    weightedBarrelsPerPa: sumBarrelsPPA / sumWeight,
    weightedHrs: sumHrs / sumWeight,
    totalPA: sumPA, // Total plate appearances across all seasons
  };
}

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

    const seasonStatsForCalc: SeasonStatInput[] = []; // Now uses the new SeasonStatInput type
    const contributingSeasonsSet = new Set<number>();

    for (const split of splitsInGroup) {
      if (
        typeof split.pa === 'number' && split.pa > 0 && // PA must be positive
        SEASON_WEIGHTS[split.season] !== undefined && // Season must have a weight defined
        typeof split.obp === 'number' &&
        typeof split.slg === 'number' &&
        typeof split.woba === 'number' &&
        typeof split.xwoba === 'number' &&
        typeof split.xba === 'number' &&
        typeof split.xobp === 'number' &&
        typeof split.xslg === 'number' &&
        typeof split.iso === 'number' &&
        typeof split.babip === 'number' &&
        typeof split.barrels === 'number' &&
        typeof split.hard_hit_pct === 'number' &&
        typeof split.avg_launch_angle === 'number' &&
        typeof split.avg_exit_velocity === 'number' &&
        typeof split.swing_miss_percent === 'number' &&
        typeof split.hyper_speed === 'number' &&
        typeof split.barrels_per_pa === 'number' &&
        typeof split.hrs === 'number'
      ) {
        seasonStatsForCalc.push({
          season: split.season, // Already number
          pa: split.pa as number, // Known to be number due to typeof check
          obp: split.obp as number,
          slg: split.slg as number,
          woba: split.woba as number, // Known to be number
          xwoba: split.xwoba as number, // Known to be number
          xba: split.xba as number,
          xobp: split.xobp as number,
          xslg: split.xslg as number,
          iso: split.iso as number,
          babip: split.babip as number,
          barrels: split.barrels as number,
          hard_hit_pct: split.hard_hit_pct as number, // Use PlayerSplit field name, known to be number
          avg_launch_angle: split.avg_launch_angle as number, // Known to be number
          avg_exit_velocity: split.avg_exit_velocity as number, // Known to be number
          swing_miss_percent: split.swing_miss_percent as number,
          hyper_speed: split.hyper_speed as number,
          barrels_per_pa: split.barrels_per_pa as number, // Known to be number
          hrs: split.hrs as number,
        } as SeasonStatInput); // Assert as SeasonStatInput to satisfy TypeScript
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
          weighted_obp: computed.weightedObp,
          weighted_slg: computed.weightedSlg,
          weighted_woba: computed.weightedWoba,
          weighted_xwoba: computed.weightedXwoba,
          weighted_xba: computed.weightedXba,
          weighted_xobp: computed.weightedXobp,
          weighted_xslg: computed.weightedXslg,
          weighted_iso: computed.weightedIso,
          weighted_babip: computed.weightedBabip,
          weighted_barrels: computed.weightedBarrels,
          weighted_hard_hit_pct: computed.weightedHardHitPct,
          weighted_avg_launch_angle: computed.weightedAvgLaunchAngle,
          weighted_avg_exit_velocity: computed.weightedAvgExitVelocity,
          weighted_swing_miss_percent: computed.weightedSwingMissPercent,
          weighted_hyper_speed: computed.weightedHyperSpeed,
          weighted_barrels_per_pa: computed.weightedBarrelsPerPa,
          weighted_hrs: computed.weightedHrs,
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