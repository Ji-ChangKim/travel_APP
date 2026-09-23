import type { AuthProvider, OsPlatform, Profile } from '@wherego/domain';

import { supabase } from './supabase';

// Supabase DB 행 데이터를 도메인 Profile 객체 형식으로 변환한다.
export function mapRowToProfile(row: {
  id: string;
  nickname: string;
  avatar_url?: string | null;
  bio?: string | null;
  travel_styles?: string[] | null;
  phone?: string | null;
  os_platform?: string | null;
  auth_provider?: string | null;
  last_sign_in_at?: string | null;
  created_at: string;
  updated_at: string;
}): Profile {
  // DB 스네이크 케이스 컬럼을 카멜 케이스 도메인 객체로 매핑하여 반환한다.
  return {
    id: row.id,
    nickname: row.nickname,
    avatarUrl: row.avatar_url ?? null,
    bio: row.bio ?? null,
    travelStyles: row.travel_styles ?? [],
    phone: row.phone ?? null,
    osPlatform: (row.os_platform as OsPlatform) || 'web',
    authProvider: (row.auth_provider as AuthProvider) || 'guest',
    lastSignInAt: row.last_sign_in_at ?? row.updated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// 사용자 프로필 정보를 Supabase DB에서 조회한다.
export async function fetchUserProfile(
  userId: string,
): Promise<Profile | null> {
  // 대상 사용자의 profiles 테이블 레코드를 조회한다.
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  // 조회 오류가 발생한 경우 null을 반환한다.
  if (error || !data) {
    return null;
  }

  // 매핑 함수를 호출하여 도메인 프로필 객체로 변환해 반환한다.
  return mapRowToProfile(data);
}

// 소셜 로그인 인증 완료 시 즉시 프로필을 DB에 등록하거나 최종 로그인 시간을 갱신한다.
export async function upsertSocialProfile(profile: Profile): Promise<Profile> {
  const payload = {
    id: profile.id,
    nickname: profile.nickname,
    avatar_url: profile.avatarUrl,
    bio: profile.bio,
    travel_styles: profile.travelStyles,
    phone: profile.phone,
    os_platform: profile.osPlatform,
    auth_provider: profile.authProvider,
    last_sign_in_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'id' })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(
      error?.message || '소셜 프로필 등록 중 오류가 발생했습니다.',
    );
  }

  return mapRowToProfile(data);
}

// 사용자 프로필 정보를 Supabase DB에 업데이트하여 저장한다.
export async function updateUserProfile(
  userId: string,
  updates: {
    nickname?: string;
    avatarUrl?: string | null;
    bio?: string | null;
    travelStyles?: string[];
    phone?: string | null;
    osPlatform?: OsPlatform;
    authProvider?: AuthProvider;
  },
): Promise<Profile> {
  // DB 컬럼 구조에 맞추어 수정 페이로드를 조립한다.
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.nickname !== undefined)
    payload.nickname = updates.nickname.trim();
  if (updates.avatarUrl !== undefined) payload.avatar_url = updates.avatarUrl;
  if (updates.bio !== undefined) payload.bio = updates.bio;
  if (updates.travelStyles !== undefined)
    payload.travel_styles = updates.travelStyles;
  if (updates.phone !== undefined) payload.phone = updates.phone;
  if (updates.osPlatform !== undefined)
    payload.os_platform = updates.osPlatform;
  if (updates.authProvider !== undefined)
    payload.auth_provider = updates.authProvider;

  // Supabase profiles 테이블에 업데이트 쿼리를 실행한다.
  const { data, error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', userId)
    .select('*')
    .single();

  // 업데이트 실패 시 예외를 발생시킨다.
  if (error || !data) {
    throw new Error(
      error?.message || '프로필 정보를 저장하는 중 오류가 발생했습니다.',
    );
  }

  // 최신 도메인 객체로 변환하여 반환한다.
  return mapRowToProfile(data);
}

// 프로필 아바타 이미지의 공개 다운로드 URL을 생성한다.
export function getAvatarPublicUrl(filePath: string): string {
  // avatars 스토리지 버킷의 공개 URL을 조회하여 반환한다.
  const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
  return data.publicUrl;
}
