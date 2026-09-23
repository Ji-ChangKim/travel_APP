import type { User } from '@supabase/supabase-js';

import { supabase } from './supabase';

// 이메일과 비밀번호로 신규 회원가입을 요청한다.
export async function signUpWithEmail(
  email: string,
  password: string,
  nickname?: string,
): Promise<{ user: User | null; error: Error | null }> {
  // Supabase Auth 신규 계정 생성 API를 호출한다.
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        nickname: nickname?.trim() || splitEmailPrefix(email),
      },
    },
  });

  if (error) {
    return { user: null, error: new Error(error.message) };
  }

  return { user: data.user, error: null };
}

// 이메일과 비밀번호로 로그인을 요청한다.
export async function signInWithEmail(
  email: string,
  password: string,
): Promise<{ user: User | null; error: Error | null }> {
  // Supabase Auth 비밀번호 로그인 API를 호출한다.
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) {
    return { user: null, error: new Error(error.message) };
  }

  return { user: data.user, error: null };
}

// 현재 로그인된 사용자 계정을 로그아웃한다.
export async function signOutUser(): Promise<{ error: Error | null }> {
  // Supabase 세션을 종료하고 안전 저장소의 토큰을 정리한다.
  const { error } = await supabase.auth.signOut();

  if (error) {
    return { error: new Error(error.message) };
  }

  return { error: null };
}

// 현재 활성화된 세션의 사용자 객체를 가져온다.
export async function getCurrentAuthUser(): Promise<User | null> {
  // Supabase Auth 상태에서 현재 사용자 정보를 안전하게 조회한다.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

// 이메일 주소에서 @ 앞부분을 기본 닉네임으로 추출한다.
export function splitEmailPrefix(email: string): string {
  // 골뱅이 기호 기준 앞부분 문자열을 반환한다.
  const prefix = email.split('@')[0]?.trim();
  return prefix && prefix.length > 0 ? prefix : '여행자';
}
