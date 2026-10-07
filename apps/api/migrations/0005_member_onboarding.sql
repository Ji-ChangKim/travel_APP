-- 게스트도 서버 회원으로 저장하고 SNS 연결 후 개인정보 설정을 별도로 확정한다.
ALTER TABLE user ADD COLUMN isAnonymous INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN gender TEXT CHECK(gender IN ('female','male','unspecified'));
ALTER TABLE profiles ADD COLUMN birth_date TEXT;
ALTER TABLE profiles ADD COLUMN onboarding_completed_at INTEGER;
-- 기존 이메일 회원은 닉네임을 이미 설정했으므로 새 가입 절차를 강제하지 않는다.
INSERT INTO profiles(user_id,onboarding_completed_at) SELECT id,createdAt FROM user WHERE true
ON CONFLICT(user_id) DO UPDATE SET onboarding_completed_at=excluded.onboarding_completed_at;
CREATE UNIQUE INDEX account_identity ON account(providerId,accountId);
-- 한 게스트의 기록이 여러 계정으로 중복 이동하지 않도록 연동 대상은 하나만 허용한다.
CREATE TABLE guest_links (
  guest_id TEXT PRIMARY KEY REFERENCES user(id),
  member_id TEXT NOT NULL REFERENCES user(id),
  linked_at INTEGER NOT NULL
);
-- 브라우저와 앱 사이에는 짧은 일회용 코드만 전달하고 세션은 검증 후 본문으로 교환한다.
CREATE TABLE oauth_handoffs (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK(provider IN ('google','kakao','naver')),
  challenge TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  guest_token TEXT,
  session_token TEXT,
  code_hash TEXT UNIQUE,
  expires_at INTEGER NOT NULL,
  launched_at INTEGER
);
CREATE INDEX oauth_handoffs_expiry ON oauth_handoffs(expires_at);
