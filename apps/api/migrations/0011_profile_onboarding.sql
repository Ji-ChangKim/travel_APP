-- 닉네임은 표시명이며 계정 식별·고유성은 account(providerId,accountId)로 관리한다.
DROP INDEX IF EXISTS user_nickname_unique;
ALTER TABLE profiles ADD COLUMN avatar_type TEXT NOT NULL DEFAULT 'default' CHECK(avatar_type IN ('default','avatar','photo'));
ALTER TABLE profiles ADD COLUMN avatar_id TEXT;
ALTER TABLE profiles ADD COLUMN photo_file_ref TEXT;
ALTER TABLE profiles ADD COLUMN revision INTEGER NOT NULL DEFAULT 1 CHECK(revision > 0);

CREATE TABLE profile_photos (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  path TEXT NOT NULL UNIQUE,
  mime TEXT NOT NULL CHECK(mime IN ('image/jpeg','image/png')),
  size INTEGER NOT NULL CHECK(size > 0 AND size <= 10485760),
  created_at INTEGER NOT NULL
);
CREATE INDEX profile_photos_owner ON profile_photos(owner_id);
CREATE TABLE profile_submit_operations (
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  operation_id TEXT NOT NULL,
  input_json TEXT NOT NULL CHECK(json_valid(input_json)),
  result_json TEXT NOT NULL CHECK(json_valid(result_json)),
  created_at INTEGER NOT NULL,
  PRIMARY KEY(user_id,operation_id)
);
