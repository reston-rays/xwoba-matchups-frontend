/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/page.tsx
'use client';
import React, { useEffect, useState, useCallback, useMemo } from 'react';

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
  const [refreshError, setRefreshError] = useState<string | null>(null); // Separate error state for refresh
  const [isRefreshingGames, setIsRefreshingGames] = useState(false);

  const fetchMatchups = useCallback(async () => {
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
  }, [selectedDate]);

  useEffect(() => {
    fetchMatchups();
  }, [fetchMatchups]);
  
  const handleRefreshGames = async () => {
    setIsRefreshingGames(true);
    setRefreshError(null); // Clear previous refresh errors
    console.log('Attempting to refresh games data via /api/add-games...');
    try {
      const res = await fetch('/api/add-games');
      if (!res.ok) {
        let errorDetail = `HTTP error ${res.status}`;
        try {
          const errorData = await res.json();
          errorDetail = errorData.error || errorData.message || errorDetail;
        } catch { /* Ignore if response is not JSON */ }
        throw new Error(errorDetail);
      }
      console.log('/api/add-games called successfully. Game data refresh initiated.');
      
      // Add a small delay to allow the database to update
      const delayInMilliseconds = 2000; // 2 seconds
      await new Promise(resolve => setTimeout(resolve, delayInMilliseconds));
      console.log(`Waited ${delayInMilliseconds / 1000} seconds for DB to update.`);

      // Re-fetch matchups to reflect any new/updated games
      await fetchMatchups();
    } catch (err: any) {
      console.error('Error calling /api/add-games:', err);
      setRefreshError(`Failed to refresh games: ${err.message}`);
    } finally {
      setIsRefreshingGames(false);
    }
  };

  const displayedMatchups = useMemo(() => {
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
  const gamesData = useMemo((): GameDisplayData[] => {
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

      // Pitcher for the Home Team (will be faced by Away Team batters)
      const homeTeamsActualPitcherId = game.home_team_probable_pitcher_id;
      let homeTeamsActualPitcherName: string | null | undefined = null;
      let homeTeamsActualPitcherHand: 'L' | 'R' | null | undefined = null;

      // Pitcher for the Away Team (will be faced by Home Team batters)
      const awayTeamsActualPitcherId = game.away_team_probable_pitcher_id;
      let awayTeamsActualPitcherName: string | null | undefined = null;
      let awayTeamsActualPitcherHand: 'L' | 'R' | null | undefined = null;

      // Find pitcher details from the matchups array using the IDs
      if (homeTeamsActualPitcherId && game.matchups?.length > 0) {
        const homePitcherMatchup = game.matchups.find(m => m.pitcher_id === homeTeamsActualPitcherId);
        if (homePitcherMatchup) {
          homeTeamsActualPitcherName = homePitcherMatchup.pitcher_name;
          homeTeamsActualPitcherHand = homePitcherMatchup.pitcher_hand as 'L' | 'R' | null | undefined;
        }
      }
      if (awayTeamsActualPitcherId && game.matchups?.length > 0) {
        const awayPitcherMatchup = game.matchups.find(m => m.pitcher_id === awayTeamsActualPitcherId);
        if (awayPitcherMatchup) {
          awayTeamsActualPitcherName = awayPitcherMatchup.pitcher_name;
          awayTeamsActualPitcherHand = awayPitcherMatchup.pitcher_hand as 'L' | 'R' | null | undefined;
        }
      }

      const homeTeamMatchups: Matchup[] = [];
      const awayTeamMatchups: Matchup[] = [];

      for (const m of game.matchups) {
        // Ensure matchup has a pitcher_id to filter against
        if (m.pitcher_id === undefined || m.pitcher_id === null) continue;

        // --- BEGIN DEBUG LOGGING ---
        // console.log(`    [GamePK: ${game.game_pk}] Checking Matchup: Batter '${m.batter_name}', BatterTeam: '${m.batter_team}'`);
        // --- END DEBUG LOGGING ---
        if (m.batter_team === homeTeamAbbr && awayTeamsActualPitcherId && m.pitcher_id === awayTeamsActualPitcherId) {
          homeTeamMatchups.push(m);
        } else if (m.batter_team === awayTeamAbbr && homeTeamsActualPitcherId && m.pitcher_id === homeTeamsActualPitcherId) {
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
        homeTeamProbablePitcherName: awayTeamsActualPitcherName, // Home batters face away pitcher
        homeTeamProbablePitcherHand: awayTeamsActualPitcherHand,
        awayTeamMatchups,
        awayTeamProbablePitcherName: homeTeamsActualPitcherName, // Away batters face home pitcher
        awayTeamProbablePitcherHand: homeTeamsActualPitcherHand,
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
    } catch {
      return 'Invalid Date';
    }
  };

  const handleDateChange = (offset: number) => {
    const currentDate = new Date(selectedDate + 'T00:00:00'); // Ensure parsing as local date
    currentDate.setDate(currentDate.getDate() + offset);
    setSelectedDate(currentDate.toISOString().slice(0, 10));
  };

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-2">Matchup Analysis</h1>

      <div className="flex flex-wrap items-center justify-between mb-4 gap-4">
        {/* Date selector */}
        <div className="flex items-center gap-2">
          <span className="mr-1 font-medium">Date:</span>
          <button
            onClick={() => handleDateChange(-1)}
            aria-label="Previous day"
            className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-100 font-semibold rounded-md"
          >
            &lt;
          </button>
          <div className="relative">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border border-slate-600 bg-slate-700 px-2 py-1 rounded text-slate-100 appearance-none w-[130px] text-center"
              id="date-selector"
            />
            {/* You might need to style the date picker icon or hide it if you want a cleaner look with just arrows */}
          </div>
          <button
            onClick={() => handleDateChange(1)}
            aria-label="Next day"
            className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-100 font-semibold rounded-md"
          >
            &gt;
          </button>
        </div>


        {/* Refresh Games Button */}
        <button
          onClick={handleRefreshGames}
          disabled={isRefreshingGames}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRefreshingGames ? 'Refreshing Games...' : 'Refresh Games'}
        </button>
      </div>
      {/* Display refresh error if any */}
      {refreshError && <div className="text-red-400 mb-4">Refresh Error: {refreshError}</div>}

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
            className="border border-slate-600 bg-slate-700 px-2 py-1 rounded text-sm text-slate-100"
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
        <div className="text-red-400 my-4">
          Error loading {selectedDate} matchups: {error}
        </div>
      )}

      {/* Loading state */}
      {allGamesWithMatchups === null && !error ? ( // Check allGamesWithMatchups for initial load
        <div>Loading…</div>
      ) : allGamesWithMatchups && allGamesWithMatchups.length === 0 && !error ? ( // Added check for allGamesWithMatchups being defined
        <div>No matchups found for {selectedDate}.</div>
      ) : (
        <>
          {/* Matchups by Game */}
          {gamesData.length > 0 && (
            <div className="mt-8">
              <h2 className="text-xl font-bold mb-4">Matchups by Game</h2>
              {gamesData.map((game) => (
                <div key={game.gamePk} className="mb-8 p-4 border border-slate-700 bg-slate-800 rounded-md shadow-sm">
                  <div className="text-center mb-3">
                    <h3 className="text-lg font-semibold">
                      {game.awayTeamAbbr || 'Away Team'} @ {game.homeTeamAbbr || 'Home Team'}
                    </h3>
                    <p className="text-sm text-slate-400">
                      {formatGameTime(game.gameTime)}
                      {game.detailedState && ` - ${game.detailedState}`}
                    </p>
                    {game.venue && (
                      <div className="text-xs text-slate-500 mt-1">
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
if (typeof xwoba !== 'number') return ''; // Handle non-numeric inputs gracefully
    if (xwoba >= 0.350) {
      return 'text-cyan-400 font-semibold'; // Excellent
    } else if (xwoba >= 0.325) {
      return 'text-emerald-400 font-semibold'; // Above Average
    } else if (xwoba >= 0.300) {
      return 'text-slate-300 font-semibold'; //  Average
    } else {
      return 'text-slate-400 font-semibold'; // Poor
    }
  };

  const getHardHitColorClass = (hardHitPctValue: number | undefined | null): string => {
    if (typeof hardHitPctValue !== 'number') {
      return ''; // No color if no data or thresholds
    }
    // The hardHitPctValue is a decimal (e.g., 0.45 for 45%), so we compare against decimals.
    if (hardHitPctValue >= 0.40) { // 45% and above
      return 'text-cyan-400 font-semibold'; // Excellent
    } else if (hardHitPctValue >= 0.35) { // 40% to 44.9%
      return 'text-emerald-400 font-semibold';  // Good
    } else if (hardHitPctValue >= 0.30) { // 35% to 39.9%
      return 'text-slate-300 font-semibold';  // Above Average
    } else {
      return 'text-slate-400 font-semibold';    // Poor (Below 30%)
    }
  };

  if (matchups.length === 0) {
    return (
      <div className="py-4">
        {title && <h4 className="text-md font-semibold mb-2">{title}</h4>}
        <p className="text-sm text-slate-400">No matchups to display.</p>
      </div>
    );
  }

  return (
    <div>
      {title && <h4 className="text-md font-semibold mb-2">{title}</h4>}
      <div className="overflow-x-auto">
        <table className="min-w-full table-auto border-collapse text-sm">
            <thead>
              <tr className="bg-slate-700">
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
                <tr key={`${m.game_pk}-${m.batter_id}-${m.pitcher_id}`} className={idx % 2 === 0 ? 'bg-slate-800' : 'bg-slate-700'}>
                  {!isGameSpecificView && <td className="px-3 py-2">{idx + 1}</td>}
                  <td className="px-3 py-2">{m.batter_name} ({m.batter_hand})</td>
                  {!isGameSpecificView && <td className="px-3 py-2 hidden sm:table-cell">{m.batter_team || '-'}</td>}
                  <td className="px-3 py-2 text-center">{m.lineup_position || '-'}</td>
                  {!isGameSpecificView && <td className="px-3 py-2">{m.pitcher_name} ({m.pitcher_hand})</td>}
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
