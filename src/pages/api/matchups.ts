/* eslint-disable @typescript-eslint/no-explicit-any */
// src/pages/api/matchups.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseServer } from '@/lib/supabaseServerClient';
import { Game, Matchup, Venue } from '@/types/database';  // :contentReference[oaicite:1]{index=1} :contentReference[oaicite:3]{index=3}

export interface GamesWithMatchupsAndVenues extends Game {
  venue?: Venue;
  home_pitcher_details?: { name: string | null; hand: 'L' | 'R' | null } | null;
  away_pitcher_details?: { name: string | null; hand: 'L' | 'R' | null } | null;
  away_team_matchups: Matchup[];
  home_team_matchups: Matchup[];
}

type ErrorResponse = { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GamesWithMatchupsAndVenues[] | ErrorResponse>
) {
  try {
    // 1. Determine date (PT‐shifted if unspecified)
    const dateParam = typeof req.query.date === 'string' ? req.query.date : null;
    let gameDate = dateParam;
    if (!gameDate) {
      const now = new Date();
      now.setHours(now.getHours() - 8); // PT offset
      gameDate = now.toISOString().slice(0, 10);
    }

    // 2. Load games
    const { data: games, error: gamesError } = await supabaseServer
      .from('games')
      .select('*')
      .eq('official_date', gameDate)
      .order('game_datetime_utc', { ascending: true });

    if (gamesError) {
      console.error('Error querying games:', gamesError);
      return res.status(500).json({ error: gamesError.message });
    }
    if (!games || games.length === 0) return res.status(200).json([]);

    // 3. Load all matchups for date
    const { data: allMatchups, error: matchupsError } = await supabaseServer
      .from('daily_matchups')
      .select('*')
      .eq('game_date', gameDate)
      .order('avg_xwoba', { ascending: false });

    if (matchupsError) {
      console.error('Error querying matchups:', matchupsError);
      return res.status(500).json({ error: matchupsError.message });
    }

    // 4. Load venue info
    const venueIds = Array.from(new Set(games.map(g => g.venue_id)));
    const { data: venues } = await supabaseServer
      .from('venues')
      .select('*')
      .in('id', venueIds);

    const venueMap = new Map<number, Venue>();
    venues?.forEach(v => venueMap.set(v.id, v));

    // 4.5 Fetch all teams to map abbreviations to IDs
    const { data: teamsData, error: teamsError } = await supabaseServer
      .from('teams')
      .select('id, abbreviation');

    if (teamsError) {
      console.error('Error querying teams for abbreviation mapping:', teamsError);
      // Continue without this mapping, fallback might not work as well
    }
    const teamAbbrToIdMap = new Map<string, number>();
    teamsData?.forEach(team => {
      if (team.abbreviation) {
        teamAbbrToIdMap.set(team.abbreviation, team.id);
      }
    });

    // 5. Fetch probable‐pitcher details from 'players' table
    const pitcherIds = new Set<number>();
    games.forEach(g => {
      if (g.home_team_probable_pitcher_id) pitcherIds.add(g.home_team_probable_pitcher_id);
      if (g.away_team_probable_pitcher_id) pitcherIds.add(g.away_team_probable_pitcher_id);
    });

    type PitcherInfo = { player_id: number; full_name: string; pitch_hand_code: 'L' | 'R' | null };
    const pitcherDetailsMap = new Map<number, { name: string | null; hand: 'L' | 'R' | null }>();
    if (pitcherIds.size) {
      const { data: playersData } = await supabaseServer
        .from('players')
        .select('player_id, full_name, pitch_hand_code')
        .in('player_id', Array.from(pitcherIds));
      playersData?.forEach(p => {
        pitcherDetailsMap.set(p.player_id, { name: p.full_name, hand: p.pitch_hand_code });
      });
    }

    // 6. Build and return combined payload
    const result: GamesWithMatchupsAndVenues[] = games.map(game => {
      // all matchups for *this* game
      const gameMatchups = (allMatchups || []).filter(m => m.game_pk === game.game_pk);
      let awayTeamMatchups: Matchup[];
      let homeTeamMatchups: Matchup[];

      // Determine Away Team Matchups (vs. Home Pitcher)
      if (game.away_batting_order && game.away_batting_order.length > 0) {
        // Lineup is published
        awayTeamMatchups = gameMatchups.filter(
          m =>
            game.away_batting_order!.includes(m.batter_id) &&
            m.pitcher_id === game.home_team_probable_pitcher_id
        );
      } else {
        // Lineup not published, use full active roster for the away team
        // Fallback: Compare batter_team (abbreviation) from matchup with game's away_team_id
        awayTeamMatchups = gameMatchups.filter(
          m => {
            const awayTeamIdFromAbbr = m.batter_team ? teamAbbrToIdMap.get(m.batter_team) : null;
            return awayTeamIdFromAbbr === game.away_team_id &&
            m.pitcher_id === game.home_team_probable_pitcher_id
          });
      }
      // Sort awayTeamMatchups: by lineup_position (nulls last), then by avg_xwoba descending
      awayTeamMatchups.sort((a, b) => {
        if (a.lineup_position !== null && b.lineup_position === null) return -1; // a comes first
        if (a.lineup_position === null && b.lineup_position !== null) return 1;  // b comes first
        if (a.lineup_position !== null && b.lineup_position !== null) {
          if (a.lineup_position !== b.lineup_position) {
            return a.lineup_position - b.lineup_position; // Sort by lineup position
          }
        }
        // If lineup_position is the same or both are null, sort by avg_xwoba descending
        return b.avg_xwoba - a.avg_xwoba;
      });



      // Determine Home Team Matchups (vs. Away Pitcher)
      if (game.home_batting_order && game.home_batting_order.length > 0) {
        homeTeamMatchups = gameMatchups.filter(
          m =>
            game.home_batting_order!.includes(m.batter_id) &&
            m.pitcher_id === game.away_team_probable_pitcher_id
        );
      } else {
        // Fallback: Compare batter_team (abbreviation) from matchup with game's home_team_id
        homeTeamMatchups = gameMatchups.filter(
          m => {
            const homeTeamIdFromAbbr = m.batter_team ? teamAbbrToIdMap.get(m.batter_team) : null;
            return homeTeamIdFromAbbr === game.home_team_id &&
            m.pitcher_id === game.away_team_probable_pitcher_id
          });
      }
      // Sort homeTeamMatchups: by lineup_position (nulls last), then by avg_xwoba descending
      homeTeamMatchups.sort((a, b) => {
        if (a.lineup_position !== null && b.lineup_position === null) return -1; // a comes first
        if (a.lineup_position === null && b.lineup_position !== null) return 1;  // b comes first
        if (a.lineup_position !== null && b.lineup_position !== null) {
          if (a.lineup_position !== b.lineup_position) {
            return a.lineup_position - b.lineup_position; // Sort by lineup position
          }
        }
        // If lineup_position is the same or both are null, sort by avg_xwoba descending
        return b.avg_xwoba - a.avg_xwoba;
      });

      return {
        ...game,
        venue: venueMap.get(game.venue_id) || undefined,
        home_pitcher_details: game.home_team_probable_pitcher_id
          ? pitcherDetailsMap.get(game.home_team_probable_pitcher_id) || null
          : null,
        away_pitcher_details: game.away_team_probable_pitcher_id
          ? pitcherDetailsMap.get(game.away_team_probable_pitcher_id) || null
          : null,
        away_team_matchups: awayTeamMatchups,
        home_team_matchups: homeTeamMatchups,
      };
    });

    return res.status(200).json(result);
  } catch (err: any) {
    console.error('Unexpected error in /api/matchups:', err);
    return res.status(500).json({ error: err.message });
  }
}
