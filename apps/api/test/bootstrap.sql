-- 실제 Supabase의 외부 스키마와 JWT 문맥만 로컬 PostgreSQL 테스트에 재현한다.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE SCHEMA storage;
CREATE TABLE auth.users (id UUID PRIMARY KEY,email TEXT,raw_user_meta_data JSONB DEFAULT '{}',raw_app_meta_data JSONB DEFAULT '{}');
CREATE TABLE storage.buckets (id TEXT PRIMARY KEY,name TEXT,public BOOLEAN,file_size_limit BIGINT,allowed_mime_types TEXT[]);
CREATE TABLE storage.objects (id UUID PRIMARY KEY,bucket_id TEXT,name TEXT);
CREATE FUNCTION auth.jwt() RETURNS JSONB LANGUAGE SQL STABLE AS $$
  -- 테스트 요청의 실제 JWT claims 설정을 조회한다.
  SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb;
$$;
CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE SQL STABLE AS $$
  -- JWT의 사용자 UUID만 반환한다.
  SELECT (auth.jwt()->>'sub')::uuid;
$$;
CREATE FUNCTION auth.role() RETURNS TEXT LANGUAGE SQL STABLE AS $$
  -- 현재 테스트 사용자 역할을 조회한다.
  SELECT current_user::text;
$$;
CREATE FUNCTION storage.foldername(p_name TEXT) RETURNS TEXT[] LANGUAGE SQL AS $$
  -- 기존 Storage 정책이 참조하는 경로 함수만 재현한다.
  SELECT string_to_array(p_name,'/');
$$;
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon,authenticated;
