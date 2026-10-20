import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { newTrip, persistedTripCreateSchema } from '@wherego/validation';
import {
  completedArchive,
  archiveSummary,
  archiveDetails,
} from '../../apps/mobile/src/features/workspace/archiveModel';

// 예시 화면 자료가 아닌 격리된 실제 도메인 객체로 경계를 검증한다.
function workspace() {
  // 테스트 시점과 무관하게 이미 종료된 여행을 만든다.
  return newTrip(
    persistedTripCreateSchema.parse({
      country: '일본',
      city: '오사카',
      startDate: '2020-10-01',
      endDate: '2020-10-04',
      timezone: 'Asia/Tokyo',
    }),
    randomUUID(),
    '검증',
    randomUUID(),
    randomUUID,
  );
}

test('보관함은 지난 여행만 선택하고 미래·보관 여행과 원본 배열을 보존한다', () => {
  // 저장 상태 PLANNED여도 날짜가 지났으면 기록에서 열려야 한다.
  const trip = workspace().trip;
  const future = {
    ...trip,
    id: randomUUID(),
    startDate: '2099-10-01',
    endDate: '2099-10-04',
  };
  const archived = { ...trip, id: randomUUID(), status: 'ARCHIVED' as const };
  const input = [future, trip, archived];
  const before = JSON.stringify(input);
  assert.deepEqual(completedArchive(input), [trip]);
  assert.equal(JSON.stringify(input), before);
});

test('도시·국가는 실제 저장 목록으로 중복을 제거하고 미정 값을 세지 않는다', () => {
  // 국가가 다른 동명 도시는 구분하고 재방문은 중복 집계하지 않는다.
  const trip = workspace().trip;
  assert.deepEqual(
    archiveSummary([
      trip,
      { ...trip, id: randomUUID() },
      { ...trip, country: '다른 나라' },
      { ...trip, country: '', city: '' },
    ]),
    { trips: 4, countries: 2, cities: 2 },
  );
});

test('일반 여행 사진과 영수증 원본은 같은 사진 통계에 섞이지 않는다', () => {
  // 실제 모델의 미디어 목적을 기준으로 표지와 건수를 고른다.
  const snapshot = workspace();
  const photo = {
    id: randomUUID(),
    tripId: snapshot.trip.id,
    purpose: 'photo' as const,
    path: 'private/photo.jpg',
    mimeType: 'image/jpeg',
    byteSize: 20,
    scheduleId: null,
  };
  snapshot.media.push(photo, {
    ...photo,
    id: randomUUID(),
    purpose: 'receipt',
  });
  const detail = archiveDetails(snapshot);
  assert.deepEqual(detail.photos, [photo]);
  assert.equal(detail.receipts, 0);
  assert.equal(detail.places, 0);
});
