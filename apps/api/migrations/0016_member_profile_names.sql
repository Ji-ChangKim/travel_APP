-- 사용자가 MY에서 직접 정한 닉네임만 예약한다. 기존 공급자 이름은 수집·이행하지 않는다.
CREATE TABLE member_profile_names (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL CHECK(length(nickname) BETWEEN 1 AND 10 AND trim(nickname)=nickname AND length(nickname)-length(replace(nickname,' ',''))<=2),
  nickname_key TEXT NOT NULL UNIQUE CHECK(nickname_key=lower(nickname)),
  changed_at INTEGER NOT NULL CHECK(changed_at>0),
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0)
);
CREATE TRIGGER deletion_guard_member_profile_insert BEFORE INSERT ON member_profile_names WHEN EXISTS(SELECT 1 FROM account_deletion_jobs WHERE user_id=NEW.user_id) BEGIN SELECT RAISE(ABORT,'ACCOUNT_DELETION_PENDING'); END;
CREATE TRIGGER deletion_guard_member_profile_update BEFORE UPDATE ON member_profile_names WHEN EXISTS(SELECT 1 FROM account_deletion_jobs WHERE user_id=NEW.user_id) BEGIN SELECT RAISE(ABORT,'ACCOUNT_DELETION_PENDING'); END;
