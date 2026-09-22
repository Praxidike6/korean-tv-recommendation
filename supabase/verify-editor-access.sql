-- Run in SQL Editor AFTER approving at least one editor.
-- All test rows and changes are rolled back; existing shows are untouched.
BEGIN;
SELECT set_config('test.editor_id', (SELECT user_id::text FROM public.watchlist_editors LIMIT 1), true);
SELECT set_config('test.show_name', '__access_test_' || gen_random_uuid()::text, true);
DO $$ BEGIN
  IF nullif(current_setting('test.editor_id'), '') IS NULL THEN
    RAISE EXCEPTION 'Approve an editor before testing';
  END IF;
  IF has_table_privilege('anon','public.korean_shows','INSERT')
    OR has_table_privilege('anon','public.korean_shows','UPDATE')
    OR has_table_privilege('anon','public.korean_shows','DELETE')
    OR has_table_privilege('anon','public.korean_shows','TRUNCATE')
    OR has_table_privilege('authenticated','public.korean_shows','TRUNCATE') THEN
    RAISE EXCEPTION 'Excess table privileges';
  END IF;
END $$;
INSERT INTO public.korean_shows(name) VALUES (current_setting('test.show_name'));

SET LOCAL ROLE anon;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.korean_shows WHERE name=current_setting('test.show_name')) THEN
    RAISE EXCEPTION 'Public read failed';
  END IF;
END $$;
RESET ROLE;

-- A signed-in identity with no membership must not be able to write.
SELECT set_config('request.jwt.claims', jsonb_build_object('sub',gen_random_uuid()::text,'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE affected integer; BEGIN
  UPDATE public.korean_shows SET watched=true WHERE name=current_setting('test.show_name');
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Unapproved update succeeded'; END IF;
  DELETE FROM public.korean_shows WHERE name=current_setting('test.show_name');
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Unapproved delete succeeded'; END IF;
  BEGIN
    INSERT INTO public.korean_shows(name) VALUES (current_setting('test.show_name') || '_denied');
    RAISE EXCEPTION 'Unapproved insert succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.watchlist_editors(user_id) VALUES ((SELECT auth.uid()));
    RAISE EXCEPTION 'Self-approval succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claims', jsonb_build_object('sub',current_setting('test.editor_id'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE affected integer; BEGIN
  UPDATE public.korean_shows SET watched=true WHERE name=current_setting('test.show_name');
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Approved update failed'; END IF;
  INSERT INTO public.korean_shows(name) VALUES (current_setting('test.show_name') || '_allowed');
  DELETE FROM public.korean_shows WHERE name=current_setting('test.show_name') || '_allowed';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Approved delete failed'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'PASS: public reads, unapproved writes denied, self-approval denied, approved CRUD allowed; all test changes rolled back' AS result;
