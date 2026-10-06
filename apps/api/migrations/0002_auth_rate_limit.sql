-- 표준 인증의 요청 횟수는 Worker 인스턴스 교체 이후에도 유지한다.
CREATE TABLE rateLimit (id TEXT PRIMARY KEY, key TEXT NOT NULL UNIQUE, count INTEGER NOT NULL, lastRequest INTEGER NOT NULL);
CREATE INDEX rate_limit_last_request ON rateLimit(lastRequest);
