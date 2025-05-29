import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/database.types';

// Then you can use it as:
type Player = Database['public']['Tables']['players']['Row'];
type Team = Database['public']['Tables']['teams']['Row'];
type Venue = Database['public']['Tables']['venues']['Row']; 

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// --- Configuration ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    'Supabase URL or Service Role Key is not defined.'
  );
  process.exit(1);
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
console.log('Supabase client initialized.');

const MLB_API_BASE_URL = 'https://statsapi.mlb.com/api/v1';
const API_CALL_DELAY_MS = 2000; // 2 second delay between roster fetches

/**
 * Fetches all MLB teams (sportId=1).
 * API Endpoint: https://statsapi.mlb.com/api/v1/teams?sportId=1
 */
async function fetchAllMLBTeams(): Promise<any[]> {
  const url = `${MLB_API_BASE_URL}/teams?sportId=1`;
  console.log(`Fetching teams from: ${url}`);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} - ${await response.text()}`);
    }
    const data = await response.json();
    if (!data.teams || !Array.isArray(data.teams)) {
      console.error('Unexpected API response structure for teams:', data);
      throw new Error('API did not return a teams array.');
    }
    return data.teams;
  } catch (error) {
    console.error('Failed to fetch MLB teams:', error);
    throw error;
  }
}

/**
 * Fetches all MLB venues.
 * API Endpoint: https://statsapi.mlb.com/api/v1/venues
 * Note: This endpoint might require specific sportId or other params if it returns too much data.
 * For now, we'll assume it returns MLB venues or we filter them.
 * A more robust approach might be to get venue IDs from the teams endpoint first.
 */
async function fetchAllMLBVenues(): Promise<any[]> {
  const url = `${MLB_API_BASE_URL}/venues?sportId=1`;
  console.log(`Fetching venues from: ${url}`);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} - ${await response.text()}`);
    }
    const data = await response.json();
    if (!data.venues || !Array.isArray(data.venues)) {
      console.error('Unexpected API response structure for venues:', data);
      throw new Error('API did not return a venues array.');
    }
    return data.venues;
  } catch (error) {
    console.error('Failed to fetch MLB venues:', error);
    throw error;
  }
}
/**
 * Populates the 'teams' table in Supabase with the fetched MLB team data.
 */
async function populateTeamsTable() {
  try {
    const apiTeams = await fetchAllMLBTeams();
    if (!apiTeams.length) {
      console.log('No teams fetched from API. Exiting.');
      return;
    }

    const teamsToInsert: Omit<Team, 'last_updated'>[] = apiTeams.map((apiTeam: any) => ({
      id: apiTeam.id,
      name: apiTeam.name,
      venue_id: apiTeam.venue.id,
      abbreviation: apiTeam.abbreviation,
      nickname: apiTeam.teamName, // teamName is commonly used as the nickname
      location_name: apiTeam.locationName,
      league_id: apiTeam.league.id,
      league_name: apiTeam.league.name,
      division_id: apiTeam.division.id,
      division_name: apiTeam.division.name,
      short_name: apiTeam.shortName,
      venue_name_cache: apiTeam.venue.name || null, // Cache the venue name if available
      active: apiTeam.active
    }));

    console.log(`Attempting to upsert ${teamsToInsert.length} teams into Supabase...`);
    const { data, error } = await supabase
      .from('teams')
      .upsert(teamsToInsert, { onConflict: 'id' }) as { data: Team[] | null, error: any };

    if (error) {
      console.error('Error upserting teams into Supabase:', error);
      throw error;
    }

    console.log('Successfully populated teams table.', data?.length || 0, 'records affected.');
  } catch (error) {
    console.error('An error occurred during the teams population process:', error);
    process.exit(1);
  }
}

/**
 * Populates the 'venues' table in Supabase with the fetched MLB venue data.
 * This function needs to be called BEFORE populateTeamsTable.
 */
async function populateVenuesTable() {
  try {
    // It's more reliable to get venue IDs from the teams data first,
    // then fetch details for only those venues.
    const apiTeams = await fetchAllMLBTeams(); // Fetch teams to get their venue IDs
    if (!apiTeams.length) {
      console.log('No teams fetched, so no venue IDs to process for venues table. Exiting venue population.');
      return;
    }

    const venueIds = new Set<number>();
    apiTeams.forEach(team => {
      if (team.venue && team.venue.id) {
        venueIds.add(team.venue.id);
      }
    });

    if (venueIds.size === 0) {
      console.log('No unique venue IDs found from teams data. Exiting venue population.');
      return;
    }

    console.log(`Fetching details for ${venueIds.size} unique venues...`);
    const venuesToInsert: Omit<Venue, 'last_updated'>[] = [];

    for (const venueId of venueIds) {
      const url = `${MLB_API_BASE_URL}/venues/${venueId}?hydrate=location,fieldInfo`;
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`Failed to fetch details for venue ID ${venueId}: ${response.status}`);
        continue;
      }
      const venueData = await response.json();
      if (venueData.venues && venueData.venues.length > 0) {
        const apiVenue = venueData.venues[0];
        venuesToInsert.push({
          id: apiVenue.id,
          name: apiVenue.name || null,
          active: apiVenue.active !== undefined ? apiVenue.active : null, // API might not always return this
          
          // Location details
          city: apiVenue.location?.city || null,
          state: apiVenue.location?.stateAbbrev || apiVenue.location?.state || null, // Prefer abbreviation if available
          postal_code: apiVenue.location?.postalCode || null,
          latitude: apiVenue.location?.defaultCoordinates?.latitude ? parseFloat(apiVenue.location.defaultCoordinates.latitude) : null,
          longitude: apiVenue.location?.defaultCoordinates?.longitude ? parseFloat(apiVenue.location.defaultCoordinates.longitude) : null,
          elevation: apiVenue.location?.elevation ? parseInt(apiVenue.location.elevation) : null,
          roof_type: apiVenue.fieldInfo?.roofType || null,
          field_left_line: apiVenue.fieldInfo?.leftLine || null,
          field_left_center: apiVenue.fieldInfo?.leftCenter || null,
          field_center: apiVenue.fieldInfo?.center || null,
          field_right_center: apiVenue.fieldInfo?.rightCenter || null,
          field_right_line: apiVenue.fieldInfo?.rightLine || null,
        });
      }
    }

    if (venuesToInsert.length === 0) {
      console.log('No venue data to insert after fetching details. Exiting venue population.');
      return;
    }

    console.log(`Attempting to upsert ${venuesToInsert.length} venues into Supabase...`);
    const { data, error } = await supabase
      .from('venues')
      .upsert(venuesToInsert, { onConflict: 'id' }) as { data: Venue[] | null, error: any };

    if (error) {
      console.error('Error upserting venues into Supabase:', error);
      throw error;
    }

    console.log('Successfully populated venues table.', data?.length || 0, 'records affected.');
  } catch (error) {
    console.error('An error occurred during the venues population process:', error);
    process.exit(1);
  }
}

/**
 * Fetches roster for a given teamId and extracts player data.
 * API Endpoint: https://statsapi.mlb.com/api/v1/teams/{teamId}/roster?hydrate=person
 */
async function fetchRosterForTeam(teamId: number): Promise<any[]> {
  const url = `${MLB_API_BASE_URL}/teams/${teamId}/roster?hydrate=person`;
  console.log(`Fetching roster for team ID ${teamId} from: ${url}`);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} - ${await response.text()}`);
    }
    const data = await response.json();
    if (!data.roster || !Array.isArray(data.roster)) {
      console.warn(`Unexpected API response structure for team ${teamId} roster, or roster is empty:`, data);
      return []; // Return empty array if roster is not found or not an array
    }
    return data.roster;
  } catch (error) {
    console.error(`Failed to fetch roster for team ID ${teamId}:`, error);
    return []; // Return empty on error to not break the main loop
  }
}

/**
 * Populates the 'players' table in Supabase with MLB player data from team rosters.
 */
async function populatePlayersTable() {
  try {
    const apiTeams = await fetchAllMLBTeams();
    if (!apiTeams.length) {
      console.log('No teams fetched, so cannot fetch rosters. Exiting player population.');
      return;
    }

    const allPlayersMap = new Map<number, Omit<Player, 'created_at' | 'updated_at'>>();

    console.log(`Fetching rosters for ${apiTeams.length} teams...`);
    for (const apiTeam of apiTeams) {
      if (!apiTeam.id) continue;

      const roster = await fetchRosterForTeam(apiTeam.id);
      roster.forEach((rosterEntry: any) => {
        const person = rosterEntry.person;
        if (person && person.id && !allPlayersMap.has(person.id)) {
          allPlayersMap.set(person.id, {
            player_id: person.id,
            full_name: person.fullName,
            current_age: person.currentAge || null,
            height: person.height || null,
            weight: person.weight || null,
            primary_position_name: person.primaryPosition?.name || null,
            primary_position_abbreviation: person.primaryPosition?.abbreviation || null,
            bat_side_code: person.batSide?.code || null,
            pitch_hand_code: person.pitchHand?.code || null,
          });
        }
      });

      // Delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, API_CALL_DELAY_MS));
    }

    const playersToInsert = Array.from(allPlayersMap.values());

    if (playersToInsert.length === 0) {
      console.log('No new player data to insert. Exiting player population.');
      return;
    }

    console.log(`Attempting to upsert ${playersToInsert.length} players into Supabase...`);
    const { data, error } = await supabase
      .from('players')
      .upsert(playersToInsert, { onConflict: 'player_id' }) as { data: Player[] | null, error: any };

    if (error) {
      console.error('Error upserting players into Supabase:', error);
      throw error;
    }

    console.log('Successfully populated players table.', data?.length || 0, 'records affected.');
  } catch (error) {
    console.error('An error occurred during the players population process:', error);
    process.exit(1);
  }
}

// Main execution
(async () => {
  await populateVenuesTable(); // Populate venues FIRST
  await populateTeamsTable();
  await populatePlayersTable(); // Populate players after teams
  console.log('Static data population script finished.');
})();