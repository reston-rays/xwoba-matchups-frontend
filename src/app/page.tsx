/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/page.tsx
'use client';

import React, { useEffect, useState } from 'react';

import { Matchup } from '@/types/player.types';
import { Venue } from '@/types/database';
import { GamesWithMatchupsAndVenues } from '@/pages/api/matchups'; // Import the new type

type GameDisplayData = {
  gamePk: string | number;
  homeTeamAbbr: string | null;
  awayTeamAbbr: string | null;
  gameTime: string | null;
  detailedState: string | null;
  venue: Venue | null | undefined; // Venue is optional and a single object
  homeTeamMatchups: Matchup[];
  homeTeamProbablePitcherName?: string | null;
  homeTeamProbablePitcherHand?: 'L' | 'R' | null;
  awayTeamMatchups: Matchup[];
  awayTeamProbablePitcherName?: string | null;
  awayTeamProbablePitcherHand?: 'L' | 'R' | null;
};

export default function HomePage() {
  // Calculate 'today' with PT offset for initial selectedDate
  const calculateInitialDate = () => {
    const now = new Date();
    now.setHours(now.getHours() - 8); // Approximate PT offset (UTC-8)
    return now.toISOString().slice(0, 10);
  };
  const today = calculateInitialDate();
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [allGamesWithMatchups, setAllGamesWithMatchups] = useState<GamesWithMatchupsAndVenues[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [displayLimit, setDisplayLimit] = useState<number>(20); // Default to 20

  useEffect(() => {
    const fetchMatchups = async () => {
      setError(null);
      setAllGamesWithMatchups(null); // Reset state for new fetch
      try {
        const res = await fetch(`/api/matchups?date=${selectedDate}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: GamesWithMatchupsAndVenues[] = await res.json();
        setAllGamesWithMatchups(data);
      } catch (err: any) {
        console.error('Error loading matchups:', err);
        setError(err.message ?? 'Unknown error');
        setAllGamesWithMatchups([]); // Set to empty array on error to stop loading state
      }
    };

    fetchMatchups();
  }, [selectedDate]);

  // Memoized top overall matchups
  const displayedMatchups = React.useMemo(() => {
    if (!allGamesWithMatchups) return null;
    // Flatten all matchups from all games
    const flatMatchups = allGamesWithMatchups.reduce((acc, game) => {
      return acc.concat(game.matchups);
    }, [] as Matchup[]);
    // Sort them by avg_xwoba (API should already do this, but defensive)
    flatMatchups.sort((a, b) => b.avg_xwoba - a.avg_xwoba);
    return flatMatchups.slice(0, displayLimit);
  }, [allGamesWithMatchups, displayLimit]);

  // Memoized data for "Matchups by Game" section
  const gamesData = React.useMemo((): GameDisplayData[] => {
    if (!allGamesWithMatchups || allGamesWithMatchups.length === 0) return [];

    const gamesToDisplay: GameDisplayData[] = allGamesWithMatchups.map(game => {
      // Prefer team abbreviations directly from the game object if available.
      // These should ideally be part of your Game type and populated by the API.
      // Example: game.home_team_abbr_from_db, game.away_team_abbr_from_db
      // For now, we'll stick to the previous fallback if these direct properties aren't on `game`.
      // IMPORTANT: Ensure these abbreviations match what's in `Matchup.batter_team`.

      // Let's assume your `Game` object (and thus `GameWithMatchups`) might have these:
      // (If not, the API needs to provide them, or we use the less reliable matchup-based fallback)
      const homeTeamAbbr = (game as any).home_team_abbreviation || game.matchups[0]?.game_home_team_abbreviation || 'Home';
      const awayTeamAbbr = (game as any).away_team_abbreviation || game.matchups[0]?.game_away_team_abbreviation || 'Away';

      // --- BEGIN DEBUG LOGGING ---
      console.log(
        `[GamePK: ${game.game_pk}] Processing game. HomeAbbr: '${homeTeamAbbr}', AwayAbbr: '${awayTeamAbbr}'`
      );
      if (!game.matchups || game.matchups.length === 0) {
        console.warn(`  [GamePK: ${game.game_pk}] No matchups found in game.matchups array from API for this game.`);
      } else {
        console.log(`  [GamePK: ${game.game_pk}] Found ${game.matchups.length} total matchups in API response for this game.`);
      }
      // --- END DEBUG LOGGING ---

      const gameTime = game.game_datetime_utc || null;
      const detailedState = game.detailed_state || null;

      // Determine probable pitchers
      // Home team's pitcher (faced by away team batters)
      const homePitcherMatchup = game.matchups.find(m => m.batter_team === awayTeamAbbr);
      const homeTeamProbablePitcherName = homePitcherMatchup?.pitcher_name;
      const homeTeamProbablePitcherHand = homePitcherMatchup?.pitcher_hand;

      // Away team's pitcher (faced by home team batters)
      const awayPitcherMatchup = game.matchups.find(m => m.batter_team === homeTeamAbbr);
      const awayTeamProbablePitcherName = awayPitcherMatchup?.pitcher_name;
      const awayTeamProbablePitcherHand = awayPitcherMatchup?.pitcher_hand;

      // --- END DEBUG LOGGING ---


      const homeTeamMatchups: Matchup[] = [];
      const awayTeamMatchups: Matchup[] = [];

      for (const m of game.matchups) {
        // --- BEGIN DEBUG LOGGING ---
        // console.log(`    [GamePK: ${game.game_pk}] Checking Matchup: Batter '${m.batter_name}', BatterTeam: '${m.batter_team}'`);
        // --- END DEBUG LOGGING ---
        if (m.batter_team === homeTeamAbbr) {
          homeTeamMatchups.push(m);
        } else if (m.batter_team === awayTeamAbbr) {
          awayTeamMatchups.push(m);
        } else if (m.batter_team) { // Only log mismatch if batter_team is present but doesn't match
          // --- BEGIN DEBUG LOGGING ---
          console.warn(
            `      [GamePK: ${game.game_pk}] MISMATCH: Batter '${m.batter_name}' (Team: '${m.batter_team}') did not match Home ('${homeTeamAbbr}') or Away ('${awayTeamAbbr}')`
          );
          // --- END DEBUG LOGGING ---
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

      // --- BEGIN DEBUG LOGGING ---
      // console.log(
      //   `  [GamePK: ${game.game_pk}] Filtered Matchups - Home: ${homeTeamMatchups.length}, Away: ${awayTeamMatchups.length}`
      // );
      // --- END DEBUG LOGGING ---
      homeTeamMatchups.sort(sortFn);
      awayTeamMatchups.sort(sortFn);

      // Return the object that will become an element in the new 'gamesToDisplay' array
      return {
        gamePk: game.game_pk,
        homeTeamAbbr,
        awayTeamAbbr,
        gameTime,
        detailedState,
        venue: game.venue || null, // Assign venue directly, fallback to null
        homeTeamMatchups,
        homeTeamProbablePitcherName,
        homeTeamProbablePitcherHand,
        awayTeamMatchups,
        awayTeamProbablePitcherName,
        awayTeamProbablePitcherHand,
      };
    });
    // API already sorts games by game_datetime_utc, so no need to re-sort here unless desired by gamePk
    return gamesToDisplay;
  }, [allGamesWithMatchups]);

  // Helper function to format game time
  const formatGameTime = (utcDateTime: string | null): string => {
    if (!utcDateTime) return 'TBD';
    try {
      return new Date(utcDateTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch (err: any) {
      setError(err.message ?? 'Unknown error');
      return 'Invalid Date';
    }
  };

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-2">Matchup Analysis</h1>

      {/* Date selector */}
      <label className="block mb-4">
        <span className="mr-2 font-medium">Select date:</span>
        <input
          type="date"
          value={selectedDate}
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
      {allGamesWithMatchups === null && !error ? ( // Check allGamesWithMatchups for initial load
        <div>Loading…</div>
      ) : allGamesWithMatchups && allGamesWithMatchups.length === 0 && !error ? (
        <div>No matchups found for {selectedDate}.</div>
      ) : (
        <>
          {/* Matchups by Game */}
          {gamesData.length > 0 && (
            <div className="mt-8">
              <h2 className="text-xl font-bold mb-4">Matchups by Game</h2>
              {gamesData.map((game) => (
                <div key={game.gamePk} className="mb-8 p-4 border rounded-md shadow-sm">
                  <div className="text-center mb-3">
                    <h3 className="text-lg font-semibold">
                      {game.awayTeamAbbr || 'Away Team'} @ {game.homeTeamAbbr || 'Home Team'}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {formatGameTime(game.gameTime)}
                      {game.detailedState && ` - ${game.detailedState}`}
                    </p>
                    {game.venue && (
                      <div className="text-xs text-gray-500 mt-1">
                        <p>{game.venue.name}</p>
                        <p>
                          {game.venue.roof_type && `Roof: ${game.venue.roof_type}`}
                          {game.venue.elevation != null && `, Elev: ${game.venue.elevation}ft`}
                        </p>
                        {/* Ensure latitude and longitude are numbers before calling toFixed */}
                        {typeof game.venue.latitude === 'number' && typeof game.venue.longitude === 'number' && (
                           <p>Lat: {game.venue.latitude.toFixed(4)}, Lon: {game.venue.longitude.toFixed(4)}</p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col md:flex-row md:space-x-6">
                    <div className="flex-1 mb-6 md:mb-0">
                      <MatchupTable
                        title={`${game.awayTeamAbbr || 'Away'} Batting Lineup vs. ${
                          game.homeTeamProbablePitcherName || 'Pitcher'
                        }${
                          game.homeTeamProbablePitcherHand ? ` (${game.homeTeamProbablePitcherHand})` : ''
                        }`}
                        matchups={game.awayTeamMatchups}
                        isGameSpecificView={true}
                      />
                    </div>
                    <div className="flex-1">
                      <MatchupTable
                        title={`${game.homeTeamAbbr || 'Home'} Batting Lineup vs. ${
                          game.awayTeamProbablePitcherName || 'Pitcher'
                        }${
                          game.awayTeamProbablePitcherHand ? ` (${game.awayTeamProbablePitcherHand})` : ''
                        }`}
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
  const getXwobaColorClass = (xwoba: number): string => {
    if (xwoba >= 0.360) {
      return 'text-blue-600 font-semibold'; // High value - Blue
    } else if (xwoba >= 0.320) {
      return 'text-green-600 font-semibold'; // Mid value - Green
    } else {
      return 'text-orange-600 font-semibold'; // Low value - Orange
    }
    // Consider adding a default class or handling for unexpected values if necessary
  };

  const hardHitThresholds = React.useMemo(() => {
    const validHardHitPcts = matchups
      .map(m => m.avg_hard_hit_pct)
      .filter(pct => typeof pct === 'number') as number[];

    if (validHardHitPcts.length < 2) { // Need at least 2 distinct values for a meaningful range
      return null;
    }

    const minPct = Math.min(...validHardHitPcts);
    const maxPct = Math.max(...validHardHitPcts);

    // If all values are the same, range will be 0.
    // They will all fall into the "high" category by the logic below.
    const range = maxPct - minPct;
    const threshold1 = minPct + range / 3;
    const threshold2 = minPct + 2 * range / 3;

    return { threshold1, threshold2 };
  }, [matchups]);

  const getHardHitColorClass = (hardHitPctValue: number | undefined | null): string => {
    if (typeof hardHitPctValue !== 'number' || !hardHitThresholds) {
      return ''; // No color if no data or thresholds
    }

    if (hardHitPctValue >= hardHitThresholds.threshold2) {
      return 'text-indigo-600 font-semibold'; // High value - Indigo
    } else if (hardHitPctValue >= hardHitThresholds.threshold1) {
      return 'text-sky-600 font-semibold';    // Mid value - Sky Blue
    } else {
      return 'text-teal-600 font-semibold';   // Low value - Teal
    }
  };

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
                  <td className="px-3 py-2">{m.batter_name} ({m.batter_hand})</td>
                  {!isGameSpecificView && <td className="px-3 py-2 hidden sm:table-cell">{m.batter_team || '-'}</td>}
                  <td className="px-3 py-2 text-center">{m.lineup_position || '-'}</td>
                  {!isGameSpecificView && <td className="px-3 py-2">{m.pitcher_name}</td>}
                  {!isGameSpecificView && <td className="px-3 py-2 hidden sm:table-cell">{m.pitcher_team || '-'}</td>}
                  <td className={`px-3 py-2 text-right ${getXwobaColorClass(m.avg_xwoba)}`}>
                    {m.avg_xwoba.toFixed(3)}
                  </td>
                  <td className="px-3 py-2 text-right hidden md:table-cell">{m.avg_launch_angle?.toFixed(1) || '-'}</td>
                  <td className="px-3 py-2 text-right hidden lg:table-cell">{m.avg_barrels_per_pa?.toFixed(3) || '-'}</td>
                  <td className={`px-3 py-2 text-right hidden lg:table-cell ${getHardHitColorClass(m.avg_hard_hit_pct)}`}>
                    {m.avg_hard_hit_pct ? (m.avg_hard_hit_pct * 100).toFixed(1) + '%' : '-'}
                  </td>
                  <td className="px-3 py-2 text-right hidden md:table-cell">{m.avg_exit_velocity?.toFixed(1) || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
    </div>
  );
}