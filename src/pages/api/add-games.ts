/* eslint-disable @typescript-eslint/no-explicit-any */
// src/pages/api/add-games.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseServer } from '@/lib/supabaseServerClient';

import { Game } from '@/types/database'; // Import the Game interface

// Re-using the fetchWithRetry utility from ingest.ts
const fetchWithRetry = async (url: string, retries = 3): Promise<any> => {
  for (let i = 1; i <= retries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
      console.log(`Fetch success: ${url}`);
      return res.json();
    } catch (err) {
      console.error(`Fetch ${url} (attempt ${i}) failed:`, err);
      if (i === retries) throw err;
      await new Promise(resolve => setTimeout(resolve, 1000 * i)); // Exponential backoff
    }
  }
  // Should not be reached if retries are exhausted and an error is thrown
  throw new Error(`Failed to fetch ${url} after multiple retries.`);
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
    log('🚀 Starting add-games script...');

    // Use a Map to store games, ensuring uniqueness by game_pk
    const gamesMap = new Map<number, Omit<Game, 'last_updated'>>();
    const today = new Date();

    for (let i = 0; i < 8; i++) { // Today + next 7 days
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + i);
      const dateString = targetDate.toISOString().slice(0, 10);

      log(`🗓️ Fetching schedule for date: ${dateString}`);

      const scheduleApiUrl = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&hydrate=lineups,probablePitcher(All)&date=${dateString}`;
      const scheduleData: any = await fetchWithRetry(scheduleApiUrl);

      const gamesForDate: any[] = scheduleData.dates?.[0]?.games || [];

      if (!gamesForDate.length) {
        log(`⏭️ No games found for ${dateString}`);
        continue;
      }
      log(`🏟️ Found ${gamesForDate.length} games for ${dateString}`);

      // Log game_pks for the current date
      const gamePksForDate = gamesForDate.map((g: any) => g.gamePk).filter(Boolean);
      log(`🔢 Game PKs for ${dateString}: [${gamePksForDate.join(', ')}]`);


      gamesForDate.forEach((apiGame: any) => {
        if (!apiGame.gamePk || !apiGame.teams?.away?.team?.id || !apiGame.teams?.home?.team?.id || !apiGame.venue?.id) {
          log(`⚠️ Skipping game due to missing critical data: ${JSON.stringify(apiGame)}`);
          return;
        }

        const awayBattingOrder = apiGame.lineups?.awayPlayers
          ?.map((player: any) => player.id)
          .filter((id: number | undefined) => id != null) as number[] | null
          || null;
        const homeBattingOrder = apiGame.lineups?.homePlayers
          ?.map((player: any) => player.id)
          .filter((id: number | undefined) => id != null) as number[] | null
          || null;

        const gameRecord: Omit<Game, 'last_updated'> = {
          game_pk: apiGame.gamePk,
          official_date: apiGame.officialDate, // YYYY-MM-DD
          game_datetime_utc: apiGame.gameDate, // ISO timestamp
          detailed_state: apiGame.status?.detailedState || 'Unknown',
          away_team_id: apiGame.teams.away.team.id,
          home_team_id: apiGame.teams.home.team.id,
          venue_id: apiGame.venue.id,
          away_batting_order: awayBattingOrder || null,
          home_batting_order: homeBattingOrder || null,
          home_team_probable_pitcher_id: apiGame.teams.home.probablePitcher?.id || null,
          away_team_probable_pitcher_id: apiGame.teams.away.probablePitcher?.id || null
        };
        // If a game with the same game_pk is encountered again, it will overwrite the previous one in the Map.
        // This ensures we only have the latest version if duplicates exist across date fetches.
        gamesMap.set(gameRecord.game_pk, gameRecord);
      });
    }

    const uniqueGamesToUpsert = Array.from(gamesMap.values());

    if (uniqueGamesToUpsert.length > 0) {
      log(`💾 Preparing to upsert ${uniqueGamesToUpsert.length} unique game records into 'games' table...`);
      const { error: upsertError } = await supabaseServer
        .from('games')
        .upsert(uniqueGamesToUpsert, { onConflict: 'game_pk' });

      if (upsertError) {
        log(`❌ Error upserting games: ${upsertError.message}`);
        console.error('Upsert error details:', upsertError);
        throw upsertError;
      }
      log(`✅ Successfully upserted/updated ${uniqueGamesToUpsert.length} game records.`);
    } else {
      log('🤷 No game records to upsert.');
    }

    const result: any = { success: true, gamesProcessed: uniqueGamesToUpsert.length };
    if (req?.query?.debug === 'true') result.logs = logs; // Use optional chaining for req
    return res.status(200).json(result);

  } catch (err: any) {
    log(`💥 An error occurred: ${err.message}`);
    console.error('Add-games script error:', err);
    return res.status(500).json({ error: err.message, logs });
  }
}