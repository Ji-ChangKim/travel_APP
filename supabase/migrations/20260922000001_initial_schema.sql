-- ==============================================================================
-- travel_APP (wherego) 초기 데이터베이스 스키마 마이그레이션
-- 11개 핵심 테이블 및 RLS(Row Level Security), 인덱스 정의
-- ==============================================================================

-- 1. UUID 확장 기능 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. 여행 상태 Enum 정의
CREATE TYPE trip_status AS ENUM ('DRAFT', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED');

-- 3. 장소 카테고리 Enum 정의
CREATE TYPE place_category AS ENUM ('stay', 'food', 'cafe', 'sightseeing', 'activity', 'etc');

-- 4. 동행자 권한 Enum 정의
CREATE TYPE member_role AS ENUM ('owner', 'editor', 'viewer');

-- 5. 방문 인증 방식 Enum 정의
CREATE TYPE verification_method AS ENUM ('gps', 'manual', 'receipt');

-- ==============================================================================
-- 테이블 생성
-- ==============================================================================

-- 1) 사용자 프로필 테이블 (Supabase auth.users와 연동)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname VARCHAR(50) NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2) 여행 마스터 테이블
CREATE TABLE IF NOT EXISTS trips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title VARCHAR(100) NOT NULL,
  country VARCHAR(50) NOT NULL,
  city VARCHAR(50) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status trip_status NOT NULL DEFAULT 'PLANNED',
  cover_color VARCHAR(20) DEFAULT '#246A54',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_dates CHECK (start_date <= end_date)
);

-- 3) 여행 동행자 테이블
CREATE TABLE IF NOT EXISTS trip_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role member_role NOT NULL DEFAULT 'viewer',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_trip_user UNIQUE (trip_id, user_id)
);

-- 4) 여행 일차별 테이블
CREATE TABLE IF NOT EXISTS trip_days (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  day_number INT NOT NULL,
  trip_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_trip_day UNIQUE (trip_id, day_number)
);

-- 5) 장소 마스터 테이블
CREATE TABLE IF NOT EXISTS places (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(150) NOT NULL,
  address TEXT,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  category place_category NOT NULL DEFAULT 'sightseeing',
  phone VARCHAR(30),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6) 예정 일정 아이템 테이블 (갈 예정인 장소)
CREATE TABLE IF NOT EXISTS itinerary_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_day_id UUID NOT NULL REFERENCES trip_days(id) ON DELETE CASCADE,
  place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  time_slot VARCHAR(10),
  sort_order INT NOT NULL DEFAULT 1,
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7) 실제 방문 기록 테이블 (실제 발자국)
CREATE TABLE IF NOT EXISTS visits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  visited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  verification verification_method NOT NULL DEFAULT 'manual',
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8) 후기 및 리뷰 테이블
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  visit_id UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9) 첨부 파일 테이블 (사진, 영수증 원본)
CREATE TABLE IF NOT EXISTS attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  target_type VARCHAR(20) NOT NULL, -- 'review', 'receipt', 'trip'
  target_id UUID NOT NULL,
  file_path TEXT NOT NULL,
  file_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10) 영수증 OCR 데이터 테이블
CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  visit_id UUID REFERENCES visits(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  merchant_name VARCHAR(100),
  transaction_date DATE,
  total_amount NUMERIC(12, 2),
  ocr_raw_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11) 읽기 전용 공유 링크 테이블
CREATE TABLE IF NOT EXISTS share_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  token VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ,
  permissions VARCHAR(20) NOT NULL DEFAULT 'read_only',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 성능 최적화 인덱스
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_trips_user_id ON trips(user_id);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_trip_members_user_id ON trip_members(user_id);
CREATE INDEX IF NOT EXISTS idx_trip_days_trip_id ON trip_days(trip_id);
CREATE INDEX IF NOT EXISTS idx_itinerary_day_id ON itinerary_items(trip_day_id);
CREATE INDEX IF NOT EXISTS idx_visits_trip_id ON visits(trip_id);
CREATE INDEX IF NOT EXISTS idx_visits_place_id ON visits(place_id);
CREATE INDEX IF NOT EXISTS idx_reviews_visit_id ON reviews(visit_id);
CREATE INDEX IF NOT EXISTS idx_share_links_token ON share_links(token);

-- ==============================================================================
-- RLS (Row Level Security) 정책 기본 설정
-- ==============================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE itinerary_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;

-- 프로필: 모든 사용자가 읽기 가능, 본인만 수정 가능
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- 여행: 소유자 또는 동행자 멤버만 조회 및 작성 가능
CREATE POLICY "Users can view own trips and shared trips" ON trips FOR SELECT USING (
  auth.uid() = user_id OR
  EXISTS (SELECT 1 FROM trip_members WHERE trip_members.trip_id = trips.id AND trip_members.user_id = auth.uid())
);
CREATE POLICY "Users can insert own trips" ON trips FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners can update trips" ON trips FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Owners can delete trips" ON trips FOR DELETE USING (auth.uid() = user_id);
