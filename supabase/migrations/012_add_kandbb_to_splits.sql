-- Migration script to add k_percent and bb_percent to player_splits

ALTER TABLE public.player_splits
ADD COLUMN IF NOT EXISTS k_percent NUMERIC(5, 4) NULL,
ADD COLUMN IF NOT EXISTS bb_percent NUMERIC(5, 4) NULL;

COMMENT ON COLUMN public.player_splits.k_percent IS 'Strikeout percentage, stored as a decimal (e.g., 0.255 for 25.5%). From Savant data.';
COMMENT ON COLUMN public.player_splits.bb_percent IS 'Walk percentage, stored as a decimal (e.g., 0.085 for 8.5%). From Savant data.';

