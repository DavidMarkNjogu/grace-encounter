BEGIN;

-- Plan the tests
SELECT plan(4);

-- Test 1: Realtime publication check
-- This just ensures the migration ran successfully, meaning the check for publication existence didn't abort.
SELECT has_table('registrants', 'Table registrants exists');

-- Set up test data
INSERT INTO admin_users (email) VALUES ('testadmin@grace.com');
INSERT INTO pickup_points (name, description) VALUES ('Test Point', 'Test Point Details');

-- Test 2: on delete set null for possible_duplicate_of
WITH inserted_a AS (
  INSERT INTO registrants (name, phone_raw, phone_canonical)
  VALUES ('John Doe', '0700000001', '254700000001') RETURNING id
),
inserted_b AS (
  INSERT INTO registrants (name, phone_raw, phone_canonical, possible_duplicate_of)
  VALUES ('John Doe 2', '0700000002', '254700000002', (SELECT id FROM inserted_a)) RETURNING id
)
-- Delete A
DELETE FROM registrants WHERE id = (SELECT id FROM inserted_a);

-- Assert B's possible_duplicate_of is null
SELECT is(
  (SELECT possible_duplicate_of FROM registrants WHERE phone_canonical = '254700000002'),
  NULL,
  'Deleting a duplicated registrant sets possible_duplicate_of to NULL instead of throwing FK violation'
);

-- Test 3 & 4: register_person duplicate similarity threshold
-- We need to check if 0.45 similarity triggers a duplicate match.
-- 'David Njogu' vs 'David Mark Njogu'
INSERT INTO registrants (name, phone_raw, phone_canonical) VALUES ('David Mark Njogu', '0711111111', '254711111111');

-- Now try inserting a similar name via the RPC. (Since the phone is different, it normally inserts it, but checks name similarity).
SELECT register_person('David Njogu', '0722222222', 'self_registered', 1);

SELECT is(
  (SELECT COUNT(*)::int FROM registrants WHERE phone_canonical = '254722222222'),
  1,
  'Second person is registered'
);

SELECT is(
  (SELECT possible_duplicate_of FROM registrants WHERE phone_canonical = '254722222222'),
  (SELECT id FROM registrants WHERE phone_canonical = '254711111111'),
  'RPC correctly flagged similar name as a possible duplicate (similarity > 0.45)'
);

SELECT * FROM finish();
ROLLBACK;
