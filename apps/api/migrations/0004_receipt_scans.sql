-- 원본 경로와 사용자 식별자는 서버 권한으로만 조회한다. 인식 결과는 비공개 초안이다.
CREATE TABLE receipt_scans (
 trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
 media_id TEXT NOT NULL,
 draft TEXT NOT NULL CHECK(json_valid(draft)),
 created_at INTEGER NOT NULL,
 PRIMARY KEY(trip_id,media_id)
);
-- 사용자별 시간대 카운터로 인식 공급자 호출을 제한한다.
CREATE TABLE receipt_scan_limits (
 actor_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
 window_start INTEGER NOT NULL,
 hits INTEGER NOT NULL CHECK(hits > 0),
 PRIMARY KEY(actor_id,window_start)
);
