export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      daily_matchups: {
        Row: {
          avg_barrels_per_pa: number
          avg_bb_percent: number | null
          avg_exit_velocity: number
          avg_hard_hit_pct: number
          avg_hr_per_pa: number | null
          avg_iso: number | null
          avg_k_percent: number | null
          avg_launch_angle: number
          avg_swing_miss_percent: number | null
          avg_xwoba: number
          away_team_id: number | null
          batter_hand: string | null
          batter_id: number
          batter_name: string | null
          batter_team: string | null
          game_away_team_abbreviation: string | null
          game_date: string
          game_home_team_abbreviation: string | null
          game_pk: number | null
          home_team_id: number | null
          lineup_position: number | null
          pitcher_hand: string | null
          pitcher_id: number
          pitcher_name: string | null
          pitcher_team: string | null
        }
        Insert: {
          avg_barrels_per_pa: number
          avg_bb_percent?: number | null
          avg_exit_velocity: number
          avg_hard_hit_pct: number
          avg_hr_per_pa?: number | null
          avg_iso?: number | null
          avg_k_percent?: number | null
          avg_launch_angle: number
          avg_swing_miss_percent?: number | null
          avg_xwoba: number
          away_team_id?: number | null
          batter_hand?: string | null
          batter_id: number
          batter_name?: string | null
          batter_team?: string | null
          game_away_team_abbreviation?: string | null
          game_date: string
          game_home_team_abbreviation?: string | null
          game_pk?: number | null
          home_team_id?: number | null
          lineup_position?: number | null
          pitcher_hand?: string | null
          pitcher_id: number
          pitcher_name?: string | null
          pitcher_team?: string | null
        }
        Update: {
          avg_barrels_per_pa?: number
          avg_bb_percent?: number | null
          avg_exit_velocity?: number
          avg_hard_hit_pct?: number
          avg_iso?: number | null
          avg_k_percent?: number | null
          avg_launch_angle?: number
          avg_swing_miss_percent?: number | null
          avg_xwoba?: number
          away_team_id?: number | null
          batter_hand?: string | null
          batter_id?: number
          batter_name?: string | null
          batter_team?: string | null
          game_away_team_abbreviation?: string | null
          game_date?: string
          game_home_team_abbreviation?: string | null
          game_pk?: number | null
          home_team_id?: number | null
          lineup_position?: number | null
          pitcher_hand?: string | null
          pitcher_id?: number
          pitcher_name?: string | null
          pitcher_team?: string | null
        }
        Relationships: []
      }
      games: {
        Row: {
          away_batting_order: number[] | null
          away_team_id: number | null
          away_team_probable_pitcher_id: number | null
          detailed_state: string | null
          game_datetime_utc: string | null
          game_pk: number
          home_batting_order: number[] | null
          home_team_id: number | null
          home_team_probable_pitcher_id: number | null
          last_updated: string
          official_date: string
          venue_id: number | null
        }
        Insert: {
          away_batting_order?: number[] | null
          away_team_id?: number | null
          away_team_probable_pitcher_id?: number | null
          detailed_state?: string | null
          game_datetime_utc?: string | null
          game_pk: number
          home_batting_order?: number[] | null
          home_team_id?: number | null
          home_team_probable_pitcher_id?: number | null
          last_updated?: string
          official_date: string
          venue_id?: number | null
        }
        Update: {
          away_batting_order?: number[] | null
          away_team_id?: number | null
          away_team_probable_pitcher_id?: number | null
          detailed_state?: string | null
          game_datetime_utc?: string | null
          game_pk?: number
          home_batting_order?: number[] | null
          home_team_id?: number | null
          home_team_probable_pitcher_id?: number | null
          last_updated?: string
          official_date?: string
          venue_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_games_away_team"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_games_home_team"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_games_venue"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      player_splits: {
        Row: {
          ab: number | null
          avg_exit_velocity: number | null
          avg_launch_angle: number | null
          ba: number | null
          babip: number | null
          barrels: number | null
          barrels_per_pa: number | null
          bb_percent: number | null
          flyball_pct: number | null
          groundball_pct: number | null
          hard_hit_pct: number | null
          hrs: number | null
          hyper_speed: number | null
          iso: number | null
          k_percent: number | null
          last_updated: string
          line_drive_pct: number | null
          max_exit_velocity: number | null
          obp: number | null
          pa: number | null
          player_id: number
          player_name: string | null
          player_type: Database["public"]["Enums"]["split_player_type"]
          season: number
          slg: number | null
          swing_miss_percent: number | null
          vs_handedness: Database["public"]["Enums"]["hand"]
          woba: number | null
          xba: number | null
          xobp: number | null
          xslg: number | null
          xwoba: number | null
        }
        Insert: {
          ab?: number | null
          avg_exit_velocity?: number | null
          avg_launch_angle?: number | null
          ba?: number | null
          babip?: number | null
          barrels?: number | null
          barrels_per_pa?: number | null
          bb_percent?: number | null
          flyball_pct?: number | null
          groundball_pct?: number | null
          hard_hit_pct?: number | null
          hrs?: number | null
          hyper_speed?: number | null
          iso?: number | null
          k_percent?: number | null
          last_updated?: string
          line_drive_pct?: number | null
          max_exit_velocity?: number | null
          obp?: number | null
          pa?: number | null
          player_id: number
          player_name?: string | null
          player_type: Database["public"]["Enums"]["split_player_type"]
          season: number
          slg?: number | null
          swing_miss_percent?: number | null
          vs_handedness: Database["public"]["Enums"]["hand"]
          woba?: number | null
          xba?: number | null
          xobp?: number | null
          xslg?: number | null
          xwoba?: number | null
        }
        Update: {
          ab?: number | null
          avg_exit_velocity?: number | null
          avg_launch_angle?: number | null
          ba?: number | null
          babip?: number | null
          barrels?: number | null
          barrels_per_pa?: number | null
          bb_percent?: number | null
          flyball_pct?: number | null
          groundball_pct?: number | null
          hard_hit_pct?: number | null
          hrs?: number | null
          hyper_speed?: number | null
          iso?: number | null
          k_percent?: number | null
          last_updated?: string
          line_drive_pct?: number | null
          max_exit_velocity?: number | null
          obp?: number | null
          pa?: number | null
          player_id?: number
          player_name?: string | null
          player_type?: Database["public"]["Enums"]["split_player_type"]
          season?: number
          slg?: number | null
          swing_miss_percent?: number | null
          vs_handedness?: Database["public"]["Enums"]["hand"]
          woba?: number | null
          xba?: number | null
          xobp?: number | null
          xslg?: number | null
          xwoba?: number | null
        }
        Relationships: []
      }
      players: {
        Row: {
          bat_side_code: string | null
          created_at: string | null
          current_age: number | null
          full_name: string
          height: string | null
          pitch_hand_code: string | null
          player_id: number
          primary_position_abbreviation: string | null
          primary_position_name: string | null
          updated_at: string | null
          weight: number | null
        }
        Insert: {
          bat_side_code?: string | null
          created_at?: string | null
          current_age?: number | null
          full_name: string
          height?: string | null
          pitch_hand_code?: string | null
          player_id: number
          primary_position_abbreviation?: string | null
          primary_position_name?: string | null
          updated_at?: string | null
          weight?: number | null
        }
        Update: {
          bat_side_code?: string | null
          created_at?: string | null
          current_age?: number | null
          full_name?: string
          height?: string | null
          pitch_hand_code?: string | null
          player_id?: number
          primary_position_abbreviation?: string | null
          primary_position_name?: string | null
          updated_at?: string | null
          weight?: number | null
        }
        Relationships: []
      }
      teams: {
        Row: {
          abbreviation: string | null
          active: boolean | null
          division_id: number | null
          division_name: string | null
          id: number
          last_updated: string
          league_id: number | null
          league_name: string | null
          location_name: string | null
          name: string
          nickname: string | null
          short_name: string | null
          venue_id: number | null
          venue_name_cache: string | null
        }
        Insert: {
          abbreviation?: string | null
          active?: boolean | null
          division_id?: number | null
          division_name?: string | null
          id: number
          last_updated?: string
          league_id?: number | null
          league_name?: string | null
          location_name?: string | null
          name: string
          nickname?: string | null
          short_name?: string | null
          venue_id?: number | null
          venue_name_cache?: string | null
        }
        Update: {
          abbreviation?: string | null
          active?: boolean | null
          division_id?: number | null
          division_name?: string | null
          id?: number
          last_updated?: string
          league_id?: number | null
          league_name?: string | null
          location_name?: string | null
          name?: string
          nickname?: string | null
          short_name?: string | null
          venue_id?: number | null
          venue_name_cache?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_venue"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          active: boolean | null
          city: string | null
          elevation: number | null
          field_center: number | null
          field_left_center: number | null
          field_left_line: number | null
          field_right_center: number | null
          field_right_line: number | null
          id: number
          last_updated: string
          latitude: number | null
          longitude: number | null
          name: string | null
          postal_code: string | null
          roof_type: string | null
          state: string | null
        }
        Insert: {
          active?: boolean | null
          city?: string | null
          elevation?: number | null
          field_center?: number | null
          field_left_center?: number | null
          field_left_line?: number | null
          field_right_center?: number | null
          field_right_line?: number | null
          id: number
          last_updated?: string
          latitude?: number | null
          longitude?: number | null
          name?: string | null
          postal_code?: string | null
          roof_type?: string | null
          state?: string | null
        }
        Update: {
          active?: boolean | null
          city?: string | null
          elevation?: number | null
          field_center?: number | null
          field_left_center?: number | null
          field_left_line?: number | null
          field_right_center?: number | null
          field_right_line?: number | null
          id?: number
          last_updated?: string
          latitude?: number | null
          longitude?: number | null
          name?: string | null
          postal_code?: string | null
          roof_type?: string | null
          state?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      hand: "L" | "R"
      split_player_type: "batter" | "pitcher"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      hand: ["L", "R"],
      split_player_type: ["batter", "pitcher"],
    },
  },
} as const
