'use client';

import React, { useState, useCallback, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Database } from '@/types/database.types';
import { supabaseBrowser } from '@/lib/supabaseBrowserClient';
import ESPNAuth from '@/components/ESPNAuth';
type Matchup = Database['public']['Tables']['daily_matchups']['Row'];
type Player = Database['public']['Tables']['players']['Row'];

interface PlayerWith7DayMatchups extends Player {
  matchupsByDate: Record<string, Matchup[]>;
}

interface OttoneuPlayer {
  teamId: string;
  teamName: string;
  ottoneuId: string;
  fgMajorLeagueId: string;
  name: string;
  mlbTeam: string;
  positions: string;
  salary: string;
}

interface OttoneuTeam {
  teamId: string;
  teamName: string;
  players: OttoneuPlayer[];
}

interface ESPNPlayer {
  id: number;
  fullName: string;
  defaultPositionId: number;
  eligibleSlots: number[];
}

interface ESPNTeam {
  id: number;
  location: string;
  nickname: string;
  roster: {
    entries: Array<{
      playerId: number;
      playerPoolEntry: {
        player: ESPNPlayer;
      };
    }>;
  };
}

interface ESPNAPITeam {
  id: number;
  location?: string;
  nickname?: string;
  roster?: {
    entries?: Array<{
      playerPoolEntry?: {
        player?: {
          id: number;
          fullName: string;
          defaultPositionId: number;
          eligibleSlots?: number[];
        };
      };
    }>;
  };
}

interface ESPNAPIResponse {
  teams?: ESPNAPITeam[];
}

function PlayerSearchPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlayers, setSelectedPlayers] = useState<PlayerWith7DayMatchups[]>([]);
  const [searchResults, setSearchResults] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [ottoneuAddLoading, setOttoneuAddLoading] = useState(false);
  const [espnAddLoading, setEspnAddLoading] = useState(false);
  
  // Ottoneu import state
  const [ottoneuLeagueId, setOttoneuLeagueId] = useState('');
  const [ottoneuTeams, setOttoneuTeams] = useState<OttoneuTeam[]>([]);
  const [selectedOttoneuTeam, setSelectedOttoneuTeam] = useState('');
  const [ottoneuLoading, setOttoneuLoading] = useState(false);
  
  // ESPN import state
  const [espnLeagueId, setEspnLeagueId] = useState('');
  const [espnTeams, setEspnTeams] = useState<ESPNTeam[]>([]);
  const [selectedEspnTeam, setSelectedEspnTeam] = useState('');
  const [espnLoading, setEspnLoading] = useState(false);
  const [espnCredentials, setEspnCredentials] = useState<{ espnS2: string; espnSWID: string } | null>(null);
  const [isESPNAuthenticated, setIsESPNAuthenticated] = useState(false);


  // Generate array of next 7 days (today + next 6)
  const next7Days = useMemo(() => {
    const dates = [];
    const startDate = new Date();
    startDate.setHours(startDate.getHours() - 8); // PT offset

    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      dates.push(date.toISOString().slice(0, 10));
    }
    return dates;
  }, []);

  const searchPlayers = useCallback(async (term: string) => {
    if (!term.trim()) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const { data, error } = await supabaseBrowser
        .from('players')
        .select('*')
        .ilike('full_name', `%${term.trim()}%`)
        .limit(20);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      console.error('Error searching players:', error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const fetchPlayer7DayMatchups = useCallback(async (playerId: number): Promise<Record<string, Matchup[]>> => {
    const matchupsByDate: Record<string, Matchup[]> = {};
    
    try {
      // Fetch matchups for all 7 days at once
      const { data, error } = await supabaseBrowser
        .from('daily_matchups')
        .select('*')
        .eq('batter_id', playerId)
        .in('game_date', next7Days)
        .order('avg_xwoba', { ascending: false });

      if (error) throw error;

      // Group by date
      (data || []).forEach(matchup => {
        if (!matchupsByDate[matchup.game_date]) {
          matchupsByDate[matchup.game_date] = [];
        }
        matchupsByDate[matchup.game_date].push(matchup);
      });

      // Ensure all dates are present even if empty
      next7Days.forEach(date => {
        if (!matchupsByDate[date]) {
          matchupsByDate[date] = [];
        }
      });

      return matchupsByDate;
    } catch (error) {
      console.error('Error fetching player 7-day matchups:', error);
      // Return empty object with all dates
      const emptyMatchups: Record<string, Matchup[]> = {};
      next7Days.forEach(date => {
        emptyMatchups[date] = [];
      });
      return emptyMatchups;
    }
  }, [next7Days]);

  const addPlayer = useCallback(async (player: Player) => {
    if (selectedPlayers.some(p => p.player_id === player.player_id)) {
      return;
    }

    setLoading(true);
    try {
      const matchupsByDate = await fetchPlayer7DayMatchups(player.player_id);
      const playerWith7DayMatchups: PlayerWith7DayMatchups = {
        ...player,
        matchupsByDate
      };
      
      setSelectedPlayers(prev => [...prev, playerWith7DayMatchups]);
      setSearchTerm('');
      setSearchResults([]);
    } catch (error) {
      console.error('Error adding player:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedPlayers, fetchPlayer7DayMatchups]);

  const removePlayer = useCallback((playerId: number) => {
    setSelectedPlayers(prev => prev.filter(p => p.player_id !== playerId));
  }, []);

  const refreshMatchups = useCallback(async () => {
    if (selectedPlayers.length === 0) return;

    setLoading(true);
    try {
      const updatedPlayers = await Promise.all(
        selectedPlayers.map(async (player) => {
          const matchupsByDate = await fetchPlayer7DayMatchups(player.player_id);
          return { ...player, matchupsByDate };
        })
      );
      setSelectedPlayers(updatedPlayers);
    } catch (error) {
      console.error('Error refreshing matchups:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedPlayers, fetchPlayer7DayMatchups]);

  const updateURLParams = useCallback((leagueType?: string, leagueId?: string, teamId?: string) => {
    const params = new URLSearchParams();
    if (leagueType) params.set('leagueType', leagueType);
    if (leagueId) params.set('leagueID', leagueId);
    if (teamId) params.set('teamID', teamId);
    
    const newUrl = params.toString() ? `/search?${params.toString()}` : '/search';
    router.push(newUrl, { scroll: false });
  }, [router]);

  const fetchOttoneuRoster = useCallback(async (leagueId: string) => {
    if (!leagueId.trim()) return;

    setOttoneuLoading(true);
    try {
      const response = await fetch(`/api/ottoneu-roster?leagueId=${encodeURIComponent(leagueId.trim())}`);
      if (!response.ok) throw new Error(`Failed to fetch roster: ${response.status}`);
      
      const csvText = await response.text();
      const lines = csvText.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) throw new Error('Invalid CSV format');
      
      // Skip header row
      const dataLines = lines.slice(1);
      const teams = new Map<string, OttoneuTeam>();
      
      dataLines.forEach(line => {
        // Parse CSV line (handle quoted values)
        const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
        if (!values || values.length < 8) return;
        
        const [teamId, teamName, ottoneuId, fgMajorLeagueId, , name, mlbTeam, positions] = values.map(v => v.replace(/"/g, ''));
        
        // Skip if no team name or if it's restricted list
        if (!teamName || teamName.toLowerCase().includes('restricted')) return;
        
        // Filter out pitchers - only include position players
        const positionList = positions.toLowerCase();
        if (positionList.includes('sp') || positionList.includes('rp') || positionList === 'p') return;
        
        const player: OttoneuPlayer = {
          teamId: teamId.trim(),
          teamName: teamName.trim(),
          ottoneuId: ottoneuId.trim(),
          fgMajorLeagueId: fgMajorLeagueId.trim(),
          name: name.trim(),
          mlbTeam: mlbTeam.trim(),
          positions: positions.trim(),
          salary: values[8]?.replace(/"/g, '') || ''
        };
        
        if (!teams.has(teamId)) {
          teams.set(teamId, {
            teamId,
            teamName: teamName.trim(),
            players: []
          });
        }
        
        teams.get(teamId)!.players.push(player);
      });
      
      const teamsArray = Array.from(teams.values()).sort((a, b) => a.teamName.localeCompare(b.teamName));
      setOttoneuTeams(teamsArray);
      setSelectedOttoneuTeam('');
      
    } catch (error) {
      console.error('Error fetching Ottoneu roster:', error);
      alert(`Failed to fetch roster: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setOttoneuTeams([]);
    } finally {
      setOttoneuLoading(false);
    }
  }, []);

  const addPlayersFromOttoneuTeam = useCallback(async (teamId: string) => {
    const team = ottoneuTeams.find(t => t.teamId === teamId);
    if (!team) return;

    setOttoneuAddLoading(true);
    try {
      const addedPlayers: PlayerWith7DayMatchups[] = [];
      
      for (const ottoneuPlayer of team.players) {
        
        // Search for player in our database by name
        const { data: playerMatches, error } = await supabaseBrowser
          .from('players')
          .select('*')
          .ilike('full_name', `%${ottoneuPlayer.name}%`)
          .limit(5);

        if (error) {
          console.error(`Error searching for ${ottoneuPlayer.name}:`, error);
          continue;
        }

        // Find exact or close match
        const exactMatch = playerMatches?.find(p => 
          p.full_name.toLowerCase() === ottoneuPlayer.name.toLowerCase()
        );
        
        const closeMatch = playerMatches?.find(p => {
          const dbName = p.full_name.toLowerCase();
          const ottoneuName = ottoneuPlayer.name.toLowerCase();
          return dbName.includes(ottoneuName) || ottoneuName.includes(dbName);
        });

        const matchedPlayer = exactMatch || closeMatch;
        
        if (matchedPlayer) {
          const matchupsByDate = await fetchPlayer7DayMatchups(matchedPlayer.player_id);
          const playerWith7DayMatchups: PlayerWith7DayMatchups = {
            ...matchedPlayer,
            matchupsByDate
          };
          addedPlayers.push(playerWith7DayMatchups);
        } else {
          console.warn(`No match found for ${ottoneuPlayer.name}`);
        }
      }
      
      setSelectedPlayers(prev => {
        // Filter out any players already in the list to avoid duplicates
        const newPlayers = addedPlayers.filter(newPlayer => 
          !prev.some(existingPlayer => existingPlayer.player_id === newPlayer.player_id)
        );
        return [...prev, ...newPlayers];
      });
      updateURLParams('Ottoneu', ottoneuLeagueId, teamId);
      
    } catch (error) {
      console.error('Error adding players from Ottoneu team:', error);
    } finally {
      setOttoneuAddLoading(false);
    }
  }, [ottoneuTeams, fetchPlayer7DayMatchups, ottoneuLeagueId, updateURLParams]);

  const fetchESPNRoster = useCallback(async (leagueId: string) => {
    if (!leagueId.trim()) return;

    setEspnLoading(true);
    try {
      let url = `/api/espn-roster?leagueId=${encodeURIComponent(leagueId.trim())}`;
      
      // Add auth parameters if provided
      if (espnCredentials?.espnS2.trim() && espnCredentials?.espnSWID.trim()) {
        url += `&espn_s2=${encodeURIComponent(espnCredentials.espnS2.trim())}&SWID=${encodeURIComponent(espnCredentials.espnSWID.trim())}`;
      }
      
      const response = await fetch(url);
      
      if (!response.ok) throw new Error(`Failed to fetch ESPN roster: ${response.status}`);
      
      const data: ESPNAPIResponse = await response.json();
      
      if (!data.teams || !Array.isArray(data.teams)) {
        throw new Error('Invalid response format from ESPN API');
      }

      // ESPN position IDs for baseball (filter out pitchers)
      // 0=C, 1=1B, 2=2B, 3=3B, 4=SS, 5=OF, 6=DH, 13=P/SP, 14=RP
      const positionPlayerIds = [0, 1, 2, 3, 4, 5, 6]; // Exclude 13 (SP) and 14 (RP)
      
      const teams: ESPNTeam[] = data.teams.map((team: ESPNAPITeam) => ({
        id: team.id,
        location: team.location || '',
        nickname: team.nickname || '',
        roster: {
          entries: (team.roster?.entries || [])
            .filter((entry) => {
              const player = entry.playerPoolEntry?.player;
              if (!player) return false;
              
              // Filter out pitchers based on defaultPositionId
              return positionPlayerIds.includes(player.defaultPositionId);
            })
            .map((entry) => ({
              playerId: entry.playerPoolEntry!.player!.id,
              playerPoolEntry: {
                player: {
                  id: entry.playerPoolEntry!.player!.id,
                  fullName: entry.playerPoolEntry!.player!.fullName,
                  defaultPositionId: entry.playerPoolEntry!.player!.defaultPositionId,
                  eligibleSlots: entry.playerPoolEntry!.player!.eligibleSlots || []
                }
              }
            }))
        }
      }));

      setEspnTeams(teams);
      setSelectedEspnTeam('');
      
    } catch (error) {
      console.error('Error fetching ESPN roster:', error);
      alert(`Failed to fetch ESPN roster: ${error instanceof Error ? error.message : 'Unknown error'}. ${!espnCredentials?.espnS2 || !espnCredentials?.espnSWID ? 'For private leagues, you need to authenticate with ESPN.' : ''}`);
      setEspnTeams([]);
    } finally {
      setEspnLoading(false);
    }
  }, [espnCredentials]);

  const addPlayersFromESPNTeam = useCallback(async (teamId: string) => {
    const team = espnTeams.find(t => t.id.toString() === teamId);
    if (!team) return;

    setEspnAddLoading(true);
    try {
      const addedPlayers: PlayerWith7DayMatchups[] = [];
      
      for (const entry of team.roster.entries) {
        const espnPlayer = entry.playerPoolEntry.player;
        
        // Search for player in our database by name
        const { data: playerMatches, error } = await supabaseBrowser
          .from('players')
          .select('*')
          .ilike('full_name', `%${espnPlayer.fullName}%`)
          .limit(5);

        if (error) {
          console.error(`Error searching for ${espnPlayer.fullName}:`, error);
          continue;
        }

        // Find exact or close match
        const exactMatch = playerMatches?.find(p => 
          p.full_name.toLowerCase() === espnPlayer.fullName.toLowerCase()
        );
        
        const closeMatch = playerMatches?.find(p => {
          const dbName = p.full_name.toLowerCase();
          const espnName = espnPlayer.fullName.toLowerCase();
          return dbName.includes(espnName) || espnName.includes(dbName);
        });

        const matchedPlayer = exactMatch || closeMatch;
        
        if (matchedPlayer) {
          // Filter out pitchers based on primary position abbreviation
          if (matchedPlayer.primary_position_abbreviation === 'P') {
            console.log(`Skipping pitcher: ${matchedPlayer.full_name}`);
            continue;
          }
          
          const matchupsByDate = await fetchPlayer7DayMatchups(matchedPlayer.player_id);
          const playerWith7DayMatchups: PlayerWith7DayMatchups = {
            ...matchedPlayer,
            matchupsByDate
          };
          addedPlayers.push(playerWith7DayMatchups);
        } else {
          console.warn(`No match found for ${espnPlayer.fullName}`);
        }
      }
      
      setSelectedPlayers(prev => {
        // Filter out any players already in the list to avoid duplicates
        const newPlayers = addedPlayers.filter(newPlayer => 
          !prev.some(existingPlayer => existingPlayer.player_id === newPlayer.player_id)
        );
        return [...prev, ...newPlayers];
      });
      updateURLParams('ESPN', espnLeagueId, teamId);
      
    } catch (error) {
      console.error('Error adding players from ESPN team:', error);
    } finally {
      setEspnAddLoading(false);
    }
  }, [espnTeams, fetchPlayer7DayMatchups, espnLeagueId, updateURLParams]);

  // ESPN Authentication handlers
  const handleESPNAuthComplete = useCallback((credentials: { espnS2: string; espnSWID: string }) => {
    setEspnCredentials(credentials);
    setIsESPNAuthenticated(true);
  }, []);

  const handleESPNAuthClear = useCallback(() => {
    setEspnCredentials(null);
    setIsESPNAuthenticated(false);
    setEspnTeams([]);
    setSelectedEspnTeam('');
  }, []);

  // Handle URL parameters and auto-load on page load
  useEffect(() => {
    if (!searchParams) return;
    
    const leagueType = searchParams.get('leagueType');
    const leagueID = searchParams.get('leagueID');
    const teamID = searchParams.get('teamID');

    if (leagueType && leagueID) {
      if (leagueType.toLowerCase() === 'ottoneu') {
        setOttoneuLeagueId(leagueID);
        fetchOttoneuRoster(leagueID).then(() => {
          if (teamID) {
            setSelectedOttoneuTeam(teamID);
            // Auto-add team after a short delay to ensure state is updated
            setTimeout(() => {
              addPlayersFromOttoneuTeam(teamID);
            }, 100);
          }
        });
      } else if (leagueType.toLowerCase() === 'espn') {
        setEspnLeagueId(leagueID);
        fetchESPNRoster(leagueID).then(() => {
          if (teamID) {
            setSelectedEspnTeam(teamID);
            // Auto-add team after a short delay to ensure state is updated
            setTimeout(() => {
              addPlayersFromESPNTeam(teamID);
            }, 100);
          }
        });
      }
    }
  }, [searchParams]);

  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchPlayers(searchTerm);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, searchPlayers]);

  const getXwobaColor = (xwoba: number): string => {
    if (xwoba >= 0.400) return 'text-blue-400 font-semibold';
    if (xwoba >= 0.350) return 'text-green-400';
    if (xwoba >= 0.300) return 'text-yellow-400';
    return 'text-red-400';
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      weekday: 'short'
    });
  };

  const getTotalMatchupsForPlayer = (player: PlayerWith7DayMatchups): number => {
    return Object.values(player.matchupsByDate).reduce((total, matchups) => total + matchups.length, 0);
  };

  return (
    <main className="p-6 bg-gray-900 text-gray-200 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Player 7-Day Matchup Search</h1>

      {/* Ottoneu Import Section */}
      <div className="mb-6 p-4 border border-gray-600 rounded-lg bg-gray-800">
        <h2 className="text-lg font-semibold mb-3">Import from Ottoneu League</h2>
        
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            placeholder="Enter League ID (e.g., 1234)"
            value={ottoneuLeagueId}
            onChange={e => setOttoneuLeagueId(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-600 bg-gray-700 text-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => fetchOttoneuRoster(ottoneuLeagueId)}
            disabled={ottoneuLoading || !ottoneuLeagueId.trim()}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded transition-colors"
          >
            {ottoneuLoading ? 'Loading...' : 'Load Roster'}
          </button>
        </div>

        {ottoneuTeams.length > 0 && (
          <div className="flex gap-2">
            <select
              value={selectedOttoneuTeam}
              onChange={e => setSelectedOttoneuTeam(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-600 bg-gray-700 text-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a team...</option>
              {ottoneuTeams.map(team => (
                <option key={team.teamId} value={team.teamId}>
                  {team.teamName} ({team.players.length} position players)
                </option>
              ))}
            </select>
            <button
              onClick={() => addPlayersFromOttoneuTeam(selectedOttoneuTeam)}
              disabled={ottoneuAddLoading || !selectedOttoneuTeam}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded transition-colors"
            >
              {ottoneuAddLoading ? 'Adding...' : 'Add Team'}
            </button>
          </div>
        )}
      </div>

      {/* ESPN Import Section */}
      <div className="mb-6 p-4 border border-gray-600 rounded-lg bg-gray-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Import from ESPN League</h2>
          <ESPNAuth
            onAuthComplete={handleESPNAuthComplete}
            onAuthClear={handleESPNAuthClear}
            isAuthenticated={isESPNAuthenticated}
          />
        </div>
        
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            placeholder="Enter League ID (e.g., 864611236)"
            value={espnLeagueId}
            onChange={e => setEspnLeagueId(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-600 bg-gray-700 text-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => fetchESPNRoster(espnLeagueId)}
            disabled={espnLoading || !espnLeagueId.trim()}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white rounded transition-colors"
          >
            {espnLoading ? 'Loading...' : 'Load Roster'}
          </button>
        </div>

        {espnTeams.length > 0 && (
          <div className="flex gap-2">
            <select
              value={selectedEspnTeam}
              onChange={e => setSelectedEspnTeam(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-600 bg-gray-700 text-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a team...</option>
              {espnTeams.map(team => (
                <option key={team.id} value={team.id.toString()}>
                  {team.location ? `${team.location} ` : ''}{team.nickname} ({team.roster.entries.length} position players)
                </option>
              ))}
            </select>
            <button
              onClick={() => addPlayersFromESPNTeam(selectedEspnTeam)}
              disabled={espnAddLoading || !selectedEspnTeam}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white rounded transition-colors"
            >
              {espnAddLoading ? 'Adding...' : 'Add Team'}
            </button>
          </div>
        )}
        
        <div className="mt-2 text-xs text-gray-400">
          Note: Public leagues work without authentication. Private leagues require ESPN authentication above.
        </div>
      </div>

      {/* Player Search */}
      <div className="mb-6">
        <div className="relative">
          <input
            type="text"
            placeholder="Search for players by name..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-600 bg-gray-800 text-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searchLoading && (
            <div className="absolute right-3 top-2.5">
              <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            </div>
          )}
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mt-2 bg-gray-800 border border-gray-600 rounded-lg max-h-60 overflow-y-auto">
            {searchResults.map(player => (
              <button
                key={player.player_id}
                onClick={() => addPlayer(player)}
                className="w-full text-left px-3 py-2 hover:bg-gray-700 border-b border-gray-700 last:border-b-0 transition-colors"
                disabled={selectedPlayers.some(p => p.player_id === player.player_id)}
              >
                <div className="font-medium">{player.full_name}</div>
                <div className="text-sm text-gray-400">
                  {player.primary_position_abbreviation} • {player.bat_side_code ? `Bats: ${player.bat_side_code}` : ''}
                  {player.pitch_hand_code ? ` • Throws: ${player.pitch_hand_code}` : ''}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected Players */}
      {selectedPlayers.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-semibold">Selected Players</h2>
            <div className="flex gap-2">
              {(ottoneuLeagueId || espnLeagueId) && (selectedOttoneuTeam || selectedEspnTeam) && (
                <button
                  onClick={() => {
                    const url = window.location.href;
                    navigator.clipboard.writeText(url);
                    alert('Shareable URL copied to clipboard!');
                  }}
                  className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded transition-colors text-sm"
                >
                  Share URL
                </button>
              )}
              <button
                onClick={() => setSelectedPlayers([])}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded transition-colors text-sm"
              >
                Clear All
              </button>
              <button
                onClick={refreshMatchups}
                disabled={loading}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded transition-colors"
              >
                {loading ? 'Refreshing...' : 'Refresh Matchups'}
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedPlayers.map(player => (
              <div
                key={player.player_id}
                className="flex items-center gap-2 bg-gray-700 px-3 py-1 rounded-full"
              >
                <span>{player.full_name}</span>
                <span className="text-sm text-gray-400">({getTotalMatchupsForPlayer(player)} total)</span>
                <button
                  onClick={() => removePlayer(player.player_id)}
                  className="text-red-400 hover:text-red-300 ml-1"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7-Day Matchups Table */}
      {selectedPlayers.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl mb-4">7-Day xwOBA Matchups</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm text-gray-300">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left border-b border-gray-600 sticky left-0 bg-gray-700 z-10">Player</th>
                  {next7Days.map(date => (
                    <th key={date} className="px-3 py-2 text-center border-b border-gray-600 min-w-[120px]">
                      {formatDate(date)}
                      <div className="text-xs text-gray-400 font-normal">{date}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selectedPlayers.map((player, playerIndex) => (
                  <tr
                    key={player.player_id}
                    className={`border-b border-gray-700 ${playerIndex % 2 ? 'bg-gray-800' : 'bg-gray-750'}`}
                  >
                    <td className="px-3 py-2 sticky left-0 bg-inherit border-r border-gray-600">
                      <div className="font-medium">{player.full_name}</div>
                      <div className="text-xs text-gray-400">
                        {player.primary_position_abbreviation}
                        {player.bat_side_code && ` • ${player.bat_side_code}`}
                      </div>
                    </td>
                    {next7Days.map(date => {
                      const dayMatchups = player.matchupsByDate[date] || [];
                      const bestMatchup = dayMatchups.length > 0 ? dayMatchups[0] : null;
                      
                      return (
                        <td key={date} className="px-3 py-2 text-center">
                          {bestMatchup ? (
                            <div>
                              <div className={`font-mono text-sm ${getXwobaColor(bestMatchup.avg_xwoba)}`}>
                                {bestMatchup.avg_xwoba.toFixed(3)}
                              </div>
                              <div className="text-xs text-gray-400 mt-1">
                                vs {bestMatchup.pitcher_name?.split(' ').pop() || 'TBD'}
                                {bestMatchup.pitcher_hand && ` (${bestMatchup.pitcher_hand})`}
                              </div>
                              <div className="text-xs text-gray-500">
                                {bestMatchup.game_away_team_abbreviation} @ {bestMatchup.game_home_team_abbreviation}
                              </div>
                              {dayMatchups.length > 1 && (
                                <div className="text-xs text-blue-400">
                                  +{dayMatchups.length - 1} more
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-gray-500 text-xs">No game</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {selectedPlayers.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400 text-lg">Search for players above to see their 7-day matchup forecast</p>
        </div>
      )}
    </main>
  );
}

export default function PlayerSearchPage() {
  return (
    <Suspense fallback={<div className="p-6 bg-gray-900 text-gray-200 min-h-screen">Loading...</div>}>
      <PlayerSearchPageContent />
    </Suspense>
  );
}