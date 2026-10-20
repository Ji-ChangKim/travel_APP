import assert from 'node:assert/strict';
import { test } from 'node:test';
import { oauthStep } from '../../apps/mobile/src/features/auth/oauthSteps';

test('OAuth 동기·비동기 실패 진단에 자격 증명·오류 원문·임의 오류 이름을 넣지 않는다', async () => {
  // 민감한 표식이 포함된 실패도 허용한 단계와 오류 종류만 기록한다.
  for (const asynchronous of [false, true]) {
    const events: unknown[] = [];
    const error = new Error('PRIVATE_TOKEN_IN_MESSAGE');
    error.name = 'PRIVATE_TOKEN_IN_NAME';
    await assert.rejects(
      oauthStep(
        'nonce',
        () => {
          // 같은 실패를 동기와 Promise 양쪽 경계에서 재현한다.
          if (asynchronous) return Promise.reject(error);
          throw error;
        },
        (event) => {
          // 진단 형식만 검사하며 전역 로그를 바꾸지 않는다.
          events.push(event);
        },
      ),
    );
    assert.deepEqual(events, [{ step: 'nonce', kind: 'OtherError' }]);
    assert.equal(JSON.stringify(events).includes('PRIVATE_TOKEN'), false);
  }
});

test('정상 OAuth 단계의 결과는 그대로 전달하고 실패 진단을 만들지 않는다', async () => {
  // 진단 추가가 인증 성공이나 반환 값을 대체하지 않아야 한다.
  let reports = 0;
  assert.equal(
    await oauthStep(
      'prepare',
      () => {
        // 검증할 실제 반환 값만 제공한다.
        return 42;
      },
      () => {
        // 성공에서 진단이 발생하면 검사에 실패한다.
        reports++;
      },
    ),
    42,
  );
  assert.equal(reports, 0);
});
