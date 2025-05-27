/* eslint-disable @typescript-eslint/no-explicit-any */
// src/pages/api/matchups.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseServer } from '@/lib/supabaseServerClient';
import { Matchup } from '@/types/player.types';

type ErrorResponse = { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Matchup[] | ErrorResponse>
) {
  try {
    // 1. Determine date
    const dateParam = typeof req.query.date === 'string' ? req.query.date : null;
    const today     = new Date().toISOString().slice(0, 10);
    const gameDate  = dateParam || today;

    // 2. Pull every field we need for grouping & display
    const { data, error } = await supabaseServer
      .from('daily_matchups')
      .select(`
        game_pk,
        batter_id,
        batter_name,
        batter_team,
        lineup_position,
        pitcher_id,
        pitcher_name,
        pitcher_team,
        avg_xwoba,
        avg_launch_angle,
        avg_barrels_per_pa,
        avg_hard_hit_pct,
        avg_exit_velocity,
        game_home_team_abbreviation,
        game_away_team_abbreviation
      `)
      .eq('game_date', gameDate)
      .order('avg_xwoba', { ascending: false });

    if (error) {
      console.error('Error querying matchups:', error);
      return res.status(500).json({ error: error.message });
    }

    // 3. Return as our Matchup[] shape
    return res.status(200).json((data ?? []) as Matchup[]);
  } catch (err: unknown) {
    console.error('Unexpected error in /api/matchups:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return res.status(500).json({ error: message });
  }
}
