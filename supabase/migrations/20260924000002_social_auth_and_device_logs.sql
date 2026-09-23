-- ==============================================================================
-- travel_APP (wherego) 소셜 인증, 기기 OS 로그 및 마지막 로그인 기록 마이그레이션
-- ==============================================================================

-- 1. profiles 테이블에 접속 OS 및 인증 제공자, 최종 로그인 시각 컬럼 추가
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS os_platform VARCHAR(20) DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) DEFAULT 'guest',
  ADD COLUMN IF NOT EXISTS last_sign_in_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_profiles_os_platform ON public.profiles(os_platform);
CREATE INDEX IF NOT EXISTS idx_profiles_auth_provider ON public.profiles(auth_provider);

-- 2. 신규 사용자 가입 트리거 함수 고도화 (OS 및 인증 제공자 자동 적재)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    nickname,
    avatar_url,
    bio,
    travel_styles,
    phone,
    os_platform,
    auth_provider,
    last_sign_in_at
  )
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
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'os_platform', 'web'),
    COALESCE(NEW.raw_user_meta_data->>'auth_provider', NEW.app_metadata->>'provider', 'guest'),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    last_sign_in_at = NOW(),
    os_platform = COALESCE(EXCLUDED.os_platform, profiles.os_platform),
    auth_provider = COALESCE(EXCLUDED.auth_provider, profiles.auth_provider);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
