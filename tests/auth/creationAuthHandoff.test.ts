import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  rememberCreation,
  restoreCreation,
  clearCreationHandoff,
} from '../../apps/mobile/src/features/workspace/creationAuthHandoff';
import {
  authReturn,
  authReturnPath,
  storedAuthReturn,
} from '../../apps/mobile/src/features/auth/model/authReturn';
import { isPublicBrowsePath } from '../../apps/mobile/src/features/auth/model/publicRoutes';

const id = '00000000-0000-4000-8000-000000000011';
test('DEV01 네이티브의 window 전역만 있어도 브라우저 저장소를 요구하지 않는다', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: globalThis,
  });
  try {
    const form = { kind: 'trip' as const, id, values: { country: '일본' } };
    assert.equal(rememberCreation(form, 'basics'), id);
    assert.equal(restoreCreation(id)?.values.country, '일본');
    clearCreationHandoff(id);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
test('DEV01 로그인 복귀는 입력·단계·멱등 키를 보존하고 계정 변경·만료를 차단한다', () => {
  const form = {
    kind: 'trip' as const,
    id,
    values: { country: '일본', title: '나의 여행' },
  };
  assert.equal(rememberCreation(form, 'basics', 100), id);
  form.values.title = '원본 변경';
  assert.equal(restoreCreation(id, undefined, 200)?.values.title, '나의 여행');
  assert.equal(
    restoreCreation(id, 'member-a', 200)?.values._creationStep,
    'basics',
  );
  assert.equal(restoreCreation(id, 'member-b', 200), undefined);
  assert.equal(restoreCreation(id, 'member-a', 3600100), undefined);
  clearCreationHandoff(id);
  assert.equal(restoreCreation(id, 'member-a', 200), undefined);
});

test('DEV01 명시한 작성 복귀는 오래된 초대보다 우선하며 저장소 복귀값도 검증한다', () => {
  const target = authReturn('new-trip', undefined, id);
  assert.deepEqual(authReturnPath(target, '/invite'), {
    pathname: '/new-trip',
    params: { destination: '', handoff: id },
  });
  assert.deepEqual(
    storedAuthReturn(JSON.stringify({ ...target, savedAt: 100 }), 200),
    target,
  );
  assert.equal(
    authReturn('new-trip', undefined, '../private').tripId,
    undefined,
  );
  assert.equal(isPublicBrowsePath('/new-trip'), true);
  assert.equal(isPublicBrowsePath(`/trips/${id}`), false);
});
