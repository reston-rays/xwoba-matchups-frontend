/* eslint-disable @typescript-eslint/no-explicit-any */
// src/pages/api/matchups.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseServer } from '@/lib/supabaseServerClient';
import { Matchup } from '@/types/player.types';
import { Game } from '@/types/database';
import { Venue } from '@/types/database';

type ErrorResponse = { error: string };

// New type to represent a Game object augmented with its matchups
export interface GamesWithMatchupsAndVenues extends Game {
  matchups: Matchup[];
  venue?: Venue; // Optional venue information if needed
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GamesWithMatchupsAndVenues[] | ErrorResponse>
) {
  try {
    // const requestLogs: string[] = [];
    const log = (message: string) => {
      // Log to server console
      console.log(`[API /api/matchups] ${message}`);
      // Optionally, accumulate logs to return in response if debugging
      // requestLogs.push(message);
    };

    // 1. Determine date
    const dateParam = typeof req.query.date === 'string' ? req.query.date : null;
    let gameDate  = dateParam;

    if (!gameDate) {
      const now = new Date();
      now.setHours(now.getHours() - 8); // Approximate PT offset (UTC-8)
      gameDate = now.toISOString().slice(0, 10);
    }
    log(`Processing request for date: ${gameDate}`);

    const { data: games, error: gamesError } = await supabaseServer
      .from('games')
      .select('*') // Specify the return type for better type safety
      .eq('official_date', gameDate)
      .order('game_datetime_utc', { ascending: true });
    log(`Fetched ${games?.length || 0} games from 'games' table.`);

    if (gamesError) {
      log(`Error querying games: ${gamesError.message}`);
      return res.status(500).json({ error: gamesError.message });
    }

    if (!games || games.length === 0) {
      log('No games found for this date. Returning empty array.');
      return res.status(200).json([]); // No games for this date
    }

    // 2. Fetch all daily matchups for the given date
    const { data: allMatchupsForDate, error: matchupsError } = await supabaseServer
      .from('daily_matchups')
      .select('*') // Specify the return type
      .eq('game_date', gameDate)
      .order('avg_xwoba', { ascending: false });
    log(`Fetched ${allMatchupsForDate?.length || 0} total matchups from 'daily_matchups' table for the date.`);

    if (matchupsError) {
      log(`Error querying matchups: ${matchupsError.message}`);
      return res.status(500).json({ error: matchupsError.message });
    }

    if (!allMatchupsForDate || allMatchupsForDate.length === 0) {
      log('No matchups found in daily_matchups for this date. All games will have empty matchup arrays.');
      // Fall through to return games with empty matchups
    }

    // 2.5 Fetch venue information for each game
    const venueIds = Array.from(new Set(games.map(game => game.venue_id)));
    const { data: venues, error: venuesError } = await supabaseServer
      .from('venues')
      .select('*')
      .in('id', venueIds);
    log(`Fetched ${venues?.length || 0} venues from 'venues' table.`);

    if (venuesError) {
      log(`Error querying venues: ${venuesError.message}`);
      return res.status(500).json({ error: venuesError.message });
    }

    if (!venues || venues.length === 0) {
      log('No venues found for the games. Venue information will be omitted.');
      // Fall through to return games without venue information
    }

    // Create a map for quick venue lookup
    const venueMap = new Map<number, Venue>();
    if (venues) {
      venues.forEach(venue => venueMap.set(venue.id, venue));
    }

    // 3. Combine games with their respective matchups
    const GamesWithMatchupsAndVenues: GamesWithMatchupsAndVenues[] = games.map((game) => {
      log(`Processing game_pk: ${game.game_pk} (type: ${typeof game.game_pk})`);
      const gameSpecificMatchups = (allMatchupsForDate || []).filter(
        (matchup) => {
          // Both matchup.game_pk and game.game_pk should be numbers if from int8 columns
          const isMatch = matchup.game_pk === game.game_pk;
          if (!isMatch && (matchup.game_pk !== undefined && game.game_pk !== undefined)) { // Log only if both are defined but don't match
            // Log detailed comparison for a specific game_pk if needed for deep debugging
            // if (game.game_pk === 777753) { // Example: focus on a known game_pk
            //   log(`  [Game ${game.game_pk}] DETAILED NO MATCH: Number(matchup.game_pk)='${Number(matchup.game_pk)}' (original matchup.game_pk='${matchup.game_pk}', type: ${typeof matchup.game_pk}) vs game.game_pk='${game.game_pk}' (type: ${typeof game.game_pk})`);
            // }
            if (game.game_pk === 777753) { // Focus on a specific game_pk you're investigating
              console.log(`  [Game 777753 Check] Matchup PK: ${matchup.game_pk} (type: ${typeof matchup.game_pk}), Game PK: ${game.game_pk} (type: ${typeof game.game_pk}), IsMatch: ${isMatch}`);
            }
          }
          return isMatch;
        }
      );
      log(`  Found ${gameSpecificMatchups.length} matchups for game_pk: ${game.game_pk}.`);
      // If you want to see the actual matchup_pks that were filtered for a specific game:
      // if (gameSpecificMatchups.length > 0) {
      //   log(`    Matchup game_pks for game ${game.game_pk}: ${gameSpecificMatchups.map(m => m.game_pk).join(', ')}`);
      // }

      const gameVenue = game.venue_id ? venueMap.get(game.venue_id) : undefined;

      return {
        ...game,
        venue: gameVenue,
        matchups: gameSpecificMatchups,
      };
    });

    return res.status(200).json(GamesWithMatchupsAndVenues);
  } catch (err: unknown) {
    console.error('[API /api/matchups] Unexpected error:', err); // Added prefix for clarity
    const message = err instanceof Error ? err.message : 'Internal server error';
    return res.status(500).json({ error: message });
  }
}
