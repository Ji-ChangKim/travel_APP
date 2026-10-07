import { z } from 'zod';
import { acceptSession, authBaseUrl, getCloudSession } from './cloudAuth';
import { Platform } from 'react-native';

// 기존 게스트 세션을 우선 복원하고 없을 때만 서버에서 발급받는다.
export function guestSession() {
  // 임의 식별값으로 로그인 성공을 만들지 않는다.
  return getCloudSession().then((session) => {
    // 재시작 시 동일 회원의 여행을 이어간다.
    return session?.user.isAnonymous ? session : createGuestSession();
  });
}

// D1 회원과 서명된 토큰을 함께 발급받는다.
function createGuestSession() {
  // 실패한 계정 생성은 재시도할 수 있게 한다.
  return fetch(`${authBaseUrl()}/api/auth/sign-in/anonymous`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(Platform.OS !== 'web' ? { Origin: 'travelapp://' } : {}),
    },
    body: '{}',
    signal: AbortSignal.timeout(30000),
  }).then((response) => {
    // 서버 헤더의 서명 토큰만 보관한다.
    return response.ok
      ? response.json().then((body) => {
          // 게스트 회원 계약을 확인한다.
          return acceptSession(
            z
              .object({
                user: z.object({
                  id: z.string().uuid(),
                  name: z.string(),
                  email: z.string(),
                  image: z.string().nullable().optional(),
                  createdAt: z.union([z.string(), z.number()]),
                  updatedAt: z.union([z.string(), z.number()]),
                  isAnonymous: z.literal(true),
                }),
              })
              .parse(body).user,
            response.headers.get('set-auth-token') || failGuest(),
          );
        })
      : failGuest();
  });
}

// 실패한 게스트 로그인을 한국어 안내로 전달한다.
function failGuest(): never {
  // 서버 내부 오류는 화면에 포함하지 않는다.
  throw new Error(
    '게스트 로그인을 시작하지 못했어요. 연결을 확인하고 다시 시도해 주세요.',
  );
}
