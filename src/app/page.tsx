/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/page.tsx
'use client';

import React, { useEffect, useState } from 'react';

import { Matchup } from '@/types/player.types'; // Adjust path if needed

type GameDisplayData = {
  gamePk: string | number;
  homeTeamAbbr: string | null;
  awayTeamAbbr: string | null;
  // gameTime?: string; // Optional: if you add game time to Matchup
  homeTeamMatchups: Matchup[];
  awayTeamMatchups: Matchup[];
};

export default function HomePage() {
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [allMatchups, setAllMatchups] = useState<Matchup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [displayLimit, setDisplayLimit] = useState<number>(20); // Default to 20

  useEffect(() => {
    const fetchMatchups = async () => {
      setError(null);
      setAllMatchups(null);
      try {
        const res = await fetch(`/api/matchups?date=${selectedDate}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: Matchup[] = await res.json();
        setAllMatchups(data);
      } catch (err: any) {
        console.error('Error loading matchups:', err);
        setError(err.message ?? 'Unknown error');
        setAllMatchups([]);
      }
    };

    fetchMatchups();
  }, [selectedDate]);

  const displayedMatchups = React.useMemo(() => {
    if (!allMatchups) return null;
    // Ensure matchups are sorted by avg_xwoba descending before slicing
    // The API already sorts, but good to be defensive or re-sort if needed.
    // Assuming API returns them sorted, otherwise:
    // const sorted = [...allMatchups].sort((a, b) => b.avg_xwoba - a.avg_xwoba);
    // return sorted.slice(0, displayLimit);
    return allMatchups.slice(0, displayLimit);
  }, [allMatchups, displayLimit]);

  const gamesData = React.useMemo((): GameDisplayData[] => {
    if (!allMatchups || allMatchups.length === 0) return [];

    const matchupsByGamePk = new Map<string | number, Matchup[]>();
    for (const m of allMatchups) {
      if (!matchupsByGamePk.has(m.game_pk)) {
        matchupsByGamePk.set(m.game_pk, []);
      }
      matchupsByGamePk.get(m.game_pk)!.push(m);
    }

    const processedGames: GameDisplayData[] = [];
    matchupsByGamePk.forEach((matchupsInGame, gamePk) => {
      if (matchupsInGame.length === 0) return;

      // Get game-level team abbreviations from the first matchup (should be consistent)
      const homeTeamAbbr = matchupsInGame[0].game_home_team_abbreviation || 'Home';
      const awayTeamAbbr = matchupsInGame[0].game_away_team_abbreviation || 'Away';

      const homeTeamMatchups: Matchup[] = [];
      const awayTeamMatchups: Matchup[] = [];

      for (const m of matchupsInGame) {
        // Ensure batter_team is compared against the game's designated home/away
        if (m.batter_team === homeTeamAbbr) {
          homeTeamMatchups.push(m);
        } else if (m.batter_team === awayTeamAbbr) {
          awayTeamMatchups.push(m);
        }
      }

      const sortFn = (a: Matchup, b: Matchup) => {
        const lpA = a.lineup_position;
        const lpB = b.lineup_position;
        if (lpA != null && lpB == null) return -1; // Lineup position first
        if (lpA == null && lpB != null) return 1;
        if (lpA != null && lpB != null) {
          if (lpA < lpB) return -1;
          if (lpA > lpB) return 1;
        }
        return b.avg_xwoba - a.avg_xwoba; // Then by xwOBA
      };

      homeTeamMatchups.sort(sortFn);
      awayTeamMatchups.sort(sortFn);

      processedGames.push({
        gamePk,
        homeTeamAbbr,
        awayTeamAbbr,
        homeTeamMatchups,
        awayTeamMatchups,
      });
    });
    return processedGames.sort((a,b) => String(a.gamePk).localeCompare(String(b.gamePk))); // Optional: sort games by gamePk
  }, [allMatchups]);

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-2">Matchup Analysis</h1>

      {/* Date selector */}
      <label className="block mb-4">
        <span className="mr-2 font-medium">Select date:</span>
        <input
          type="date"
          value={selectedDate}
          max={today}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="border px-2 py-1 rounded"
          id="date-selector"
        />
      </label>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-3">Top {displayLimit} Overall Matchups</h2>
        {/* Display limit selector */}
        <label className="block mb-2">
          <span className="mr-2 text-sm">Show:</span>
          <select
            value={displayLimit}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => {
              setDisplayLimit(Number(event.target.value));
            }}
            className="border px-2 py-1 rounded text-sm"
          >
            <option value={10}>Top 10</option>
            <option value={20}>Top 20</option>
            <option value={50}>Top 50</option>
          </select>
        </label>
        <MatchupTable
          title="" // Title is now part of the H2 above
          matchups={displayedMatchups || []}
          isGameSpecificView={false}
        />
      </div>

      {/* Error state */}
      {error && (
        <div className="text-red-600 mb-4">
          Error loading {selectedDate} matchups: {error}
        </div>
      )}

      {/* Loading state */}
      {allMatchups === null && !error ? ( // Check allMatchups for initial load
        <div>Loading…</div>
      ) : allMatchups && allMatchups.length === 0 && !error ? (
        <div>No matchups found for {selectedDate}.</div>
      ) : (
        <>
          {/* Matchups by Game */}
          {gamesData.length > 0 && (
            <div className="mt-8">
              <h2 className="text-xl font-bold mb-4">Matchups by Game</h2>
              {gamesData.map((game) => (
                <div key={game.gamePk} className="mb-8 p-4 border rounded-md shadow-sm">
                  <h3 className="text-lg font-semibold mb-3 text-center">
                    {game.awayTeamAbbr || 'Away Team'} @ {game.homeTeamAbbr || 'Home Team'}
                  </h3>
                  <div className="flex flex-col md:flex-row md:space-x-6">
                    <div className="flex-1 mb-6 md:mb-0">
                      <MatchupTable
                        title={`${game.awayTeamAbbr || 'Away'} Batting Lineup`}
                        matchups={game.awayTeamMatchups}
                        isGameSpecificView={true}
                      />
                    </div>
                    <div className="flex-1">
                      <MatchupTable
                        title={`${game.homeTeamAbbr || 'Home'} Batting Lineup`}
                        matchups={game.homeTeamMatchups}
                        isGameSpecificView={true}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}

type MatchupTableProps = {
  title: string; // Title for the table, can be empty if a separate header is used
  matchups: Matchup[];
  isGameSpecificView?: boolean; // True if this table is for a specific game's lineup
};

function MatchupTable({ title, matchups, isGameSpecificView = false }: MatchupTableProps) {
  if (matchups.length === 0) {
    return (
      <div className="py-4">
        {title && <h4 className="text-md font-semibold mb-2">{title}</h4>}
        <p className="text-sm text-gray-600">No matchups to display.</p>
      </div>
    );
  }

  return (
    <div>
      {title && <h4 className="text-md font-semibold mb-2">{title}</h4>}
      <div className="overflow-x-auto">
        <table className="min-w-full table-auto border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100">
                {!isGameSpecificView && <th className="px-3 py-2 text-left">#</th>}
                <th className="px-3 py-2 text-left">Batter</th>
                {!isGameSpecificView && <th className="px-3 py-2 text-left hidden sm:table-cell">Team</th>}
                <th className="px-3 py-2 text-left">L#</th>
                {!isGameSpecificView && <th className="px-3 py-2 text-left">Pitcher</th>}
                {!isGameSpecificView && <th className="px-3 py-2 text-left hidden sm:table-cell">Team</th>}
                <th className="px-3 py-2 text-right">xwOBA</th>
                <th className="px-3 py-2 text-right hidden md:table-cell">LA</th>
                <th className="px-3 py-2 text-right hidden lg:table-cell">Brls/PA</th>
                <th className="px-3 py-2 text-right hidden lg:table-cell">HardHit%</th>
                <th className="px-3 py-2 text-right hidden md:table-cell">EV</th>
              </tr>
            </thead>
            <tbody>
              {matchups.map((m, idx) => (
                <tr key={`${m.game_pk}-${m.batter_id}-${m.pitcher_id}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  {!isGameSpecificView && <td className="px-3 py-2">{idx + 1}</td>}
                  <td className="px-3 py-2">{m.batter_name}</td>
                  {!isGameSpecificView && <td className="px-3 py-2 hidden sm:table-cell">{m.batter_team || '-'}</td>}
                  <td className="px-3 py-2 text-center">{m.lineup_position || '-'}</td>
                  {!isGameSpecificView && <td className="px-3 py-2">{m.pitcher_name}</td>}
                  {!isGameSpecificView && <td className="px-3 py-2 hidden sm:table-cell">{m.pitcher_team || '-'}</td>}
                  <td className="px-3 py-2 text-right">{m.avg_xwoba.toFixed(3)}</td>
                  <td className="px-3 py-2 text-right hidden md:table-cell">{m.avg_launch_angle?.toFixed(1) || '-'}</td>
                  <td className="px-3 py-2 text-right hidden lg:table-cell">{m.avg_barrels_per_pa?.toFixed(3) || '-'}</td>
                  <td className="px-3 py-2 text-right hidden lg:table-cell">{m.avg_hard_hit_pct ? (m.avg_hard_hit_pct * 100).toFixed(1) + '%' : '-'}</td>
                  <td className="px-3 py-2 text-right hidden md:table-cell">{m.avg_exit_velocity?.toFixed(1) || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
    </div>
  );
}