-- 실행 원본의 참조 사본. 이미 적용한 DB에 중복 실행하지 않는다.
-- 원본: apps/api/migrations/0014_account_lifecycle.sql
-- 계정 식별자는 유지한다. 기존 개인정보 정리는 재시도 가능한 서버 작업으로 분리한다.

CREATE TABLE account_deletion_jobs (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL UNIQUE,
  policy_version TEXT NOT NULL CHECK(policy_version = 'account-delete-v1'),
  requested_at INTEGER NOT NULL CHECK(requested_at > 0),
  lease_until INTEGER NOT NULL DEFAULT 0,
  trip_cursor TEXT NOT NULL DEFAULT '',
  file_cursor TEXT NOT NULL DEFAULT '',
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts >= 0)
);
CREATE TABLE account_data_cleanup (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  file_cursor TEXT NOT NULL DEFAULT '',
  attempted_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE account_storage_sweep (
  id INTEGER PRIMARY KEY CHECK(id=1),
  cursor TEXT NOT NULL DEFAULT '',
  restore_cursor TEXT NOT NULL DEFAULT '',
  next_job INTEGER NOT NULL DEFAULT 0 CHECK(next_job IN(0,1,2,3))
);
INSERT INTO account_storage_sweep(id) VALUES(1);
CREATE INDEX account_data_cleanup_due ON account_data_cleanup(attempted_at,user_id);
CREATE INDEX account_deletion_due ON account_deletion_jobs(attempts,requested_at,lease_until);
INSERT INTO account_data_cleanup(user_id) SELECT id FROM user;
ALTER TABLE oauth_handoffs ADD COLUMN session_user_id TEXT REFERENCES user(id) ON DELETE CASCADE;
ALTER TABLE oauth_handoffs ADD COLUMN guest_user_id TEXT REFERENCES user(id) ON DELETE CASCADE;
UPDATE oauth_handoffs SET session_user_id=(SELECT userId FROM session WHERE token=session_token OR token=substr(session_token,1,instr(session_token,'.')-1) LIMIT 1),guest_user_id=(SELECT userId FROM session WHERE token=guest_token OR token=substr(guest_token,1,instr(guest_token,'.')-1) LIMIT 1);
CREATE INDEX oauth_handoff_session_owner ON oauth_handoffs(session_user_id);
CREATE INDEX oauth_handoff_guest_owner ON oauth_handoffs(guest_user_id);
CREATE INDEX uploads_actor ON uploads(actor_id);
CREATE INDEX trips_owner ON trips(owner_id);

ALTER TABLE user ADD COLUMN lastLoginAt INTEGER
  CHECK(lastLoginAt IS NULL OR lastLoginAt > 0);

-- 한 내부 계정에 연결할 Google 주체는 하나다. 기존 충돌 자료는 사전 조사한다.
CREATE UNIQUE INDEX account_google_user ON account(userId)
  WHERE providerId = 'google';

-- 프로필 입력 완료 여부 대신 실제 Google 연결과 계정 접근 상태로 회원을 구분한다.
-- 세션의 유효성은 이 뷰와 별도로 인증 미들웨어에서 검증한다.
CREATE VIEW active_google_members AS
SELECT u.id AS user_id, u.email AS email,
       a.createdAt AS joined_at, u.lastLoginAt AS last_login_at
FROM user u JOIN account a ON a.userId = u.id
WHERE a.providerId = 'google' AND u.isAnonymous = 0
  AND NOT EXISTS (
    SELECT 1 FROM account_retirements r WHERE r.user_id = u.id
  ) AND NOT EXISTS (
    SELECT 1 FROM account_deletion_jobs d WHERE d.user_id = u.id
  );

CREATE TABLE usage_events (
  event_id TEXT PRIMARY KEY NOT NULL CHECK(length(event_id) = 36),
  event_name TEXT NOT NULL CHECK(event_name IN (
    'guest_started', 'member_active', 'google_login_completed',
    'member_registered', 'trip_created', 'receipt_confirmed'
  )),
  stat_date TEXT NOT NULL CHECK(
    length(stat_date) = 10 AND date(stat_date) IS NOT NULL
    AND date(stat_date) = stat_date
  ),
  occurred_at INTEGER NOT NULL CHECK(occurred_at > 0),
  received_at INTEGER NOT NULL CHECK(received_at > 0),
  actor_kind TEXT NOT NULL CHECK(actor_kind IN ('guest', 'member')),
  member_id TEXT REFERENCES user(id) ON DELETE CASCADE,
  guest_session_id TEXT CHECK(
    guest_session_id IS NULL OR length(guest_session_id) = 36
  ),
  registration_source TEXT CHECK(registration_source IN ('direct', 'guest')),
  expires_at INTEGER NOT NULL CHECK(expires_at > received_at),
  CHECK(
    (actor_kind = 'member' AND member_id IS NOT NULL AND guest_session_id IS NULL)
    OR (actor_kind = 'guest' AND member_id IS NULL AND guest_session_id IS NOT NULL)
  ),
  CHECK(
    (event_name = 'guest_started' AND actor_kind = 'guest')
    OR (event_name IN ('member_active', 'google_login_completed', 'member_registered')
        AND actor_kind = 'member')
    OR event_name IN ('trip_created', 'receipt_confirmed')
  ),
  CHECK(
    (event_name = 'member_registered' AND registration_source IS NOT NULL)
    OR (event_name <> 'member_registered' AND registration_source IS NULL)
  )
);
CREATE INDEX usage_events_expiry ON usage_events(expires_at);
CREATE INDEX usage_events_summary ON usage_events(stat_date, actor_kind, event_name);
CREATE INDEX usage_events_member ON usage_events(member_id, received_at);
CREATE UNIQUE INDEX usage_member_active_daily ON usage_events(stat_date, member_id)
  WHERE event_name = 'member_active';
CREATE UNIQUE INDEX usage_guest_started_daily ON usage_events(stat_date, guest_session_id)
  WHERE event_name = 'guest_started';
CREATE UNIQUE INDEX usage_member_registered ON usage_events(member_id)
  WHERE event_name = 'member_registered';

-- 개인 식별자를 두지 않는 날짜별 집계. 원본 이벤트와 별도의 보관 기준을 적용한다.
CREATE TABLE usage_daily (
  stat_date TEXT NOT NULL CHECK(
    length(stat_date) = 10 AND date(stat_date) IS NOT NULL
    AND date(stat_date) = stat_date
  ),
  audience TEXT NOT NULL CHECK(audience IN ('guest', 'member')),
  metric TEXT NOT NULL CHECK(metric IN (
    'active_members', 'guest_sessions', 'google_logins', 'new_members',
    'guest_to_member', 'trips_created', 'receipts_confirmed'
  )),
  value INTEGER NOT NULL DEFAULT 0 CHECK(typeof(value) = 'integer' AND value >= 0),
  updated_at INTEGER NOT NULL CHECK(updated_at > 0),
  PRIMARY KEY(stat_date, audience, metric),
  CHECK(
    (metric = 'guest_sessions' AND audience = 'guest')
    OR (metric IN ('active_members', 'google_logins', 'new_members', 'guest_to_member')
        AND audience = 'member')
    OR metric IN ('trips_created', 'receipts_confirmed')
  )
);

-- 원본: apps/api/migrations/0015_account_deletion_guards.sql
-- 요청 시작 때의 세션 검사 후 삭제가 접수되어도 DB 저장 단계에서 다시 차단한다.
-- 트리거 본문은 한 줄로 두어 격리 검사에서도 문장 단위를 그대로 적용한다.
CREATE TRIGGER deletion_guard_trip_insert BEFORE INSERT ON trips WHEN EXISTS(SELECT 1 FROM account_deletion_jobs WHERE user_id=NEW.owner_id) BEGIN SELECT RAISE(ABORT,'ACCOUNT_DELETION_PENDING'); END;
CREATE TRIGGER deletion_guard_trip_update BEFORE UPDATE ON trips WHEN EXISTS(SELECT 1 FROM account_deletion_jobs WHERE user_id=OLD.owner_id) OR EXISTS(SELECT 1 FROM json_each(NEW.snapshot,'$.members') m JOIN account_deletion_jobs d ON d.user_id=json_extract(m.value,'$.userId')) BEGIN SELECT RAISE(ABORT,'ACCOUNT_DELETION_PENDING'); END;
CREATE TRIGGER deletion_guard_member BEFORE INSERT ON trip_members WHEN EXISTS(SELECT 1 FROM account_deletion_jobs WHERE user_id=NEW.user_id OR user_id=(SELECT owner_id FROM trips WHERE id=NEW.trip_id)) BEGIN SELECT RAISE(ABORT,'ACCOUNT_DELETION_PENDING'); END;
CREATE TRIGGER deletion_guard_upload BEFORE INSERT ON uploads WHEN EXISTS(SELECT 1 FROM account_deletion_jobs WHERE user_id=NEW.actor_id OR user_id=(SELECT owner_id FROM trips WHERE id=NEW.trip_id)) BEGIN SELECT RAISE(ABORT,'ACCOUNT_DELETION_PENDING'); END;
CREATE TRIGGER deletion_guard_session BEFORE INSERT ON session WHEN EXISTS(SELECT 1 FROM account_deletion_jobs WHERE user_id=NEW.userId) BEGIN SELECT RAISE(ABORT,'ACCOUNT_DELETION_PENDING'); END;
CREATE TRIGGER deletion_guard_account BEFORE INSERT ON account WHEN EXISTS(SELECT 1 FROM account_deletion_jobs WHERE user_id=NEW.userId) BEGIN SELECT RAISE(ABORT,'ACCOUNT_DELETION_PENDING'); END;
CREATE TRIGGER deletion_guard_import_insert BEFORE INSERT ON guest_import_operations WHEN EXISTS(SELECT 1 FROM account_deletion_jobs WHERE user_id=NEW.actor_id) BEGIN SELECT RAISE(ABORT,'ACCOUNT_DELETION_PENDING'); END;
CREATE TRIGGER deletion_guard_import_update BEFORE UPDATE ON guest_import_operations WHEN EXISTS(SELECT 1 FROM account_deletion_jobs WHERE user_id=NEW.actor_id) BEGIN SELECT RAISE(ABORT,'ACCOUNT_DELETION_PENDING'); END;
CREATE TRIGGER deletion_guard_import_file BEFORE INSERT ON guest_import_files WHEN EXISTS(SELECT 1 FROM account_deletion_jobs WHERE user_id=NEW.actor_id) BEGIN SELECT RAISE(ABORT,'ACCOUNT_DELETION_PENDING'); END;
CREATE TRIGGER deletion_guard_draft_insert BEFORE INSERT ON plan_drafts WHEN EXISTS(SELECT 1 FROM account_deletion_jobs WHERE user_id=NEW.owner_id) BEGIN SELECT RAISE(ABORT,'ACCOUNT_DELETION_PENDING'); END;
CREATE TRIGGER deletion_guard_draft_update BEFORE UPDATE ON plan_drafts WHEN EXISTS(SELECT 1 FROM account_deletion_jobs WHERE user_id=NEW.owner_id) BEGIN SELECT RAISE(ABORT,'ACCOUNT_DELETION_PENDING'); END;
CREATE TRIGGER deletion_guard_post_insert BEFORE INSERT ON posts WHEN EXISTS(SELECT 1 FROM account_deletion_jobs WHERE user_id=NEW.author_id OR user_id=(SELECT owner_id FROM trips WHERE id=NEW.trip_id)) BEGIN SELECT RAISE(ABORT,'ACCOUNT_DELETION_PENDING'); END;
CREATE TRIGGER deletion_guard_post_update BEFORE UPDATE ON posts WHEN EXISTS(SELECT 1 FROM account_deletion_jobs WHERE user_id=NEW.author_id OR user_id=(SELECT owner_id FROM trips WHERE id=NEW.trip_id)) BEGIN SELECT RAISE(ABORT,'ACCOUNT_DELETION_PENDING'); END;
CREATE TRIGGER deletion_guard_usage BEFORE INSERT ON usage_events WHEN EXISTS(SELECT 1 FROM account_deletion_jobs WHERE user_id=NEW.member_id) BEGIN SELECT RAISE(ABORT,'ACCOUNT_DELETION_PENDING'); END;
CREATE TRIGGER deletion_guard_handoff_insert BEFORE INSERT ON oauth_handoffs WHEN EXISTS(SELECT 1 FROM account_deletion_jobs WHERE user_id=NEW.session_user_id OR user_id=NEW.guest_user_id) BEGIN SELECT RAISE(ABORT,'ACCOUNT_DELETION_PENDING'); END;
CREATE TRIGGER deletion_guard_handoff_update BEFORE UPDATE ON oauth_handoffs WHEN EXISTS(SELECT 1 FROM account_deletion_jobs WHERE user_id=NEW.session_user_id OR user_id=NEW.guest_user_id) BEGIN SELECT RAISE(ABORT,'ACCOUNT_DELETION_PENDING'); END;
CREATE TRIGGER deletion_guard_scan_insert BEFORE INSERT ON receipt_scans WHEN NOT EXISTS(SELECT 1 FROM uploads u WHERE u.trip_id=NEW.trip_id AND substr(u.path,instr(u.path,'/')+1,36)=NEW.media_id AND u.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM account_deletion_jobs WHERE user_id=u.actor_id OR user_id=(SELECT owner_id FROM trips WHERE id=u.trip_id))) BEGIN SELECT RAISE(ABORT,'ACCOUNT_DELETION_PENDING'); END;
CREATE TRIGGER deletion_guard_scan_update BEFORE UPDATE ON receipt_scans WHEN NOT EXISTS(SELECT 1 FROM uploads u WHERE u.trip_id=NEW.trip_id AND substr(u.path,instr(u.path,'/')+1,36)=NEW.media_id AND u.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM account_deletion_jobs WHERE user_id=u.actor_id OR user_id=(SELECT owner_id FROM trips WHERE id=u.trip_id))) BEGIN SELECT RAISE(ABORT,'ACCOUNT_DELETION_PENDING'); END;
