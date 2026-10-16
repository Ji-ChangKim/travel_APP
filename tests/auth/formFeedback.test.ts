import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  scheduleInputSchema,
  expenseInputSchema,
} from '../../packages/validation/src/workspace';
import { flightDetailsSchema } from '../../packages/validation/src/flight';
import {
  formFailureFields,
  formInputFields,
  revisedFormFeedback,
} from '../../apps/mobile/src/features/workspace/formFeedback';
import { countryInputError } from '../../apps/mobile/src/features/workspace/countries';
import { tripCreationInput } from '../../apps/mobile/src/features/workspace/tripCreation';
import { submitOnce } from '../../apps/mobile/src/features/forms/submissionLock';

const id = '00000000-0000-4000-8000-000000000001';
const schedule = {
  id,
  dayId: id,
  title: '장소',
  type: 'PLACE',
  timeSlot: '23:59',
  sortOrder: 1,
  memo: '',
  address: '',
};

test('일정 제목·메모·주소 경계는 저장 스키마와 같고 잘못된 시간은 필드에 연결한다', () => {
  // 허용 경계를 통과시키고 각 초과 입력과 HH:mm 오류를 해당 입력으로 안내한다.
  return assert.deepEqual(
    [
      scheduleInputSchema.safeParse({
        ...schedule,
        title: '가'.repeat(100),
        memo: '가'.repeat(300),
        address: '가'.repeat(200),
      }).success,
      Object.keys(
        parsedFailureFields(
          scheduleInputSchema.safeParse({
            ...schedule,
            title: '가'.repeat(101),
            memo: '가'.repeat(301),
            address: '가'.repeat(201),
            timeSlot: '24:00',
          }),
          'schedule',
        ),
      ),
    ],
    [true, ['제목', '일정 시간 (HH:mm)', '일정 메모', '지역명·주소']],
  );
});

test('통화별 잘못된 금액과 항공 소요시간은 수정 가능한 입력을 가리킨다', () => {
  // 객체 전체 검사 실패도 영문 오류나 숨겨진 필드로만 안내하지 않는다.
  return assert.deepEqual(
    [
      Object.keys(
        parsedFailureFields(
          expenseInputSchema.safeParse({
            id,
            title: '비용',
            amount: '1.5',
            currency: 'JPY',
            category: 'etc',
            isActual: true,
          }),
          'expense',
        ),
      ),
      Object.keys(
        parsedFailureFields(
          flightDetailsSchema.safeParse({
            number: 'KE123',
            departure: 'ICN',
            arrival: 'KIX',
            durationMinutes: 0,
          }),
          'schedule',
        ),
      ),
    ],
    [['금액'], ['소요시간 (분, 선택)']],
  );
});

test('직접 입력한 금지 국가 이름·코드·영문에도 기존 국가 선택 정책을 적용한다', () => {
  // 일부 지역 제한 국가와 새 직접 입력 이름은 기존 허용 범위를 유지한다.
  return assert.deepEqual(
    [
      '아프가니스탄',
      ' i r ',
      'IRAN',
      '우 크 라 이 나',
      'UA',
      '일본',
      '필리핀',
      '새 나라',
    ].map((name) => {
      /* 판정 결과만 확인한다. */ return Boolean(countryInputError(name));
    }),
    [true, true, true, true, true, false, false, false],
  );
});

test('파손된 좌표·범위 초과·한쪽 누락은 통신 전에 차단한다', () => {
  // 경계 좌표는 유지하고 잘못된 JSON도 위치 입력 오류로 처리한다.
  return assert.deepEqual(
    [
      '{"latitude":90,"longitude":-180}',
      '{"latitude":91,"longitude":0}',
      '{"latitude":0}',
      'broken',
    ].map((mapLocation) => {
      /* 실제 폼 문자열을 좌표 검사에 전달한다. */ return Object.keys(
        formInputFields('schedule', { mapLocation }),
      ).length;
    }),
    [0, 1, 1, 1],
  );
});

test('여행 제목을 조용히 자르지 않고 길이 초과를 거부한다', () => {
  // 잘린 제목으로 저장된 것을 사용자가 모르는 상황을 방지한다.
  return assert.throws(() => {
    /* 첫 단계와 최종 저장은 같은 제한을 사용한다. */ return tripCreationInput({
      title: 'a'.repeat(51),
      country: '일본',
      city: '오사카',
      startDate: '2026-11-01',
      endDate: '2026-11-02',
      timezone: 'Asia/Tokyo',
      flightSkipped: 'true',
    });
  });
});

test('입력을 고칠 때 다른 오류와 제출 순번을 보존한다', () => {
  // 타이틀을 고치는 동안 메모로 초점이 강제로 이동하지 않게 한다.
  return assert.deepEqual(
    revisedFormFeedback(
      {
        attempt: 2,
        fields: {
          제목: '제목 오류',
          '나의 여행 주제': '길이 오류',
          '일정 메모': '메모 오류',
        },
      },
      'title',
    ),
    { attempt: 2, fields: { '일정 메모': '메모 오류' } },
  );
});

test('화면 갱신 전 연타도 요청을 한 번만 실행하고 완료 후 다시 제출한다', () => {
  // 네트워크 호출 전의 연속 이벤트부터 같은 잠금으로 제어한다.
  return verifySubmissionLock({ current: false }, { calls: 0 });
});

// 연속 제출의 호출 수와 잠금 해제를 한 흐름으로 확인한다.
function verifySubmissionLock(
  lock: { current: boolean },
  state: { calls: number },
): Promise<void> {
  // 첫 요청이 마이크로태스크에서 시작되기 전 두 번째 요청을 차단한다.
  return Promise.all([
    submitOnce(lock, () => {
      /* 요청 하나의 호출 수만 증가시킨다. */ return Promise.resolve(
        ++state.calls,
      );
    }),
    submitOnce(lock, () => {
      /* 이 중복 요청은 실행되면 안 된다. */ return Promise.resolve(
        ++state.calls,
      );
    }),
  ]).then((results) => {
    // 한 요청만 끝나고 잠금이 풀려야 한다.
    return void (assert.deepEqual(results, [1, undefined]),
    assert.equal(state.calls, 1),
    assert.equal(lock.current, false));
  });
}

test('동기 예외와 비동기 실패 후 잠금을 풀어 재시도를 허용한다', () => {
  // 입력·네트워크 오류 뒤에 제출 버튼이 영구 잠기지 않게 한다.
  return verifyFailedSubmission({ current: false });
});

// 실패한 요청 이후의 새 요청이 실행될 수 있는지 검사한다.
function verifyFailedSubmission(lock: { current: boolean }): Promise<void> {
  // 동기 예외도 Promise 경계에서 처리한다.
  return assert
    .rejects(
      submitOnce(lock, () => {
        /* 즉시 실패하는 입력 처리를 재현한다. */ throw new Error('invalid');
      })!,
    )
    .then(() => {
      /* 동기 실패 이후 잠금이 해제되어야 한다. */ return assert.equal(
        lock.current,
        false,
      );
    })
    .then(() => {
      /* 재시도도 실제 실행돼 비동기 실패를 반환해야 한다. */ return assert.rejects(
        submitOnce(lock, () => {
          /* 통신 실패를 재현한다. */ return Promise.reject(
            new Error('offline'),
          );
        })!,
      );
    })
    .then(() => {
      /* 비동기 실패 후에도 잠금을 해제한다. */ return assert.equal(
        lock.current,
        false,
      );
    });
}

// 실패한 스키마 결과를 실제 필드 오류 변환기에 전달한다.
function parsedFailureFields(
  result: { success: true } | { success: false; error: unknown },
  kind: string,
) {
  // 성공한 입력을 실패한 입력으로 가정하지 않는다.
  return result.success ? {} : formFailureFields(result.error, kind);
}
