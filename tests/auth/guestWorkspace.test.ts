import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import type { Profile } from '@wherego/domain';
import {
  emptyGuestWorkspace,
  guestWorkspaceRequest,
  GuestWorkspaceError,
  type GuestWorkspace,
} from '../../apps/mobile/src/services/guestWorkspaceModel';

const guest: Profile = {
  id: randomUUID(),
  nickname: 'Quest-A1B2C3',
  authProvider: 'guest',
  createdAt: '2026-10-12T00:00:00Z',
  updatedAt: '2026-10-12T00:00:00Z',
};
const input = {
  country: '일본',
  city: '도쿄',
  startDate: '2026-11-01',
  endDate: '2026-11-03',
  timezone: 'Asia/Tokyo',
  defaultCurrency: 'JPY',
  flight: { number: 'KE123', departure: 'ICN', arrival: 'NRT', time: '09:00' },
};

// 한 요청의 사용자·키·버전·본문을 순수 로컬 처리에 전달한다.
function request(
  document: GuestWorkspace,
  path: string,
  method = 'GET',
  body?: unknown,
  key: string = randomUUID(),
  version?: string,
) {
  // 네트워크나 파일 저장을 흉내 내지 않고 실제 변경 규칙을 실행한다.
  return guestWorkspaceRequest(
    document,
    guest,
    path,
    method,
    body,
    new Headers({
      'Idempotency-Key': key,
      ...(version ? { 'If-Match': version } : {}),
    }),
    randomUUID,
  );
}

// 새 여행을 가진 로컬 문서를 준비한다.
function created(): GuestWorkspace {
  // 실제 국가·기간·항공편 검증을 통과한 문서를 사용한다.
  return request(emptyGuestWorkspace(guest.id), '/trips', 'POST', input)
    .document;
}

// 지정 여행의 현재 버전으로 명령 한 개를 적용한다.
function command(
  document: GuestWorkspace,
  operation: string,
  value: unknown,
  key: string = randomUUID(),
) {
  // 클라이언트가 보내는 동일한 버전 헤더 계약을 사용한다.
  return request(
    document,
    `/trips/${document.trips[0]!.trip.id}/commands`,
    'POST',
    { operation, input: value },
    key,
    `"trip:${document.trips[0]!.trip.id}:${document.trips[0]!.trip.version}"`,
  );
}

test('기기 게스트 여행은 UUID·DAY·항공편과 고유 닉네임을 보존한다', () => {
  // JSON 저장·재읽기 뒤에도 같은 소유자와 일정을 유지한다.
  return checkedCreation(
    JSON.parse(JSON.stringify(created())) as GuestWorkspace,
  );
});

// 저장 가능한 스냅샷의 초기 계약을 확인한다.
function checkedCreation(document: GuestWorkspace): void {
  // 다른 기기의 빈 문서에는 이 여행이 존재하지 않는다.
  return void (assert.equal(document.ownerId, guest.id),
  assert.equal(document.trips.length, 1),
  assert.equal(document.trips[0]!.days.length, 3),
  assert.equal(document.trips[0]!.members[0]!.nickname, guest.nickname),
  assert.match(document.trips[0]!.itinerary[0]!.title, /KE123/),
  assert.equal(emptyGuestWorkspace(randomUUID()).trips.length, 0));
}

test('게스트 생성 응답 유실 재시도는 동일 키로 여행을 중복 생성하지 않는다', () => {
  // 같은 키의 다른 입력은 기존 성공 문서를 바꾸지 않는다.
  return checkReplay(randomUUID());
});

// 생성 재시도 결과와 키 재사용 거부를 확인한다.
function checkReplay(key: string): void {
  // 서버 응답 없이도 기기 요청 기록이 중복을 막는다.
  const first = request(
    emptyGuestWorkspace(guest.id),
    '/trips',
    'POST',
    input,
    key,
  );
  // 저장했던 문서에 같은 요청을 다시 적용한다.
  const second = request(first.document, '/trips', 'POST', input, key);
  // 읽기 재생은 추가 저장을 요구하지 않는다.
  return void (assert.deepEqual(second.data, first.data),
  assert.equal(second.replayed, true),
  assert.equal(second.document.trips.length, 1),
  assert.equal(second.write, false),
  assert.throws(() => {
    // 변경된 본문을 이전 성공으로 취급하지 않는다.
    return request(
      first.document,
      '/trips',
      'POST',
      { ...input, city: '오사카' },
      key,
    );
  }, GuestWorkspaceError));
}

test('게스트 일정·비용·완료 상태는 공통 검증 규칙으로 저장한다', () => {
  // 저장 후 직렬화와 재읽기를 거쳐 기록을 대조한다.
  return checkPersonalCommands(created());
});

// 기본 개인 기록을 하나의 여행 안에서 연결한다.
function checkPersonalCommands(document: GuestWorkspace): void {
  // 여행 DAY의 UUID를 실제 일정에 연결한다.
  const scheduled = command(document, 'schedule.save', {
    id: randomUUID(),
    dayId: document.trips[0]!.days[1]!.id,
    title: '도쿄 식당',
    type: 'PLACE',
    sortOrder: 2,
  }).document;
  // 실제 비용을 저장한다.
  const spent = command(scheduled, 'expense.save', {
    id: randomUUID(),
    title: '점심',
    amount: '1500',
    currency: 'JPY',
    category: 'food',
    isActual: true,
  }).document;
  // 완료 상태는 원격 게시 없이 기기에서만 바꾼다.
  const completed = command(spent, 'trip.update', {
    title: '도쿄 여행',
    country: '일본',
    city: '도쿄',
    status: 'COMPLETED',
  }).document;
  // 기존 항공편과 새 일정·비용을 함께 유지한다.
  return void (assert.equal(completed.trips[0]!.itinerary.length, 2),
  assert.equal(completed.trips[0]!.expenses[0]!.amount, '1500'),
  assert.equal(completed.trips[0]!.trip.status, 'COMPLETED'),
  assert.equal(completed.trips[0]!.trip.version, 4));
}

test('게스트 준비물 저장·완료도 현재 여행 버전을 검사한다', () => {
  // 소유자 외 기록과 오래된 버전 쓰기를 거부한다.
  return checkChecklist(created());
});

// 준비물 API의 로컬 저장 결과를 확인한다.
function checkChecklist(document: GuestWorkspace): void {
  // 실제 준비물 경로와 버전 헤더를 사용한다.
  const trip = document.trips[0]!.trip;
  // 준비물 한 개를 생성한다.
  const added = request(
    document,
    `/trips/${trip.id}/checklists`,
    'POST',
    { title: '여권' },
    randomUUID(),
    `"trip:${trip.id}:1"`,
  ).document;
  // 원하는 완료 여부를 명시적으로 저장한다.
  const checked = request(
    added,
    `/checklists/${added.trips[0]!.checklists[0]!.id}`,
    'PATCH',
    { isCompleted: true },
    randomUUID(),
    `"trip:${trip.id}:2"`,
  );
  // 체크리스트 상태와 충돌 거부를 함께 검사한다.
  return void (assert.equal(
    checked.document.trips[0]!.checklists[0]!.isCompleted,
    true,
  ),
  assert.throws(() => {
    // 이전 화면의 버전으로 다시 쓰지 못한다.
    return request(
      checked.document,
      `/trips/${trip.id}/checklists`,
      'POST',
      { title: '환전' },
      randomUUID(),
      `"trip:${trip.id}:1"`,
    );
  }, GuestWorkspaceError));
}

test('다른 게스트 UUID와 회원 프로필로 기기 여행을 읽거나 변경할 수 없다', () => {
  // 개인 기록의 범위는 로컬 문서 소유자와 현재 프로필 둘 다 일치해야 한다.
  return ['guest', 'email'].forEach((authProvider) => {
    // 원격 인증 여부와 무관하게 잘못된 로컬 범위는 거부한다.
    return assert.throws(() => {
      // 같은 저장 함수를 다른 계정에 재사용하지 않는다.
      return guestWorkspaceRequest(
        created(),
        {
          ...guest,
          id: randomUUID(),
          authProvider: authProvider as Profile['authProvider'],
        },
        '/trips',
        'GET',
        undefined,
        new Headers(),
        randomUUID,
      );
    }, GuestWorkspaceError);
  });
});

test('게스트 초대·공개 게시·멤버 변경은 원격 저장으로 우회하지 않는다', () => {
  // 미지원 행동은 회원 전환이 필요한 오류로 명시적으로 거부한다.
  return [
    { operation: 'invite.create', input: { role: 'viewer' } },
    { operation: 'community.withdraw', input: {} },
    { operation: 'member.remove', input: { userId: randomUUID() } },
  ].forEach((value) => {
    // 서버 요청으로 대체하거나 가짜 공유 결과를 만들지 않는다.
    return assert.throws(
      () => {
        // 허용한 개인 작업 밖의 명령만 검사한다.
        return command(created(), value.operation, value.input);
      },
      (error) => {
        // UI가 회원가입 안내로 구분할 수 있는 코드를 확인한다.
        return (
          error instanceof GuestWorkspaceError &&
          error.code === 'MEMBERSHIP_REQUIRED'
        );
      },
    );
  });
});

test('기기 사진은 등록된 원본만 조회하고 삭제 후에는 접근할 수 없다', () => {
  // 미디어 메타데이터와 파일의 존재를 함께 확인한다.
  return checkMedia(created(), randomUUID());
});

// 영구 사진 등록과 삭제를 검사한다.
function checkMedia(document: GuestWorkspace, id: string): void {
  // 경로 형식은 서버와 같은 여행/미디어 UUID를 사용한다.
  const trip = document.trips[0]!.trip.id;
  // 웹에 실제 보관할 원본 URI를 문서에 저장한다.
  const path = `${trip}/${id}.png`;
  // 등록 전 파일 위치만 저장된 상태를 준비한다.
  const prepared = {
    ...document,
    files: {
      [path]: {
        uri: 'data:image/png;base64,AAAA',
        mimeType: 'image/png' as const,
      },
    },
  };
  // 원본이 존재할 때만 메타데이터를 등록한다.
  const registered = command(prepared, 'media.register', {
    id,
    path,
    mimeType: 'image/png',
    purpose: 'photo',
  }).document;
  // 미디어 ID 조회는 보관한 원본만 반환한다.
  const media = request(registered, `/trips/${trip}/media/${id}/url`).data;
  // 명시적 삭제 후 원본 참조도 제거한다.
  const removed = command(registered, 'media.delete', { id }).document;
  // 파일 URI와 삭제 이후 거부를 확인한다.
  return void (assert.deepEqual(media, { url: 'data:image/png;base64,AAAA' }),
  assert.equal(removed.files[path], undefined),
  assert.throws(() => {
    // 삭제된 메타데이터를 이용한 재조회는 실패해야 한다.
    return request(removed, `/trips/${trip}/media/${id}/url`);
  }, GuestWorkspaceError));
}
