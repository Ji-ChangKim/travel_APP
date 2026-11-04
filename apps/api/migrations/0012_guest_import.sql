-- 기기 여행은 사용자 확인 후 새 서버 여행으로 연결한다. 원본 기기 자료는 삭제하지 않는다.
CREATE TABLE guest_import_operations (
  actor_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  operation_id TEXT NOT NULL,
  guest_context_ref TEXT NOT NULL,
  local_trip_id TEXT NOT NULL,
  server_trip_id TEXT NOT NULL UNIQUE,
  input_hash TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('pending','confirmed')),
  snapshot TEXT NOT NULL CHECK(json_valid(snapshot)),
  media_map TEXT NOT NULL CHECK(json_valid(media_map)),
  id_map TEXT NOT NULL CHECK(json_valid(id_map)),
  created_at INTEGER NOT NULL,
  confirmed_at INTEGER,
  PRIMARY KEY(actor_id,operation_id),
  UNIQUE(actor_id,guest_context_ref,local_trip_id)
);

CREATE TABLE guest_import_files (
  actor_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  local_media_id TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  mime TEXT NOT NULL CHECK(mime IN ('image/jpeg','image/png')),
  size INTEGER NOT NULL CHECK(size > 0 AND size <= 4194304),
  content_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(actor_id,operation_id,local_media_id),
  FOREIGN KEY(actor_id,operation_id) REFERENCES guest_import_operations(actor_id,operation_id) ON DELETE CASCADE
);
