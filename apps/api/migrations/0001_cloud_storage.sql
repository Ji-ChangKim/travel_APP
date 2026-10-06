-- 인증 테이블은 Better Auth 기본 SQLite 명세를 따른다.
CREATE TABLE user (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, emailVerified INTEGER NOT NULL DEFAULT 0, image TEXT, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL);
CREATE TABLE session (id TEXT PRIMARY KEY, expiresAt INTEGER NOT NULL, token TEXT NOT NULL UNIQUE, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL, ipAddress TEXT, userAgent TEXT, userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE);
CREATE INDEX session_user ON session(userId);
CREATE TABLE account (id TEXT PRIMARY KEY, accountId TEXT NOT NULL, providerId TEXT NOT NULL, userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE, accessToken TEXT, refreshToken TEXT, idToken TEXT, accessTokenExpiresAt INTEGER, refreshTokenExpiresAt INTEGER, scope TEXT, password TEXT, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL);
CREATE INDEX account_user ON account(userId);
CREATE TABLE verification (id TEXT PRIMARY KEY, identifier TEXT NOT NULL, value TEXT NOT NULL, expiresAt INTEGER NOT NULL, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL);
CREATE INDEX verification_identifier ON verification(identifier);
-- 여행 JSON과 버전은 하나의 CAS 명령으로 수정하며 권한 인덱스는 같은 batch에서 동기화한다.
CREATE TABLE trips (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES user(id), version INTEGER NOT NULL CHECK(version > 0), snapshot TEXT NOT NULL CHECK(json_valid(snapshot)), last_key TEXT NOT NULL);
CREATE TABLE trip_members (trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE, role TEXT NOT NULL CHECK(role IN ('owner','editor','viewer')), PRIMARY KEY(trip_id,user_id));
CREATE INDEX members_user ON trip_members(user_id,trip_id);
CREATE TABLE mutation_requests (actor_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE, request_key TEXT NOT NULL, input_hash TEXT NOT NULL, result TEXT NOT NULL CHECK(json_valid(result)), created_at INTEGER NOT NULL, PRIMARY KEY(actor_id,request_key));
CREATE TABLE invites (id TEXT PRIMARY KEY, trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE, token_hash TEXT NOT NULL UNIQUE, role TEXT NOT NULL CHECK(role IN ('editor','viewer')), expires_at INTEGER NOT NULL, revoked_at INTEGER, used_at INTEGER, used_by TEXT REFERENCES user(id));
CREATE INDEX invites_trip ON invites(trip_id);
CREATE TABLE posts (id TEXT PRIMARY KEY, trip_id TEXT NOT NULL UNIQUE REFERENCES trips(id) ON DELETE CASCADE, author_id TEXT NOT NULL REFERENCES user(id), published_at INTEGER NOT NULL, snapshot TEXT NOT NULL CHECK(json_valid(snapshot)));
CREATE INDEX posts_recent ON posts(published_at DESC);
CREATE TABLE uploads (path TEXT PRIMARY KEY, trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE, actor_id TEXT NOT NULL REFERENCES user(id), mime TEXT NOT NULL CHECK(mime IN ('image/jpeg','image/png')), size INTEGER NOT NULL CHECK(size > 0 AND size <= 4194304), created_at INTEGER NOT NULL);
CREATE TABLE blocks (actor_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE, blocked_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE, PRIMARY KEY(actor_id,blocked_id));
CREATE TABLE reports (id TEXT PRIMARY KEY, actor_id TEXT NOT NULL REFERENCES user(id), post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE, reason TEXT NOT NULL CHECK(length(reason) BETWEEN 1 AND 500), created_at INTEGER NOT NULL);
CREATE TABLE profiles (user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE, details TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(details)));
