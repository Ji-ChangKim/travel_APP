import { z } from 'zod';
import { communityPostSchema } from '@wherego/validation';
import { getCommunity } from '@wherego/api-client';
import { apiBaseUrl, serverOptions } from './service';
import { useTripStore } from '@/stores/useTripStore';

// 회원은 차단이 적용된 피드를, 로그인하지 않은 방문자는 공개 피드를 읽는다.
export function loadCommunity(userId: string, offset = 0) {
  // 공개 조회를 위해 익명 계정이나 인증 토큰을 새로 만들지 않는다.
  return userId && useTripStore.getState().currentUser?.authProvider !== 'guest'
    ? serverOptions(userId).then((options) => {
        // 인증된 계정의 차단 목록은 서버에서 적용한다.
        return getCommunity(options, offset);
      })
    : fetch(
        `${apiBaseUrl().replace(/\/$/, '')}/public/community?offset=${offset}`,
        { signal: AbortSignal.timeout(15000) },
      ).then(readPublicCommunity);
}

// 정상 응답의 공개 계약만 홈과 커뮤니티에 전달한다.
function readPublicCommunity(response: Response) {
  // 서버 오류를 공개 글이 없는 상태로 바꾸지 않는다.
  return response.ok
    ? response.json().then((payload: unknown) => {
        // 원본 여행·개인정보 대신 공개 게시물 배열만 읽는다.
        return z.object({ data: z.array(communityPostSchema) }).parse(payload)
          .data;
      })
    : Promise.reject(
        new Error(
          '여행 이야기를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
        ),
      );
}
