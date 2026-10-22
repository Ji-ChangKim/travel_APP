import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import {
  FoundationClientError,
  foundationErrorCode,
  requestFoundation,
  requestPolicy,
} from '@wherego/api-client';
import { newTrip, persistedTripCreateSchema } from '@wherego/validation';
import { scanServerReceipt } from '../../apps/mobile/src/features/workspace/workspaceReceipts';
import { workspaceError } from '../../apps/mobile/src/features/workspace/workspaceFailure';
import {
  UserFacingError,
  userFacingMessage,
} from '../../apps/mobile/src/services/userFacingError';
import {
  canDiscardRecordAttempt,
  recordFailureMessage,
} from '../../apps/mobile/src/features/workspace/recordFailure';
import { workspaceDraft } from '../../apps/mobile/src/features/workspace/workspaceDrafts';
import {
  ledgerActionContainer,
  ledgerActionForeground,
} from '../../apps/mobile/src/features/workspace/ledgerActionAppearance';
import ledgerTokens from '../../docs/02. 디자인/00. 공통규격/ledger-tokens.json';

test('로그인·프로필·기기 기록의 공통 안내도 미확인 예외 원문을 숨긴다', () => {
  // 같은 정책을 쓰는 다른 화면에서 원문 노출이 다시 생기지 않게 한다.
  assert.equal(
    userFacingMessage(
      new Error('한국어 SQL token=private'),
      '다시 시도해 주세요.',
    ),
    '다시 시도해 주세요.',
  );
  assert.equal(
    userFacingMessage({ message: '서버 원문' }, '복구 안내'),
    '복구 안내',
  );
  assert.equal(
    userFacingMessage(
      new UserFacingError('다른 닉네임을 입력해 주세요.'),
      '복구 안내',
    ),
    '다른 닉네임을 입력해 주세요.',
  );
});

test('실제 OCR 클라이언트는 기본15초 대신 명시된75초 정책과 초안 계약을 유지한다', async (context) => {
  // 실제 시간을 기다리지 않고 전송 계층에 지정되는 제한 시간을 검사한다.
  const timeouts: number[] = [];
  context.mock.method(AbortSignal, 'timeout', (milliseconds: number) => {
    // 15초 신호가 추가되면 75초 계약이 조용히 줄어드는 회귀다.
    timeouts.push(milliseconds);
    return new AbortController().signal;
  });
  const draft = await scanServerReceipt(
    {
      baseUrl: 'https://receipt.example.test',
      accessToken: 'test-only',
      fetcher: async (input, init) => {
        // 정책용 옵션을 HTTP 요청에 섞지 않고 인식만 요청한다.
        assert.ok(String(input).endsWith('/trips/trip/receipts/ocr'));
        assert.equal(init?.method, 'POST');
        assert.equal('timeoutMs' in (init || {}), false);
        return Response.json({
          data: {
            rawText: '',
            merchant: '',
            transactionDate: '',
            amount: '',
            currency: '',
            needsConfirmation: true,
          },
        });
      },
    },
    'trip',
    'media',
  );
  assert.deepEqual(timeouts, [75000]);
  assert.equal(draft.needsConfirmation, true);
  assert.equal(draft.amount, '');
});

test('75초 작업도 화면의 명시적 취소를 전송 계층에 전달한다', async () => {
  // 긴 제한 시간을 지정해도 화면 취소가 무시되지 않게 한다.
  const screen = new AbortController();
  const pending = requestFoundation(
    {
      baseUrl: 'https://receipt.example.test',
      accessToken: 'test-only',
      fetcher: (_url, init) => {
        // 취소되기 전까지 전송 중인 연결을 유지한다.
        return new Promise<Response>((_resolve, reject) => {
          // 화면 취소로 원래 Promise도 정리한다.
          init!.signal!.addEventListener(
            'abort',
            () => {
              // 취소된 요청을 빈 성공으로 처리하지 않는다.
              return reject(init!.signal!.reason);
            },
            { once: true },
          );
        });
      },
    },
    '/receipts/ocr',
    { timeoutMs: requestPolicy.receiptScanTimeoutMs, signal: screen.signal },
  );
  screen.abort();
  await assert.rejects(pending, { name: 'AbortError' });
});

test('한국어가 섞인 내부 오류와 HTTP 원문은 고객 안내에 노출하지 않는다', () => {
  // 언어만으로 안전한 안내라고 판단하던 분기를 검출한다.
  const secret = '한글 SQL token=private-key file=C:/private';
  for (const failure of [
    new Error(secret),
    new FoundationClientError(500, { error: { message: secret } }),
  ]) {
    assert.equal(workspaceError(failure).includes('private-key'), false);
    assert.equal(workspaceError(failure).includes('C:/private'), false);
  }
  assert.equal(
    workspaceError(new UserFacingError('사진을 다시 선택해 주세요.')),
    '사진을 다시 선택해 주세요.',
  );
  assert.match(workspaceError(new TypeError('offline'), 'read'), /다시 불러와/);
});

test('공개 코드의 부분 문자열이나 설명은 회원 전환·버전 충돌로 오인하지 않는다', () => {
  // 잘못된 응답이나 임의 문구를 업무 상태로 해석하지 않는다.
  const hinted = new FoundationClientError(403, {
    error: { message: 'MEMBERSHIP_REQUIRED' },
  });
  assert.equal(foundationErrorCode(hinted), undefined);
  assert.doesNotMatch(workspaceError(hinted), /회원가입/);
  const required = new FoundationClientError(403, {
    error: { code: 'MEMBERSHIP_REQUIRED' },
  });
  assert.match(workspaceError(required), /회원가입/);
  const circular: Record<string, unknown> = {};
  circular.error = circular;
  assert.equal(
    foundationErrorCode(new FoundationClientError(403, circular)),
    undefined,
  );
});

test('기록 편집의408·요청 키 충돌·응답 유실은 같은 요청을 유지한다', () => {
  // 새 키로 중복 저장할 수 있는 예외 경계를 검사한다.
  for (const failure of [
    new FoundationClientError(408, null),
    new FoundationClientError(409, { error: { code: 'REQUEST_KEY_REUSED' } }),
    new FoundationClientError(503, null),
    new SyntaxError('broken success'),
    new DOMException('timeout', 'TimeoutError'),
  ]) {
    assert.equal(canDiscardRecordAttempt(failure), false);
    assert.doesNotMatch(recordFailureMessage(failure, false, true), /동행/);
  }
  assert.equal(
    canDiscardRecordAttempt(new FoundationClientError(422, null)),
    true,
  );
  assert.equal(
    canDiscardRecordAttempt(
      new FoundationClientError(409, { error: { code: 'VERSION_CONFLICT' } }),
    ),
    true,
  );
});

test('화면에서 분리한 초안은 실제 여행 값과 선택 공개 초기화를 보존한다', () => {
  // 화면 배치 변경이 저장 데이터나 개인정보 기본값을 바꾸지 않게 한다.
  const snapshot = newTrip(
    persistedTripCreateSchema.parse({
      country: '일본',
      city: '오사카',
      startDate: '2026-10-01',
      endDate: '2026-10-04',
      timezone: 'Asia/Tokyo',
    }),
    randomUUID(),
    '검사',
    randomUUID(),
    randomUUID,
  );
  for (const kind of ['plan-share', 'record-share'] as const) {
    const form = workspaceDraft(snapshot, kind, 'draft-id');
    assert.equal(form.id, 'draft-id');
    assert.equal(form.kind, 'publish');
    assert.equal(form.values.title, snapshot.trip.title);
    assert.equal(form.values.scheduleIds, '');
    assert.equal(form.values.photoIds, '');
    assert.equal(form.values.includeCosts, 'false');
    assert.equal(form.values.kind, kind === 'plan-share' ? 'plan' : undefined);
  }
  assert.deepEqual(workspaceDraft(snapshot, 'period', 'period').values, {
    startDate: '2026-10-01',
    endDate: '2026-10-04',
  });
  assert.equal(
    workspaceDraft(snapshot, 'expense', 'expense').values.currency,
    snapshot.trip.defaultCurrency,
  );
  assert.equal(
    workspaceDraft(snapshot, 'metadata', 'metadata').values.status,
    snapshot.trip.status,
  );
});

test('Ledger 버튼은 기본·선택·비활성·초점 상태에서 현행 치수와 대비 색을 보존한다', () => {
  // 표현 함수 분리가 선택 시 크기 변화나 읽기 어려운 전경색을 만들지 않게 한다.
  const base = {
    emphasized: false,
    blocked: false,
    filled: false,
    quiet: false,
    focused: false,
    pressed: false,
  };
  assert.equal(ledgerActionContainer(base).minHeight, 48);
  assert.equal(ledgerActionContainer({ ...base, filled: true }).minHeight, 48);
  assert.equal(
    ledgerActionContainer({ ...base, emphasized: true }).minHeight,
    52,
  );
  assert.equal(
    ledgerActionContainer({ ...base, blocked: true }).backgroundColor,
    ledgerTokens.color.soft,
  );
  assert.equal(
    ledgerActionContainer({ ...base, focused: true }).borderColor,
    ledgerTokens.color.ink,
  );
  assert.equal(ledgerActionForeground(false, true), ledgerTokens.color.surface);
  assert.equal(ledgerActionForeground(true, true), ledgerTokens.color.muted);
});
