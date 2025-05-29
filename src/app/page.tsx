// src/app/page.tsx
'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Matchup, Venue } from '@/types/database';
import { GamesWithMatchupsAndVenues } from '@/pages/api/matchups';

export default function HomePage() {
  // PT‐shifted "today"
  const getInitialDate = () => {
    const d = new Date();
    d.setHours(d.getHours() - 8);
    return d.toISOString().slice(0, 10);
  };

  const [date, setDate] = useState(getInitialDate());
  const [games, setGames] = useState<GamesWithMatchupsAndVenues[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(20);

  const fetchGames = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/matchups?date=${date}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setGames(await res.json());
    } catch (e: any) {
      setError(e.message);
      setGames([]);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  // Top overall matchups (flatten both lineups)
  const topMatchups = useMemo(() => {
    const all = games.flatMap(g => [
      ...g.away_team_matchups,
      ...g.home_team_matchups,
    ]);
    return all
      .sort((a, b) => b.avg_xwoba - a.avg_xwoba)
      .slice(0, limit);
  }, [games, limit]);

  const getGameDisplayTitle = useCallback((game: GamesWithMatchupsAndVenues): string => {
    let awayAbbr: string | null = null;
    let homeAbbr: string | null = null;

    // Attempt to get abbreviations from the first available matchup in the game.
    // The game_home_team_abbreviation and game_away_team_abbreviation
    // are properties of the game itself, stored on each matchup record.
    const firstMatchup = game.away_team_matchups?.[0] ?? game.home_team_matchups?.[0];

    if (firstMatchup) {
      awayAbbr = firstMatchup.game_away_team_abbreviation;
      homeAbbr = firstMatchup.game_home_team_abbreviation;
    }

    const awayDisplay = awayAbbr || game.away_team_id.toString();
    const homeDisplay = homeAbbr || game.home_team_id.toString();

    return `${awayDisplay} @ ${homeDisplay}`;
  }, []); // Empty dependency array as the function's logic only depends on the 'game' argument structure.

  return (
    <main className="p-6 bg-gray-900 text-gray-200 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">xwOBA Matchups</h1>

      {/* Date Picker */}
      <div className="mb-4">
        <input
          type="date"
          value={date}
          max={new Date().toISOString().slice(0, 10)}
          onChange={e => setDate(e.target.value)}
          className="border border-gray-600 bg-gray-800 text-gray-200 px-2 py-1 rounded"
        />
      </div>

      {/* Top Overall */}
      <section className="mb-8">
        <h2 className="text-xl mb-2">
          Top {limit} Matchups on {date}
        </h2>
        <label className="block mb-2">
          Show{' '}
          <select
            value={limit}
            onChange={e => setLimit(Number(e.target.value))}
            className="border border-gray-600 bg-gray-800 text-gray-200 px-1 rounded"
          >
            {[10,20,50].map(n => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>{' '}
          overall
        </label>
        <MatchupTable
          matchups={topMatchups}
          isGameSpecific={false}
        />
      </section>

      {/* By Game */}
      {loading && <p>Loading…</p>}
      {error && <p className="text-red-400">Error: {error}</p>}
      {!loading && !error && games.length === 0 && (
        <p>No games found for {date}.</p>
      )}

      {!loading && games.map(game => (
        <div
          key={game.game_pk} // Ensure game_pk is unique and suitable as a key
          className="mb-10 p-4 border border-gray-700 rounded bg-gray-800 shadow-lg"
        >
          <header className="mb-3">
            <h3 className="text-lg font-semibold">
              {getGameDisplayTitle(game)}
            </h3>
            <p className="text-sm text-gray-600">
              {game.game_datetime_utc ? new Date(game.game_datetime_utc).toLocaleTimeString([], {
                hour: 'numeric',
                minute: '2-digit',
              }) : 'Time TBD'}{' '}
              — {game.detailed_state}
            </p>
            {game.venue?.name && (
              <p className="text-xs text-gray-500">
                {game.venue.name}, {game.venue.city}
              </p>
            )}
          </header>

          {/* Section for Away and Home batting matchups */}
          {(() => {
            let awayAbbr: string | null = null;
            let homeAbbr: string | null = null;
            const firstMatchup = game.away_team_matchups?.[0] ?? game.home_team_matchups?.[0];

            if (firstMatchup) {
              awayAbbr = firstMatchup.game_away_team_abbreviation;
              homeAbbr = firstMatchup.game_home_team_abbreviation;
            }
            const awayTeamDisplay = awayAbbr || 'Away';
            const homeTeamDisplay = homeAbbr || 'Home';

            return (
              <div className="flex gap-6">
                {/* Away batters vs HOME pitcher */}
                <div className="flex-1">
                  <h4 className="font-medium mb-1 text-gray-300">
                    {awayTeamDisplay} Batting vs.{' '}
                    {game.home_pitcher_details?.name || '—'}{' '}
                    {game.home_pitcher_details?.hand ? `(${game.home_pitcher_details.hand})` : ''}
                  </h4>
                  <MatchupTable matchups={game.away_team_matchups} isGameSpecific={true} />
                </div>

                {/* Home batters vs AWAY pitcher */}
                <div className="flex-1">
                  <h4 className="font-medium mb-1 text-gray-300">
                    {homeTeamDisplay} Batting vs.{' '}
                    {game.away_pitcher_details?.name || '—'}{' '}
                    {game.away_pitcher_details?.hand ? `(${game.away_pitcher_details.hand})` : ''}
                  </h4>
                  <MatchupTable matchups={game.home_team_matchups} isGameSpecific={true} />
                </div>
              </div>
            );
          })()}
        </div>
      ))}
    </main>
  );
}
type TableProps = {
  matchups: Matchup[];
  isGameSpecific: boolean;
};

// Helper functions for color coding stats
const getXwobaColor = (xwoba: number): string => {
  if (xwoba >= 0.400) return 'text-blue-400 font-semibold'; // Great
  if (xwoba >= 0.350) return 'text-green-400'; // Good
  if (xwoba >= 0.300) return 'text-yellow-400'; // Average
  return 'text-red-400'; // Poor
};

const getHardHitColor = (hardHitPct: number): string => {
  if (hardHitPct >= 0.50) return 'text-blue-400 font-semibold'; // Great (50%+)
  if (hardHitPct >= 0.40) return 'text-green-400'; // Good (40-49.9%)
  if (hardHitPct >= 0.30) return 'text-yellow-400'; // Average (30-39.9%)
  return 'text-red-400'; // Poor (<30%)
};

const getKPercentColor = (kPercent: number): string => {
  // Higher K% is worse for batters
  if (kPercent >= 0.300) return 'text-red-400 font-semibold'; // Very High (bad)
  if (kPercent >= 0.250) return 'text-yellow-400'; // High
  if (kPercent >= 0.180) return 'text-green-400'; // Average/Good
  return 'text-blue-400'; // Low (excellent)
};

const getBBPercentColor = (bbPercent: number): string => {
  // Higher BB% is better for batters
  if (bbPercent >= 0.120) return 'text-blue-400 font-semibold'; // Excellent
  if (bbPercent >= 0.090) return 'text-green-400'; // Good
  if (bbPercent >= 0.060) return 'text-yellow-400'; // Average
  return 'text-red-400'; // Poor
};

function MatchupTable({ matchups, isGameSpecific }: TableProps) {
  if (matchups.length === 0) {
    return <p className="text-gray-400">No matchups.</p>;
  }

  return (
    <table className="min-w-full border-collapse text-sm text-gray-300">
      <thead className="bg-gray-700">
        <tr>
          {!isGameSpecific && <th className="px-2 py-2 text-left border-b border-gray-600">#</th>}
          <th className="px-2 py-2 text-left border-b border-gray-600">Batter</th>
          <th className="px-2 py-2 text-right border-b border-gray-600">xwOBA</th>
          <th className="px-2 py-2 text-right border-b border-gray-600">LA</th>
          <th className="px-2 py-2 text-right border-b border-gray-600">Brls/PA</th>
          <th className="px-2 py-2 text-right border-b border-gray-600">Hard%</th>
          <th className="px-2 py-2 text-right border-b border-gray-600">K%</th>
          <th className="px-2 py-2 text-right border-b border-gray-600">BB%</th>
          <th className="px-2 py-2 text-right border-b border-gray-600">EV</th>
        </tr>
      </thead>
      <tbody>
        {matchups.map((m, i) => (
          <tr
            key={`${m.game_pk}-${m.batter_id}`}
            className={`border-b border-gray-700 ${i % 2 ? 'bg-gray-800' : 'bg-gray-750'}`} // Alternating dark rows
          >
            {!isGameSpecific && (
              <td className="px-2 py-2">{i + 1}</td>
            )}
            <td className="px-2 py-2">
              {isGameSpecific && m.lineup_position ? `${m.lineup_position}. ` : ''}
              {m.batter_name}
              {m.batter_hand ? ` (${m.batter_hand})` : ''}
            </td>
            <td className={`px-2 py-2 text-right ${getXwobaColor(m.avg_xwoba)}`}>
              {m.avg_xwoba.toFixed(3)}
            </td>
            <td className="px-2 py-2 text-right">
              {m.avg_launch_angle.toFixed(1)}
            </td>
            <td className="px-2 py-2 text-right">
              {m.avg_barrels_per_pa.toFixed(3)}
            </td>
            <td className={`px-2 py-2 text-right ${getHardHitColor(m.avg_hard_hit_pct)}`}>
              {(m.avg_hard_hit_pct * 100).toFixed(1)}%
            </td>
            <td className={`px-2 py-2 text-right ${getKPercentColor(m.avg_k_percent)}`}>
              {(m.avg_k_percent * 100).toFixed(1)}%
            </td>
            <td className={`px-2 py-2 text-right ${getBBPercentColor(m.avg_bb_percent)}`}>
              {(m.avg_bb_percent * 100).toFixed(1)}%
            </td>
            <td className="px-2 py-2 text-right">
              {m.avg_exit_velocity.toFixed(1)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
