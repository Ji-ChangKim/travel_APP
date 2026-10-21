-- 탈퇴 유예와 익명화 완료만 보관하고 여행 소유권은 변경하지 않는다.
CREATE TABLE IF NOT EXISTS account_retirements (
  user_id TEXT PRIMARY KEY REFERENCES user(id),
  requested_at INTEGER NOT NULL,
  purge_after INTEGER NOT NULL CHECK(purge_after > requested_at),
  state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','purged')),
  purged_at INTEGER
);
CREATE INDEX IF NOT EXISTS retirements_due ON account_retirements(state,purge_after);
