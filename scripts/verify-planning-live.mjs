import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';

const origin = 'https://tripprint-api-staging.gametps.workers.dev';
const webOrigin = 'https://tripprint-staging.pages.dev';
const state = {
  token: '',
  tripId: '',
  userId: '',
  requests: [],
  verified: false,
  cleaned: false,
};
const reportPath = 'outputs/planning-v11/live-evidence.json';

// staging 쓰기는 명시적으로 실행한 경우에만 허용하며 운영 주소는 받지 않는다.
assert.equal(
  process.env.TRIPPRINT_VERIFY_STAGING,
  '1',
  '비공개 staging 등록 검수는 TRIPPRINT_VERIFY_STAGING=1로 실행하세요.',
);

// 인증 원문·비밀번호는 메모리에만 두고 오류 코드와 상태만 증거로 기록한다.
async function request(path, { method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(origin + path, {
    method,
    headers: {
      Origin: webOrigin,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  state.requests.push({ method, path, status: response.status });
  const data = await response.json();
  assert.ok(
    response.ok,
    `${method} ${path}: HTTP ${response.status} ${data.error?.code || data.code || ''}`,
  );
  return { response, data };
}

// 매 명령은 조회한 실제 버전과 새 멱등 키로 원자 저장한다.
async function command(operation, input) {
  const snapshot = await workspace();
  await request(`/api/v1/trips/${state.tripId}/commands`, {
    method: 'POST',
    body: { operation, input },
    headers: {
      'Idempotency-Key': randomUUID(),
      'If-Match': `"trip:${state.tripId}:${snapshot.trip.version}"`,
    },
  });
  return workspace();
}

// 쓰기 응답을 읽은 결과로 대체하지 않고 매번 새 HTTP 요청을 보낸다.
async function workspace() {
  return (await request(`/api/v1/trips/${state.tripId}/workspace`)).data.data;
}

// 이번에 만든 비공개 검수 여행만 편집하고 고객의 기존 자료에는 접근하지 않는다.
async function verify() {
  const suffix = randomBytes(5).toString('hex');
  const email = `v11-plan-${suffix}@example.test`;
  const password = randomBytes(24).toString('base64url');
  const name = `V11${suffix}`;
  const signup = await request('/api/auth/sign-up/email', {
    method: 'POST',
    body: { name, email, password },
  });
  state.token = signup.response.headers.get('set-auth-token');
  state.userId = signup.data.user.id;
  assert.ok(state.token);
  await request('/api/v1/profile', {
    method: 'PATCH',
    body: { nickname: name, birthDate: null, onboardingCompleted: true },
  });
  const created = await request('/api/v1/trips', {
    method: 'POST',
    headers: { 'Idempotency-Key': randomUUID() },
    body: {
      title: '비공개 V11 여행계획 등록 검수',
      country: '일본',
      city: '오사카',
      startDate: '2026-11-10',
      endDate: '2026-11-12',
      timezone: 'Asia/Tokyo',
      defaultCurrency: 'KRW',
      flights: [
        {
          number: 'RS0715',
          departure: 'ICN',
          arrival: 'KIX',
          date: '2026-11-10',
          time: '09:00',
          arrivalTime: '11:00',
          role: 'outbound',
        },
        {
          number: 'RS0712',
          departure: 'KIX',
          arrival: 'ICN',
          date: '2026-11-12',
          time: '20:00',
          arrivalTime: '22:00',
          role: 'inbound',
        },
      ],
    },
  });
  state.tripId = created.data.data.tripId;
  const initial = await workspace();
  assert.equal(initial.days.length, 3);
  assert.equal(initial.itinerary.filter((item) => item.flight).length, 2);
  assert.equal(initial.itinerary[0].dayId, initial.days[0].id);
  assert.equal(initial.itinerary[1].dayId, initial.days[2].id);
  const first = {
    id: randomUUID(),
    dayId: initial.days[1].id,
    type: 'PLACE',
    title: '오사카성',
    timeSlot: '09:30',
    sortOrder: 1,
    memo: '비공개 검수',
    planContent: { description: '공원 산책' },
  };
  const second = {
    ...first,
    id: randomUUID(),
    title: '구로몬 시장',
    timeSlot: '12:30',
    sortOrder: 2,
  };
  await command('schedule.save', first);
  await command('schedule.save', second);
  await command('schedule.save', {
    ...first,
    title: '오사카성 천수각',
    timeSlot: '10:00',
    planContent: { description: '천수각을 보고 공원을 걸어요.' },
  });
  const reordered = await command('schedule.reorder', {
    dayId: initial.days[1].id,
    ids: [second.id, first.id],
  });
  assert.equal(
    reordered.itinerary.find((item) => item.id === second.id).sortOrder,
    1,
  );
  const deleted = await command('schedule.delete', { id: second.id });
  assert.equal(
    deleted.itinerary.some((item) => item.id === second.id),
    false,
  );
  await request('/api/auth/sign-out', { method: 'POST', body: {} });
  state.token = '';
  const signin = await request('/api/auth/sign-in/email', {
    method: 'POST',
    body: { email, password },
  });
  state.token = signin.response.headers.get('set-auth-token');
  assert.ok(state.token);
  const restored = await workspace();
  assert.deepEqual(restored.days, initial.days);
  assert.deepEqual(restored.itinerary, deleted.itinerary);
  assert.equal(
    restored.itinerary.find((item) => item.id === first.id).title,
    '오사카성 천수각',
  );
  assert.equal(
    restored.itinerary.find((item) => item.id === first.id).planContent
      .description,
    '천수각을 보고 공원을 걸어요.',
  );
  assert.equal(restored.postId, null);
  state.verified = true;
  state.result = {
    tripId: state.tripId,
    version: restored.trip.version,
    days: restored.days,
    itinerary: restored.itinerary,
    postId: null,
    reloginRestored: true,
  };
}

// 검사 후 이번 비공개 여행의 항목만 지운다. 전체 여행·계정 삭제 완료로 기록하지 않는다.
async function cleanup() {
  if (!state.tripId || !state.token) return;
  const snapshot = await workspace();
  for (const item of snapshot.itinerary)
    await command('schedule.delete', { id: item.id });
  const cleaned = await workspace();
  assert.equal(cleaned.itinerary.length, 0);
  assert.equal(cleaned.postId, null);
  state.cleaned = true;
}

try {
  await verify();
} catch (failure) {
  state.failure = failure.message;
  process.exitCode = 1;
} finally {
  try {
    await cleanup();
    if (state.token)
      await request('/api/auth/sign-out', { method: 'POST', body: {} });
  } catch (failure) {
    state.cleanupFailure = failure.message;
    process.exitCode = 1;
  }
  mkdirSync('outputs/planning-v11', { recursive: true });
  const evidence = { ...state };
  delete evidence.token;
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        ...evidence,
        environment: 'staging',
        residualPrivateAccount: Boolean(state.userId),
        residualPrivateTrip: Boolean(state.tripId),
        credentialsPersisted: false,
        publicPostCreated: false,
        androidBuildExecuted: false,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      verified: state.verified,
      cleaned: state.cleaned,
      reportPath,
      failure: state.failure || state.cleanupFailure || null,
    }),
  );
}
