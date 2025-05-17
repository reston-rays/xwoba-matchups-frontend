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
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [matchups, setMatchups] = useState<Matchup[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMatchups = async () => {
      setError(null);
      setMatchups(null);
      try {
        const res = await fetch(`/api/matchups?date=${selectedDate}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: Matchup[] = await res.json();
        setMatchups(data);
      } catch (err: any) {
        console.error('Error loading matchups:', err);
        setError(err.message ?? 'Unknown error');
        setMatchups([]);
      }
    };

    fetchMatchups();
  }, [selectedDate]);

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">Top xwOBA Matchups</h1>

      {/* Date selector */}
      <label className="block mb-4">
        <span className="mr-2 font-medium">Select date:</span>
        <input
          type="date"
          value={selectedDate}
          max={today}
          onChange={e => setSelectedDate(e.target.value)}
          className="border px-2 py-1"
        />
      </label>

      {/* Error state */}
      {error && (
        <div className="text-red-600 mb-4">
          Error loading {selectedDate} matchups: {error}
        </div>
      )}

      {/* Loading state */}
      {matchups === null ? (
        <div>Loading…</div>
      ) : matchups.length === 0 ? (
        <div>No matchups found for {selectedDate}.</div>
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
              <tr
                key={`${m.batter_name}-${m.pitcher_name}`}
                className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
              >
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
