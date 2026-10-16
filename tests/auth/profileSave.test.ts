import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Profile } from '@wherego/domain';
import {
  saveScopedProfile,
  type ProfileSaveScope,
} from '../../apps/mobile/src/features/auth/profileSave';
import { profileUpdateState } from '../../apps/mobile/src/features/auth/model';

const accountA = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const accountB = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';

// 토큰 없이 프로필 저장 응답만 검증한다.
function profile(id = accountA): Profile {
  // 다른 계정의 응답도 같은 공개 프로필 구조를 사용한다.
  return {
    id,
    nickname: '수정한 여행자',
    avatarUrl: null,
    authProvider: 'email',
    osPlatform: 'web',
    createdAt: '2026-10-14',
    updatedAt: '2026-10-14',
  };
}

// 응답 시점을 테스트가 직접 제어한다.
function deferred<T>() {
  // 임의 시간 대기 없이 지연 성공과 실패를 재현한다.
  const callbacks: {
    resolve?: (value: T) => void;
    reject?: (error: unknown) => void;
  } = {};
  const promise = new Promise<T>((resolve, reject) => {
    // 서버 응답 경계만 수동으로 해제한다.
    return Object.assign(callbacks, { resolve, reject });
  });
  return { promise, callbacks };
}

// 프로필 저장의 모든 Promise 콜백이 끝난 다음 상태를 확인한다.
function settled(): Promise<void> {
  // 실제 타이머 지연 없이 다음 이벤트 루프로 진행한다.
  return new Promise((resolve) => {
    // 마이크로태스크의 성공·실패·정리를 모두 기다린다.
    return setImmediate(resolve);
  });
}

// 저장에 연결된 UI 효과를 한 목록으로 관찰한다.
function handlers(events: string[]) {
  // 실제 요청 제어기는 성공·실패·정리를 따로 호출한다.
  return {
    success: () => {
      // 성공한 현재 계정 요청만 기록한다.
      return void events.push('success');
    },
    failure: () => {
      // 이전 계정의 오류 안내가 새 폼에 나타나는지 검사한다.
      return void events.push('failure');
    },
    finish: () => {
      // 늦은 정리 콜백이 새 폼의 잠금을 푸는지 검사한다.
      return void events.push('finish');
    },
  };
}

test('프로필 저장은 연속 탭을 한 요청으로 묶고 정상 성공만 반영한다', async () => {
  // UI 렌더 이전의 중복 제출도 실제 요청 수로 확인한다.
  const scope: ProfileSaveScope = {
    accountId: accountA,
    active: true,
    sequence: 0,
    running: false,
  };
  const response = deferred<Profile>();
  const events: string[] = [];
  let calls = 0;
  const save = () => {
    // 중복 네트워크 호출을 세고 실제 응답을 기다린다.
    return (++calls, response.promise);
  };
  saveScopedProfile(
    scope,
    () => {
      // 요청을 시작한 계정을 유지한다.
      return accountA;
    },
    save,
    handlers(events),
  );
  saveScopedProfile(
    scope,
    () => {
      // 렌더 전 두 번째 탭도 같은 계정이다.
      return accountA;
    },
    save,
    handlers(events),
  );
  await settled();
  assert.equal(calls, 1);
  response.callbacks.resolve!(profile());
  await settled();
  assert.deepEqual(events, ['success', 'finish']);
  assert.equal(scope.running, false);
});

for (const result of ['success', 'failure'] as const) {
  // 저장 성공과 실패 모두 계정 전환 이후에는 화면 효과를 실행하지 않는다.
  test(`계정 전환 뒤 프로필 ${result} 응답은 새 계정과 정리 콜백에 반영하지 않는다`, async () => {
    // 응답 대기 중 계정이 바뀌는 실제 경합을 재현한다.
    const scope: ProfileSaveScope = {
      accountId: accountA,
      active: true,
      sequence: 0,
      running: false,
    };
    const response = deferred<Profile>();
    const events: string[] = [];
    let account = accountA;
    saveScopedProfile(
      scope,
      () => {
        // 완료 콜백이 현재 계정을 다시 읽도록 한다.
        return account;
      },
      () => {
        // 서버 응답만 지연한다.
        return response.promise;
      },
      handlers(events),
    );
    await settled();
    account = accountB;
    void (result === 'success'
      ? response.callbacks.resolve!(profile())
      : response.callbacks.reject!(new Error('network')));
    await settled();
    assert.deepEqual(events, []);
  });
}

test('화면 해제 뒤 같은 계정으로 돌아와도 이전 저장 응답은 적용하지 않는다', async () => {
  // A→B→A 전환과 같은 UUID의 새 편집 화면을 구분한다.
  const scope: ProfileSaveScope = {
    accountId: accountA,
    active: true,
    sequence: 0,
    running: false,
  };
  const response = deferred<Profile>();
  const events: string[] = [];
  saveScopedProfile(
    scope,
    () => {
      // 계정 ID만 비교해서 이전 화면을 되살리지 않아야 한다.
      return accountA;
    },
    () => {
      // 저장이 진행된 뒤 화면을 해제한다.
      return response.promise;
    },
    handlers(events),
  );
  await settled();
  scope.active = false;
  scope.sequence++;
  response.callbacks.resolve!(profile());
  await settled();
  assert.deepEqual(events, []);
});

test('현재 계정의 프로필 저장 실패는 입력 복구를 허용하고 다른 UUID 응답은 거부한다', async () => {
  // 실패 후 다시 저장할 수 있으며 잘못된 성공 응답도 병합하지 않는다.
  const scope: ProfileSaveScope = {
    accountId: accountA,
    active: true,
    sequence: 0,
    running: false,
  };
  const events: string[] = [];
  const account = () => {
    // 같은 계정의 연속 요청을 검사한다.
    return accountA;
  };
  saveScopedProfile(
    scope,
    account,
    () => {
      // 네트워크 실패를 정상 저장으로 바꾸지 않는다.
      return Promise.reject(new Error('network'));
    },
    handlers(events),
  );
  await settled();
  assert.equal(scope.running, false);
  saveScopedProfile(
    scope,
    account,
    () => {
      // 다른 계정 응답을 서버 성공으로 가정해 전달한다.
      return Promise.resolve(profile(accountB));
    },
    handlers(events),
  );
  await settled();
  assert.deepEqual(events, ['failure', 'finish', 'failure', 'finish']);
  assert.equal(
    profileUpdateState(profile(accountB), profile(accountA)).currentUser?.id,
    accountB,
  );
  assert.equal(profileUpdateState(null, profile(accountA)).currentUser, null);
  assert.equal(
    profileUpdateState(profile(accountA), { nickname: '같은 계정' }).currentUser
      ?.nickname,
    '같은 계정',
  );
});
