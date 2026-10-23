import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';

// 배포를 바꾸지 않는 임시 Worker 미리보기에서 실제 공급자·D1 연결을 확인한다.
const origin =
  process.env.TRIPPRINT_PROVIDER_VERIFY_URL || 'http://127.0.0.1:8854';
const email = `planning-${randomBytes(6).toString('hex')}@example.test`;
const password = randomBytes(24).toString('base64url');
const nickname = `Plan${randomBytes(4).toString('hex')}`;
const evidence = {
  origin,
  checkedAt: new Date().toISOString(),
  checks: [],
  providerDataPersisted: null,
};
let token;
let tripId;
let version;
let postId;

// 비밀·공급자 원문을 기록하지 않고 실제 HTTP 실패 상태만 알린다.
async function request(path, { method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(`${origin}${path}`, {
    method,
    headers: {
      Origin:
        process.env.TRIPPRINT_PROVIDER_VERIFY_ORIGIN || 'http://127.0.0.1:8851',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(90000),
  });
  const value = await response.json();
  if (!response.ok)
    throw new Error(
      `${path}: HTTP ${response.status}, ${value.error?.code || 'failed'}`,
    );
  return { response, value };
}
// 저장은 실제 버전과 새 멱등 키로만 실행한다.
async function command(operation, input) {
  const result = await request(`/api/v1/trips/${tripId}/commands`, {
    method: 'POST',
    headers: {
      'Idempotency-Key': randomUUID(),
      'If-Match': `"trip:${tripId}:${version}"`,
    },
    body: { operation, input },
  });
  version = result.value.data.tripVersion;
  return result.value.data;
}

try {
  const signed = await request('/api/auth/sign-up/email', {
    method: 'POST',
    body: { name: nickname, email, password },
  });
  token = signed.response.headers.get('set-auth-token');
  assert.ok(token);
  await request('/api/v1/profile', {
    method: 'PATCH',
    body: { nickname, birthDate: null, onboardingCompleted: true },
  });
  const destinations = [
    {
      id: randomUUID(),
      country: '일본',
      city: '오사카',
      timezone: 'Asia/Tokyo',
    },
    { id: randomUUID(), country: '일본', city: '교토', timezone: 'Asia/Tokyo' },
  ];
  const created = await request('/api/v1/trips', {
    method: 'POST',
    headers: { 'Idempotency-Key': randomUUID() },
    body: {
      title: '여행 기능 연결 검증',
      country: '일본',
      city: '오사카',
      timezone: 'Asia/Tokyo',
      startDate: '2026-11-10',
      endDate: '2026-11-12',
      destinations,
    },
  });
  tripId = created.value.data.trip.id;
  version = created.value.data.tripVersion;
  let snapshot = (await request(`/api/v1/trips/${tripId}/workspace`)).value
    .data;
  await command('trip.destinations', {
    destinations,
    assignments: snapshot.days.map((day, index) => ({
      dayId: day.id,
      destinationId: destinations[index > 0 ? 1 : 0].id,
    })),
  });
  const recommended = (
    await request(`/api/v1/trips/${tripId}/recommendations`, {
      method: 'POST',
      body: {
        dayId: snapshot.days[0].id,
        interest: 'sights',
        pace: 'balanced',
      },
    })
  ).value.data;
  evidence.checks.push({
    name: 'Workers AI + Google Places',
    actualResults: recommended.items.length,
  });
  assert.ok(recommended.items.length >= 1, '실제 추천 검색 결과가 필요합니다.');
  const routePlaces = recommended.items.slice(0, 2);
  if (routePlaces.length < 2) {
    // 추천 개수는 보정하지 않고 별도의 실제 장소 검색으로 이동 구간만 준비한다.
    const searched = (
      await request('/api/v1/places/search?q=' + encodeURIComponent('오사카성'))
    ).value.data;
    const another = searched.find((item) => item.id !== routePlaces[0].placeId);
    assert.ok(another, '경로 조회에 서로 다른 실제 장소가 필요합니다.');
    routePlaces.push({ title: another.title, placeId: another.id });
  }
  for (const [index, item] of routePlaces.entries())
    await command('schedule.save', {
      id: randomUUID(),
      dayId: snapshot.days[0].id,
      title: item.title.slice(0, 100),
      type: 'PLACE',
      timeSlot: '',
      sortOrder: index + 1,
      address: '',
      memo: '',
      googlePlaceId: item.placeId,
    });
  snapshot = (await request(`/api/v1/trips/${tripId}/workspace`)).value.data;
  const leg = {
    dayId: snapshot.days[0].id,
    fromScheduleId: snapshot.itinerary[0].id,
    toScheduleId: snapshot.itinerary[1].id,
    mode: 'WALK',
  };
  await command('schedule.route', leg);
  const route = (
    await request(`/api/v1/trips/${tripId}/routes`, {
      method: 'POST',
      body: leg,
    })
  ).value.data;
  assert.ok(
    Number.isFinite(route.durationSeconds) && route.distanceMeters >= 0,
  );
  evidence.checks.push({
    name: 'Google Routes',
    finiteDuration: Number.isFinite(route.durationSeconds),
    finiteDistance: Number.isFinite(route.distanceMeters),
  });
  const signedAgain = await request('/api/auth/sign-in/email', {
    method: 'POST',
    body: { email, password },
  });
  token = signedAgain.response.headers.get('set-auth-token');
  assert.ok(token);
  snapshot = (await request(`/api/v1/trips/${tripId}/workspace`)).value.data;
  assert.equal(snapshot.trip.destinations.length, 2);
  assert.equal(snapshot.days[1].destinationId, destinations[1].id);
  assert.deepEqual(snapshot.travelLegs, [leg]);
  assert.equal(JSON.stringify(snapshot).includes('durationSeconds'), false);
  evidence.providerDataPersisted = false;
  evidence.checks.push({
    name: '새 회원 세션 저장·재조회',
    tripId,
    tripVersion: snapshot.trip.version,
  });
  const published = await command('community.publish', {
    kind: 'plan',
    title: snapshot.trip.title,
    body: '',
    scheduleIds: snapshot.itinerary.map((item) => item.id),
    photoIds: [],
    includeCosts: false,
  });
  postId =
    published.postId ||
    (await request(`/api/v1/trips/${tripId}/workspace`)).value.data.postId;
  assert.ok(postId);
  const publicPost = (await request(`/public/community/${postId}`)).value.data;
  assert.equal(publicPost.snapshot.travelLegs[0].mode, 'WALK');
  const { dayId: _dayId, ...publicLeg } = leg;
  const publicRoute = (
    await request(`/public/community/${postId}/routes`, {
      method: 'POST',
      body: publicLeg,
    })
  ).value.data;
  assert.ok(Number.isFinite(publicRoute.durationSeconds));
  evidence.checks.push({ name: '공개 사본·실시간 이동시간', postId });
  await command('community.withdraw', {});
  evidence.withdrawn = true;
  postId = null;
  evidence.passed = true;
} catch (error) {
  evidence.passed = false;
  evidence.failure = error.message;
  process.exitCode = 1;
} finally {
  // 검증 중 공개한 글은 실패하더라도 철회하고 비밀은 파일에 남기지 않는다.
  if (tripId && token && !postId) {
    // 저장 응답의 공개 ID 생략 시에도 원본 재조회로 정리 대상을 찾는다.
    try {
      postId = (await request(`/api/v1/trips/${tripId}/workspace`)).value.data
        .postId;
    } catch {
      evidence.cleanupReadFailed = true;
    }
  }
  if (postId) {
    try {
      await command('community.withdraw', {});
      evidence.withdrawn = true;
    } catch {
      evidence.withdrawn = false;
    }
  }
  mkdirSync('outputs/multicity-planning', { recursive: true });
  writeFileSync(
    'outputs/multicity-planning/live-provider-evidence.json',
    `${JSON.stringify(evidence, null, 2)}\n`,
  );
  console.log(JSON.stringify(evidence, null, 2));
}
