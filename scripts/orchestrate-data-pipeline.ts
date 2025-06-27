// scripts/orchestrate-data-pipeline.ts

import { execa } from 'execa';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCRIPT_DIR = __dirname;
const PROJECT_ROOT = path.resolve(__dirname, '..'); // Assuming scripts are in project_root/scripts

const API_BASE_URL = 'http://localhost:3000/api'; // Adjust if your app runs on a different host/port

async function runScript(scriptName: string, args: string[] = []) {
  const scriptPath = path.join(SCRIPT_DIR, scriptName);
  console.log(`\n🚀 Running script: ${scriptName} ${args.join(' ')}`);
  try {
    const { stdout, stderr } = await execa('tsx', [scriptPath, ...args], {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
    });
    console.log(`✅ Script ${scriptName} finished successfully.`);
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
  } catch (error: any) {
    console.error(`❌ Script ${scriptName} failed:`, error.message);
    console.error('  Stderr:', error.stderr);
    console.error('  Stdout:', error.stdout);
    process.exit(1);
  }
}

async function callApiEndpoint(endpoint: string) {
  const url = `${API_BASE_URL}/${endpoint}`;
  console.log(`\n🌐 Calling API endpoint: ${url}`);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! Status: ${response.status}, Body: ${errorText}`);
    }
    const data = await response.json();
    console.log(`✅ API call to ${endpoint} successful. Response:`, JSON.stringify(data, null, 2));
  } catch (error: any) {
    console.error(`❌ API call to ${endpoint} failed:`, error.message);
    process.exit(1);
  }
}

async function main() {
  console.log('Starting data pipeline orchestration...');

  // 1. Populate static data (teams, venues, players) - run less frequently
  await runScript('populate-static-data.ts');

  // 2. Fetch raw Savant stats CSVs
  const currentYear = new Date().getFullYear();
  await runScript('fetch-savant-stats.ts', ['--season', currentYear.toString()]);

  // 3. Upload raw Savant CSVs to Supabase
  await runScript('update-savant-csvs-to-supabase.ts');

  // 4. Create weighted average player data CSV
  await runScript('create-average-player-data.ts');

  // 5. Upload weighted average player data CSV to Supabase
  await runScript('update-savant-csvs-to-supabase.ts', ['--weighted']);

  // 6. Call API to add games (updates game schedule and probable pitchers)
  await callApiEndpoint('add-games');

  // 7. Call API to ingest data (calculates and upserts daily matchups)
  await callApiEndpoint('ingest');

  console.log('\n🎉 Data pipeline orchestration completed successfully!');
}

main().catch(error => {
  console.error('\n🔴 An unexpected error occurred during orchestration:', error);
  process.exit(1);
});