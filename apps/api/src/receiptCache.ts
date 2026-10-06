import type { ReceiptDraft } from '@wherego/domain';
import { receiptDraftSchema } from '@wherego/validation';
import { database } from './cloudStore';
import { rejectRequest } from './errors';
import type { VerifiedSession } from './types';

// 권한 검사 이후에만 이미 인식한 비공개 초안을 읽는다.
export function cachedReceipt(
  env: Env,
  trip: string,
  media: string,
): Promise<ReceiptDraft | null> {
  // 캐시는 공개 URL을 만들지 않고 여행 내부 키로만 조회한다.
  return database(env)
    .prepare('SELECT draft FROM receipt_scans WHERE trip_id=? AND media_id=?')
    .bind(trip, media)
    .first<string>('draft')
    .then((draft) => {
      // 캐시에도 최신 인식 계약을 적용한다.
      return draft ? receiptDraftSchema.parse(JSON.parse(draft)) : null;
    });
}

// 인식 성공 결과 하나를 원본 미디어에 연결해 저장한다.
export function cacheReceipt(
  env: Env,
  trip: string,
  media: string,
  draft: ReceiptDraft,
): Promise<ReceiptDraft> {
  // 재시도는 같은 원본으로 일정·지출을 만들지 않고 인식 결과만 재사용한다.
  return database(env)
    .prepare(
      'INSERT INTO receipt_scans(trip_id,media_id,draft,created_at) VALUES(?,?,?,?) ON CONFLICT(trip_id,media_id) DO NOTHING',
    )
    .bind(trip, media, JSON.stringify(draft), Date.now())
    .run()
    .then(() => {
      // 확인하지 않은 초안은 여행 기록으로 확정하지 않는다.
      return draft;
    });
}

// 분당 5회·하루 40회로 실제 공급자 호출을 제한한다.
export function reserveReceiptScan(
  env: Env,
  session: VerifiedSession,
  now = Date.now(),
): Promise<void> {
  // 캐시 조회는 카운터를 소모하지 않으며 동시 요청도 DB에서 증가시킨다.
  return database(env)
    .batch([
      scanCounter(env, session.userId, Math.floor(now / 60000) * 60000, 5),
      scanCounter(
        env,
        session.userId,
        Math.floor(now / 86400000) * 86400000 + 1,
        40,
      ),
      database(env)
        .prepare('DELETE FROM receipt_scan_limits WHERE window_start < ?')
        .bind(now - 172800000),
    ])
    .then((results) => {
      // 허용량을 넘으면 공급자를 호출하지 않는다.
      return results[0]?.meta.changes && results[1]?.meta.changes
        ? undefined
        : rejectRequest('OCR_RATE_LIMITED');
    });
}

// 제한 창 하나의 조회 횟수를 원자적으로 증가시킨다.
function scanCounter(
  env: Env,
  actor: string,
  window: number,
  limit: number,
): D1PreparedStatement {
  // 조건부 UPSERT로 한도를 넘긴 횟수를 성공 처리하지 않는다.
  return database(env)
    .prepare(
      'INSERT INTO receipt_scan_limits(actor_id,window_start,hits) VALUES(?,?,1) ON CONFLICT(actor_id,window_start) DO UPDATE SET hits=hits+1 WHERE hits < ?',
    )
    .bind(actor, window, limit);
}
