/* eslint-disable @typescript-eslint/no-explicit-any */
// src/pages/api/matchups.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseServer } from '@/lib/supabaseServerClient';

type Matchup = {
  batter_name: string;
  pitcher_name: string;
  avg_xwoba: number;
};

type ErrorResponse = { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Matchup[] | ErrorResponse>
) {
  try {
    // 1. Determine gameDate
    const dateParam = typeof req.query.date === 'string' ? req.query.date : null;
    const today = new Date().toISOString().slice(0, 10);
    const gameDate = dateParam || today;

    // 2. Query Supabase (no generic on select)
    const { data, error } = await supabaseServer
      .from('daily_matchups')
      .select('batter_name, pitcher_name, avg_xwoba')
      .eq('game_date', gameDate)
      .order('avg_xwoba', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error querying matchups:', error);
      return res.status(500).json({ error: error.message });
    }

    // 3. Cast to our Matchup[] type
    const matchups = (data ?? []) as Matchup[];
    return res.status(200).json(matchups);
  } catch (err: unknown) {
    console.error('Unexpected error in /api/matchups:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return res.status(500).json({ error: message });
  }
}
