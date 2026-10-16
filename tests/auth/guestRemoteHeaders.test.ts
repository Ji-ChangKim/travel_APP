import assert from 'node:assert/strict';
import { test } from 'node:test';
import { guestRemoteHeaders } from '../../apps/mobile/src/services/guestRemoteHeaders';

const initialHeaders: HeadersInit[] = [
  new Headers({ authorization: 'Bearer ' }),
  { Authorization: 'Bearer previous' },
  { authorization: 'Bearer previous', Authorization: 'Bearer other' },
];

test('게스트 원격 요청은 소문자·대문자 인증 헤더를 서버 토큰 하나로 교체한다', () => {
  // 예전 빈 토큰이 실제 토큰 앞에 결합되는 회귀를 재현한다.
  return initialHeaders.forEach((initial) => {
    // 어떤 형태의 헤더에서도 실제 세션 토큰 하나만 전송한다.
    return assert.equal(
      guestRemoteHeaders(initial, 'current').get('authorization'),
      'Bearer current',
    );
  });
});

test('인증 헤더 교체는 버전·멱등 키와 원래 요청 헤더를 보존한다', () => {
  // 원래 헤더 객체는 다른 요청에서 재사용해도 변하지 않아야 한다.
  return checkedHeaders(
    new Headers({
      authorization: 'Bearer local',
      'If-Match': '"trip:1:4"',
      'Idempotency-Key': 'request-one',
    }),
  );
});

// 요청 식별 헤더와 원본 불변성을 확인한다.
function checkedHeaders(initial: Headers): void {
  // 인증 이외의 동시성·재시도 계약을 바꾸지 않는다.
  return void (assert.equal(
    guestRemoteHeaders(initial, 'current').get('if-match'),
    '"trip:1:4"',
  ),
  assert.equal(
    guestRemoteHeaders(initial, 'current').get('idempotency-key'),
    'request-one',
  ),
  assert.equal(initial.get('authorization'), 'Bearer local'));
}
