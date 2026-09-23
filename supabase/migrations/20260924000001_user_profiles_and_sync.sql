-- ==============================================================================
-- travel_APP (wherego) 사용자 관리, 개인 프로필 확장 및 데이터 동기화 마이그레이션
-- ==============================================================================

-- 1. profiles 테이블 확장 컬럼 추가 (자기소개, 여행 스타일 태그, 연락처)
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS travel_styles TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS phone VARCHAR(30);

-- 2. trips 테이블에 동행 참여용 invite_code 컬럼 및 고유 인덱스 보완
ALTER TABLE IF EXISTS public.trips
  ADD COLUMN IF NOT EXISTS invite_code VARCHAR(20) UNIQUE;

CREATE INDEX IF NOT EXISTS idx_trips_invite_code ON public.trips(invite_code);

-- 3. 초기 스키마 누락 테이블: expenses (여행 가계부 지출 내역) 생성
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  trip_day_id UUID REFERENCES public.trip_days(id) ON DELETE SET NULL,
  schedule_id UUID REFERENCES public.itinerary_items(id) ON DELETE SET NULL,
  title VARCHAR(100) NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'KRW',
  category VARCHAR(20) NOT NULL DEFAULT 'food',
  is_actual BOOLEAN NOT NULL DEFAULT TRUE,
  paid_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_trip_id ON public.expenses(trip_id);
CREATE INDEX IF NOT EXISTS idx_expenses_day_id ON public.expenses(trip_day_id);

-- 4. 초기 스키마 누락 테이블: checklists (준비물 체크리스트) 생성
CREATE TABLE IF NOT EXISTS public.checklists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  title VARCHAR(100) NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  assigned_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checklists_trip_id ON public.checklists(trip_id);

-- 5. RLS 활성화 (신규 생성 테이블 및 places 마스터)
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;

-- 5-1. places 테이블 공개 조회 정책 (모든 사용자 읽기 허용)
DROP POLICY IF EXISTS "Places are viewable by everyone" ON public.places;
CREATE POLICY "Places are viewable by everyone"
  ON public.places FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert places" ON public.places;
CREATE POLICY "Authenticated users can insert places"
  ON public.places FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- 6. profiles 테이블 RLS 보완 (INSERT 정책 추가)
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 7. expenses 테이블 RLS 정책 (여행 소유자 및 동행자 공유 접근)
DROP POLICY IF EXISTS "Users can view expenses of own or joined trips" ON public.expenses;
CREATE POLICY "Users can view expenses of own or joined trips"
  ON public.expenses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE public.trips.id = expenses.trip_id
        AND (
          public.trips.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.trip_members
            WHERE public.trip_members.trip_id = expenses.trip_id
              AND public.trip_members.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "Members can insert expenses" ON public.expenses;
CREATE POLICY "Members can insert expenses"
  ON public.expenses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE public.trips.id = expenses.trip_id
        AND (
          public.trips.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.trip_members
            WHERE public.trip_members.trip_id = expenses.trip_id
              AND public.trip_members.user_id = auth.uid()
              AND public.trip_members.role IN ('owner', 'editor')
          )
        )
    )
  );

DROP POLICY IF EXISTS "Members can update expenses" ON public.expenses;
CREATE POLICY "Members can update expenses"
  ON public.expenses FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE public.trips.id = expenses.trip_id
        AND (
          public.trips.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.trip_members
            WHERE public.trip_members.trip_id = expenses.trip_id
              AND public.trip_members.user_id = auth.uid()
              AND public.trip_members.role IN ('owner', 'editor')
          )
        )
    )
  );

DROP POLICY IF EXISTS "Members can delete expenses" ON public.expenses;
CREATE POLICY "Members can delete expenses"
  ON public.expenses FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE public.trips.id = expenses.trip_id
        AND (
          public.trips.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.trip_members
            WHERE public.trip_members.trip_id = expenses.trip_id
              AND public.trip_members.user_id = auth.uid()
              AND public.trip_members.role IN ('owner', 'editor')
          )
        )
    )
  );

-- 8. checklists 테이블 RLS 정책
DROP POLICY IF EXISTS "Users can view checklists of own or joined trips" ON public.checklists;
CREATE POLICY "Users can view checklists of own or joined trips"
  ON public.checklists FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE public.trips.id = checklists.trip_id
        AND (
          public.trips.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.trip_members
            WHERE public.trip_members.trip_id = checklists.trip_id
              AND public.trip_members.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "Members can insert checklists" ON public.checklists;
CREATE POLICY "Members can insert checklists"
  ON public.checklists FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE public.trips.id = checklists.trip_id
        AND (
          public.trips.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.trip_members
            WHERE public.trip_members.trip_id = checklists.trip_id
              AND public.trip_members.user_id = auth.uid()
              AND public.trip_members.role IN ('owner', 'editor')
          )
        )
    )
  );

DROP POLICY IF EXISTS "Members can update checklists" ON public.checklists;
CREATE POLICY "Members can update checklists"
  ON public.checklists FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE public.trips.id = checklists.trip_id
        AND (
          public.trips.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.trip_members
            WHERE public.trip_members.trip_id = checklists.trip_id
              AND public.trip_members.user_id = auth.uid()
              AND public.trip_members.role IN ('owner', 'editor')
          )
        )
    )
  );

DROP POLICY IF EXISTS "Members can delete checklists" ON public.checklists;
CREATE POLICY "Members can delete checklists"
  ON public.checklists FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE public.trips.id = checklists.trip_id
        AND (
          public.trips.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.trip_members
            WHERE public.trip_members.trip_id = checklists.trip_id
              AND public.trip_members.user_id = auth.uid()
              AND public.trip_members.role IN ('owner', 'editor')
          )
        )
    )
  );

-- 9. auth.users 신규 가입 시 public.profiles 자동 생성 트리거 함수 정의
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nickname, avatar_url, bio, travel_styles, phone)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'nickname',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1),
      '여행자'
    ),
    NEW.raw_user_meta_data->>'avatar_url',
    NULL,
    ARRAY[]::TEXT[],
    NEW.raw_user_meta_data->>'phone'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. auth.users 가입 트리거 연결
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 11. Storage 버킷 생성 및 RLS 정책 (프로필 아바타 이미지)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::TEXT = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::TEXT = (storage.foldername(name))[1]);
