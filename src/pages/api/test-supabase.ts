/* eslint-disable @typescript-eslint/no-explicit-any */
// src/pages/api/test-supabase.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseServer } from '@/lib/supabaseServerClient';

type TestRecord = {
  game_date: string;
  batter_id: number;
  pitcher_id: number;
  avg_xwoba: number;
  batter_name: string;
  pitcher_name: string;
};

type ResponseBody = {
  data?: TestRecord[];
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseBody>
) {
  try {
    const now = new Date().toISOString().slice(0, 10);
    const testRec: TestRecord = {
      game_date: now,
      batter_id: 999999,
      pitcher_id: 888888,
      avg_xwoba: 0.123,
      batter_name: 'Test Batter',
      pitcher_name: 'Test Pitcher',
    };

    // Corrected generic usage: .from() takes only the table name,
    // and .insert<TestRecord>() takes the record type.
    const { data, error } = await supabaseServer
      .from('daily_matchups')
      .insert<TestRecord>([testRec]);

    if (error) {
      console.error('Test insert error:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ data: data || undefined });
  } catch (err: any) {
    console.error('Unexpected test insert error:', err);
    return res.status(500).json({ error: err.message });
  }
}