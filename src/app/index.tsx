// src/pages/index.tsx
'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Matchup = {
  batter_name: string;
  pitcher_name: string;
  avg_xwoba: number;
};

export default function Home() {
  const [matchups, setMatchups] = useState<Matchup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    supabase
      .from<Matchup>('daily_matchups')
      .select('*')
      .order('avg_xwoba', { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        if (error) {
          setError(true);
        } else if (data) {
          setMatchups(data);
        }
        setLoading(false);
      });
  }, []);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error loading matchups</p>;

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">Top 20 xwOBA Matchups Today</h1>
      <table className="min-w-full table-auto">
        <thead>
          <tr>
            <th>Batter</th>
            <th>Pitcher</th>
            <th className="text-right">Avg xwOBA</th>
          </tr>
        </thead>
        <tbody>
          {matchups.map((m, i) => (
            <tr key={i} className="border-t">
              <td>{m.batter_name}</td>
              <td>{m.pitcher_name}</td>
              <td className="text-right">{m.avg_xwoba.toFixed(3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
