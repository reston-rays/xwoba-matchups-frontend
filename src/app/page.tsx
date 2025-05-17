/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/page.tsx
'use client';

import React, { useEffect, useState } from 'react';

type Matchup = {
  batter_name: string;
  pitcher_name: string;
  avg_xwoba: number;
};

export default function HomePage() {
  const [matchups, setMatchups] = useState<Matchup[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMatchups = async () => {
      setError(null);
      try {
        const today = new Date().toISOString().slice(0, 10);
        const res = await fetch(`/api/matchups?date=${today}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: Matchup[] = await res.json();
        setMatchups(data);
      } catch (err: any) {
        console.error('Failed to load matchups', err);
        setError(err.message || 'Unknown error');
        setMatchups([]);
      }
    };

    fetchMatchups();
  }, []);

  if (error) {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-bold mb-4">Top xwOBA Matchups</h1>
        <div className="text-red-600">Error loading matchups: {error}</div>
      </main>
    );
  }

  if (matchups === null) {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-bold mb-4">Top xwOBA Matchups</h1>
        <div>Loading...</div>
      </main>
    );
  }

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">Top xwOBA Matchups Today</h1>
      {matchups.length === 0 ? (
        <div>No matchups found for today.</div>
      ) : (
        <table className="min-w-full table-auto border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-4 py-2 text-left">#</th>
              <th className="px-4 py-2 text-left">Batter</th>
              <th className="px-4 py-2 text-left">Pitcher</th>
              <th className="px-4 py-2 text-right">Avg xwOBA</th>
            </tr>
          </thead>
          <tbody>
            {matchups.map((m, idx) => (
              <tr key={`${m.batter_name}-${m.pitcher_name}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-4 py-2">{idx + 1}</td>
                <td className="px-4 py-2">{m.batter_name}</td>
                <td className="px-4 py-2">{m.pitcher_name}</td>
                <td className="px-4 py-2 text-right">{m.avg_xwoba.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
