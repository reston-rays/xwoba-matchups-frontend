// /workspaces/xwoba-matchups-frontend/src/types/player.types.ts
export interface PlayerSplit {
  player_id: number;
  season: number;
  player_type: 'batter' | 'pitcher';
  vs_handedness: 'L' | 'R';
  player_name: string | null;
  pa: number | null;
  ab: number | null;
  ba: number | null;
  obp: number | null;
  slg: number | null;
  woba: number | null;
  xwoba: number | null;
  xba: number | null;
  xobp: number | null;
  xslg: number | null;
  iso: number | null;
  babip: number | null;
  barrels: number | null;
  barrels_per_pa: number | null;
  hard_hit_pct: number | null;
  avg_exit_velocity: number | null;
  max_exit_velocity: number | null;
  avg_launch_angle: number | null;
  groundball_pct: number | null;
  line_drive_pct: number | null;
  flyball_pct: number | null;
  last_updated?: string;
}

export interface Matchup  {
  batter_name: string;
  lineup_position: number | null; // Optional field for lineup position
  pitcher_name: string;
  batter_team: string | null;
  pitcher_team: string | null;
  avg_xwoba: number;
  avg_launch_angle: number | null;
  avg_barrels_per_pa: number | null;
  avg_hard_hit_pct: number | null;
  avg_exit_velocity: number | null;
  game_pk: string | number; // Game ID
  batter_id: number; // MLBAM ID for batter
  pitcher_id: number; // MLBAM ID for pitcher
  game_home_team_abbreviation: string | null; // Optional, for home team
  game_away_team_abbreviation: string | null; // Optional, for away team
}