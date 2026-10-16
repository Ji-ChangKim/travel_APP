import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FoundationClientError, requestFoundation } from '@wherego/api-client';
import {
  canReviseWorkspaceRequest,
  isWorkspaceVersionConflict,
} from '../../apps/mobile/src/features/workspace/saveRecovery';

// 게이트웨이의 HTML 오류도 HTTP 상태를 유지해야 수정·재시도 경로를 고를 수 있다.
test('비JSON 오류 응답의 HTTP 상태와 안전한 오류 객체를 보존한다', () => {
  // 실제 네트워크 대신 Response 경계만 대체한다.
  return assert.rejects(
    requestFoundation(
      {
        baseUrl: 'https://fixture.invalid',
        accessToken: 'fixture',
        fetcher: () => {
          // 내부 HTML이나 인증 원문은 오류 payload로 남기지 않는다.
          return Promise.resolve(
            new Response('<html>private gateway detail</html>', {
              status: 429,
            }),
          );
        },
      },
      '/trips',
    ),
    (error: unknown) => {
      // 요청 제한은 입력·재시도 선택을 다시 허용하고 내부 원문은 노출하지 않는다.
      return (
        error instanceof FoundationClientError &&
        error.status === 429 &&
        error.payload === null &&
        canReviseWorkspaceRequest(error) &&
        !error.message.includes('private')
      );
    },
  );
});

// 성공 상태의 파손된 응답은 실제 저장 여부를 알 수 없으므로 같은 요청을 유지한다.
test('파손된 성공 응답은 입력 수정 가능한 저장 거부로 판단하지 않는다', () => {
  // 쓰기 요청의 성공 본문 손상을 재현한다.
  return assert.rejects(
    requestFoundation(
      {
        baseUrl: 'https://fixture.invalid',
        accessToken: 'fixture',
        fetcher: () => {
          // HTTP 성공만으로 요청 결과를 지우지 않는다.
          return Promise.resolve(new Response('broken', { status: 200 }));
        },
      },
      '/trips',
      { method: 'POST' },
    ),
    (error: unknown) => {
      // 성공 본문 해석 실패는 응답 유실과 동일하게 보수적으로 복구한다.
      return error instanceof SyntaxError && !canReviseWorkspaceRequest(error);
    },
  );
});

// 입력이 저장되지 않았다는 서버 거부만 폼 수정으로 복구한다.
test('입력·권한·요청 제한 거부는 작성 내용을 수정할 수 있다', () => {
  // 해당 상태는 업무 저장 이전의 거부 결과다.
  return [400, 403, 404, 410, 413, 422, 428, 429].forEach((status) => {
    // 저장 실패로 전체 폼을 영구 잠그지 않는다.
    return assert.equal(
      canReviseWorkspaceRequest(new FoundationClientError(status, null)),
      true,
    );
  });
});

// 응답 유실과 서버 장애는 같은 멱등 요청을 재전송해야 한다.
test('통신·인증·서버 오류는 원래 저장 본문과 요청 키를 유지한다', () => {
  // 저장 여부를 확정할 수 없는 경계를 함께 검사한다.
  return [
    new TypeError('offline'),
    new DOMException('timeout', 'TimeoutError'),
    ...[401, 408, 409, 500, 502, 503, 504].map((status) => {
      // 원문을 포함하지 않은 HTTP 실패 객체를 사용한다.
      return new FoundationClientError(status, null);
    }),
  ].forEach((error) => {
    // 새 요청 키로 중복 저장하지 않는다.
    return assert.equal(canReviseWorkspaceRequest(error), false);
  });
});

// 같은 409라도 요청 키 문제는 최신 버전 충돌 복구와 구분한다.
test('여행 버전 충돌에만 최신 조회 후 새 요청을 허용한다', () => {
  // 잘못된 키를 새 키로 바꾸어 중복 기록을 만들지 않는다.
  return [
    'VERSION_CONFLICT',
    'REQUEST_KEY_REUSED',
    'REQUEST_KEY_EXPIRED',
    'TRIP_ARCHIVED',
  ].forEach((code) => {
    // 코드와 상태가 모두 버전 충돌을 나타내야 한다.
    return assert.equal(
      isWorkspaceVersionConflict(
        new FoundationClientError(409, { error: { code } }),
      ),
      code === 'VERSION_CONFLICT',
    );
  });
});
