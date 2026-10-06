import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { z } from 'zod';
import type { Profile, OsPlatform } from '@wherego/domain';
const tokenKey = 'wherego.cloud.session.v1';
const cloudUserSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string(),
  image: z.string().nullable().optional(),
  createdAt: z.union([z.string(), z.number()]),
  updatedAt: z.union([z.string(), z.number()]),
});
export type CloudUser = z.infer<typeof cloudUserSchema>;
export type CloudSession = { user: CloudUser; access_token: string };
const listeners = new Set<(session: CloudSession | null) => void>();
let revision = 0;

// 비동기 복원에서 계정 전환 시점을 구분한다.
export function authRevision(): number {
  // 세션 원문을 비교용 전역 값으로 노출하지 않는다.
  return revision;
}
// 네이티브 인증 요청도 허용된 앱 Origin을 명시한다.
function authHeaders(): Record<string, string> {
  // 웹 브라우저는 자신의 실제 Origin을 자동으로 전달한다.
  return {
    'Content-Type': 'application/json',
    ...(Platform.OS === 'web' ? {} : { Origin: 'travelapp://' }),
  };
}
// 명시적으로 설정한 여행 API 주소만 사용한다.
export function authBaseUrl(): string {
  // 미설정 예제 서버에 비밀번호를 전송하지 않는다.
  return process.env.EXPO_PUBLIC_API_URL &&
    /^https:\/\/|^http:\/\/(localhost|127\.0\.0\.1):/.test(
      process.env.EXPO_PUBLIC_API_URL,
    )
    ? process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '')
    : fail('지금은 로그인할 수 없어요. 잠시 후 다시 시도해 주세요.');
}
// 안전한 인증 안내만 전달한다.
function fail(message: string): never {
  // 서버 오류 원문과 토큰을 화면에 포함하지 않는다.
  throw new Error(message);
}
// 플랫폼별 저장소에서 토큰을 읽는다.
function readToken(): Promise<string | null> {
  // 서버 렌더링에서는 브라우저 저장소를 읽지 않는다.
  return Platform.OS === 'web'
    ? Promise.resolve(
        typeof localStorage === 'undefined'
          ? null
          : localStorage.getItem(tokenKey),
      )
    : SecureStore.getItemAsync(tokenKey);
}
// 실제 발급 토큰을 기기에 보관한다.
function writeToken(token: string | null): Promise<void> {
  // 로그아웃 시 동일 키를 제거한다.
  return Platform.OS === 'web'
    ? Promise.resolve(
        typeof localStorage === 'undefined'
          ? undefined
          : token
            ? localStorage.setItem(tokenKey, token)
            : localStorage.removeItem(tokenKey),
      )
    : token
      ? SecureStore.setItemAsync(tokenKey, token)
      : SecureStore.deleteItemAsync(tokenKey);
}
// 인증 구독자에게 확인된 세션을 전달한다.
function notifySession(session: CloudSession | null): CloudSession | null {
  // 다른 계정의 이전 세션을 전달하지 않는다.
  return (
    (revision += 1),
    listeners.forEach((listener) => {
      /* 화면 인증 상태를 갱신한다. */ return listener(session);
    }),
    session
  );
}
// 표준 인증 REST 계약으로 가입 또는 로그인을 실행한다.
export function emailSession(
  mode: 'sign-in' | 'sign-up',
  email: string,
  password: string,
  name?: string,
): Promise<CloudSession> {
  // 비밀번호는 지정된 인증 서버로만 보낸다.
  return fetch(`${authBaseUrl()}/api/auth/${mode}/email`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      email: email.trim(),
      password,
      ...(mode === 'sign-up'
        ? { name: name?.trim() || email.split('@')[0] || '여행자' }
        : {}),
    }),
    signal: AbortSignal.timeout(30000),
  }).then((response) => {
    /* 발급 토큰과 사용자를 함께 검사한다. */ return !response.ok
      ? fail(
          response.status === 429
            ? '요청이 많습니다. 잠시 후 다시 시도해 주세요.'
            : '이메일과 비밀번호를 확인하고 다시 시도해 주세요.',
        )
      : response.json().then((data: unknown) => {
          /* 서명된 응답 헤더 토큰을 저장한다. */ return acceptSession(
            z.object({ user: cloudUserSchema }).parse(data).user,
            response.headers.get('set-auth-token') ||
              fail('로그인을 완료하지 못했어요. 다시 시도해 주세요.'),
          );
        });
  });
}
// 발급 세션 저장이 끝난 뒤 이벤트를 보낸다.
function acceptSession(user: CloudUser, token: string): Promise<CloudSession> {
  // 저장 실패를 로그인 성공으로 처리하지 않는다.
  return writeToken(token).then(() => {
    /* 실제 발급 사용자만 전달한다. */ return notifySession({
      user,
      access_token: token,
    })!;
  });
}
// 서버에서 토큰의 만료·철회를 확인한다.
export function getCloudSession(): Promise<CloudSession | null> {
  // 기기 사용자 ID만으로 인증 여부를 판단하지 않는다.
  return readToken().then((token) => {
    /* 토큰이 없으면 로그인 상태가 아니다. */ return !token
      ? null
      : fetch(`${authBaseUrl()}/api/auth/get-session`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(15000),
        }).then((response) => {
          /* 서버 응답으로 세션을 확인한다. */ return response.ok
            ? response.json().then((data: unknown) => {
                /* 만료된 세션만 폐기한다. */ return data
                  ? {
                      user: z.object({ user: cloudUserSchema }).parse(data)
                        .user,
                      access_token:
                        response.headers.get('set-auth-token') || token,
                    }
                  : writeToken(null).then(() => {
                      /* 만료 토큰을 정리한다. */ return notifySession(null);
                    });
              })
            : response.status === 401
              ? writeToken(null).then(() => {
                  /* 거부된 토큰을 제거한다. */ return notifySession(null);
                })
              : fail(
                  '로그인 상태를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.',
                );
        });
  });
}
// 서버 세션을 철회하고 기기 토큰을 제거한다.
export function signOutCloud(): Promise<void> {
  // 서버 철회 실패를 성공으로 처리하지 않는다.
  return readToken()
    .then((token) => {
      /* 실제 서버 철회를 요청한다. */ return token
        ? fetch(`${authBaseUrl()}/api/auth/sign-out`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              ...authHeaders(),
            },
            body: '{}',
            signal: AbortSignal.timeout(15000),
          }).then((response) => {
            /* 실제 철회 성공을 확인한다. */ return response.ok
              ? undefined
              : fail('로그아웃에 실패했습니다. 다시 시도해 주세요.');
          })
        : undefined;
    })
    .then(() => {
      /* 철회 후 기기에서 삭제한다. */ return writeToken(null);
    })
    .then(() => {
      /* 화면 상태도 초기화한다. */ return void notifySession(null);
    });
}
// 확인된 인증 이벤트를 앱 상태와 연결한다.
export function subscribeCloud(
  listener: (session: CloudSession | null) => void,
): () => void {
  // 화면 해제 시 구독을 제거한다.
  return (
    listeners.add(listener),
    () => {
      /* 중복 구독 누수를 방지한다. */ return void listeners.delete(listener);
    }
  );
}
// D1 사용자를 화면용 프로필로 변환한다.
export function cloudProfile(user: CloudUser, osPlatform: OsPlatform): Profile {
  // 실제 회원 UUID와 닉네임을 유지한다.
  return {
    id: user.id,
    nickname: user.name,
    avatarUrl: user.image || null,
    authProvider: 'email',
    osPlatform,
    createdAt: new Date(user.createdAt).toISOString(),
    updatedAt: new Date(user.updatedAt).toISOString(),
    lastSignInAt: new Date().toISOString(),
  };
}
