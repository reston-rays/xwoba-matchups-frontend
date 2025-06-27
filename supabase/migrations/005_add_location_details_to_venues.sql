-- infra/supabase/migrations/005_add_location_details_to_venues.sql

ALTER TABLE public.venues
ADD COLUMN city TEXT NULL,
ADD COLUMN state TEXT NULL,
ADD COLUMN latitude NUMERIC(9,6) NULL,
ADD COLUMN longitude NUMERIC(9,6) NULL;

COMMENT ON COLUMN public.venues.city IS 'City where the venue is located (venues[0].location.city).';
COMMENT ON COLUMN public.venues.state IS 'State or province where the venue is located (venues[0].location.stateAbbrev or venues[0].location.state).';
COMMENT ON COLUMN public.venues.latitude IS 'Latitude of the venue (venues[0].location.defaultCoordinates.latitude).';
COMMENT ON COLUMN public.venues.longitude IS 'Longitude of the venue (venues[0].location.defaultCoordinates.longitude).';

-- Optional: If you want to remove the postal_code column as it's unreliable
-- ALTER TABLE public.venues
-- DROP COLUMN postal_code;
-- COMMENT ON COLUMN public.venues.postal_code IS E'@deprecated Postal code was found to be unreliable, especially for non-US venues. Use city, state, latitude, and longitude instead.';
-- If you keep postal_code, you might want to update its comment to reflect its potential unreliability.
