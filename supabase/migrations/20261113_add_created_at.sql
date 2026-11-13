BEGIN;

-- Existing rows use their last-known timestamp as the best available
-- approximation. New rows receive their true insertion timestamp.
ALTER TABLE public.korean_shows
  ADD COLUMN IF NOT EXISTS created_at timestamptz;

UPDATE public.korean_shows
SET created_at = COALESCE(updated_at, now())
WHERE created_at IS NULL;

ALTER TABLE public.korean_shows
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL;

COMMIT;
