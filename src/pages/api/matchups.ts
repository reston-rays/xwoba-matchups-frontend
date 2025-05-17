/* eslint-disable @typescript-eslint/no-explicit-any */
// src/pages/api/matchups.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseServer } from '@/lib/supabaseServerClient';

type Matchup = {
  batter_name: string;
  pitcher_name: string;
  avg_xwoba: number;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Allow ?date=YYYY-MM-DD, default to today
    const dateParam = typeof req.query.date === 'string' ? req.query.date : null;
    const today = new Date().toISOString().slice(0, 10);
    const gameDate = dateParam || today;

    // Fetch top matchups for that date
    const { data, error } = await supabaseServer
      .from<Matchup>('daily_matchups')
      .select('batter_name, pitcher_name, avg_xwoba')
      .eq('game_date', gameDate)
      .order('avg_xwoba', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error querying matchups:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json(data ?? []);
  } catch (err: any) {
    console.error('Unexpected error in /api/matchups:', err);
    return res.status(500).json({ error: err.message });
  }
}
