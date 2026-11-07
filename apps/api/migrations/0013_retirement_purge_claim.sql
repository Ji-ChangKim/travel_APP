-- 파기 선점 뒤에는 로그인 복구가 파일 삭제와 경합하지 않도록 상태를 구분한다.
CREATE TABLE account_retirements_next (
  user_id TEXT PRIMARY KEY REFERENCES user(id),
  requested_at INTEGER NOT NULL,
  purge_after INTEGER NOT NULL CHECK(purge_after > requested_at),
  state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','purging','purged')),
  purged_at INTEGER
);
INSERT INTO account_retirements_next SELECT user_id,requested_at,purge_after,state,purged_at FROM account_retirements;
DROP INDEX retirements_due;
DROP TABLE account_retirements;
ALTER TABLE account_retirements_next RENAME TO account_retirements;
CREATE INDEX retirements_due ON account_retirements(state,purge_after);
