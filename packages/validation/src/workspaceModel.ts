import type {
  CommunityPost,
  PersistedTripInput,
  WorkspaceSnapshot,
  WorkspaceSchedule,
} from '@wherego/domain';
import type { WorkspaceCommand } from './workspace';
// 로컬 저장과 서버 저장이 같은 여행 규칙 오류를 공유한다.
export class WorkspaceModelError extends Error {
  // 내부 서버 상태 없이 공개 도메인 오류 코드만 보관한다.
  constructor(
    readonly code: 'ROLE_FORBIDDEN' | 'TRIP_ARCHIVED' | 'VALIDATION_FAILED',
  ) {
    // 플랫폼별 저장 계층이 오류를 사용자 안내로 변환한다.
    super(code);
  }
}

// 유효하지 않은 여행 변경 후보를 중단한다.
function rejectRequest(code: WorkspaceModelError['code']): never {
  // 서버와 로컬에서 동일하게 저장을 거부한다.
  throw new WorkspaceModelError(code);
}

export type Snapshot = WorkspaceSnapshot;
type ScheduleInput = Extract<
  WorkspaceCommand,
  { operation: 'schedule.save' }
>['input'];

// 삽입 위치와 확정 영수증의 날짜 관계를 검사한다.
function validSchedulePlacement(s: Snapshot, input: ScheduleInput): boolean {
  // 다른 날짜의 장소를 기준으로 삼거나 확정 결제일을 옮기지 않는다.
  return (
    validDay(s, input.dayId) &&
    (input.afterScheduleId === undefined ||
      input.afterScheduleId === null ||
      s.itinerary.some((item) => {
        // 자기 자신을 삽입 기준으로 선택할 수 없다.
        return (
          item.id === input.afterScheduleId &&
          item.id !== input.id &&
          item.dayId === input.dayId
        );
      })) &&
    !s.receipts.some((receipt) => {
      // 확정 영수증과 연결된 일정은 결제일이 같은 DAY에만 둔다.
      return (
        receipt.scheduleId === input.id &&
        receipt.date !==
          s.days.find((day) => {
            // 선택 날짜의 현지 달력 날짜를 읽는다.
            return day.id === input.dayId;
          })?.tripDate
      );
    })
  );
}

// 명령 전용 값을 영구 일정 속성에서 제외한다.
function scheduleStoredInput(
  input: ScheduleInput,
): Omit<ScheduleInput, 'afterScheduleId' | 'estimatedCost'> {
  // 삽입 위치와 예상 비용은 각각 순서와 비용 객체로 저장한다.
  return Object.fromEntries(
    Object.entries(input).filter(([key]) => {
      // 명령 보조 속성은 스냅샷 일정에 복사하지 않는다.
      return key !== 'afterScheduleId' && key !== 'estimatedCost';
    }),
  ) as Omit<ScheduleInput, 'afterScheduleId' | 'estimatedCost'>;
}

// 저장 일정의 삽입 위치를 한 번에 반영한다.
function placedSchedule(
  s: Snapshot,
  input: ScheduleInput,
  item: WorkspaceSchedule,
): WorkspaceSchedule[] {
  // 이전 앱이 삽입 위치를 보내지 않으면 기존 정렬 계약을 유지한다.
  return input.afterScheduleId === undefined
    ? saveItem(s.itinerary, item)
    : [
        ...s.itinerary.filter((other) => {
          // 이동 전 일정과 목적 날짜의 일정만 재정렬 대상으로 분리한다.
          return other.id !== item.id && other.dayId !== item.dayId;
        }),
        ...insertedSchedules(s.itinerary, item, input.afterScheduleId).map(
          (other, index) => {
            // 같은 날짜 안에서만 연속된 순서 번호를 부여한다.
            return { ...other, sortOrder: index + 1 };
          },
        ),
      ];
}

// 선택 날짜의 목록에 일정 하나를 끼워 넣는다.
function insertedSchedules(
  items: WorkspaceSchedule[],
  item: WorkspaceSchedule,
  after: string | null,
): WorkspaceSchedule[] {
  // 입력 배열을 수정하지 않고 목적 날짜의 정렬 결과로 삽입한다.
  return insertAt(
    items
      .filter((other) => {
        // 편집 중인 자기 자신은 미리보기 목록에서 제거한다.
        return other.dayId === item.dayId && other.id !== item.id;
      })
      .sort((a, b) => {
        // 저장된 방문 순서를 기준으로 삼는다.
        return a.sortOrder - b.sortOrder;
      }),
    item,
    after,
  );
}

// 앞·뒤 목록을 합쳐 삽입 결과를 만든다.
function insertAt(
  items: WorkspaceSchedule[],
  item: WorkspaceSchedule,
  after: string | null,
): WorkspaceSchedule[] {
  // null은 첫 일정이며 유효한 기준 ID는 앞선 검증에서 확인한다.
  return [
    ...items.slice(
      0,
      after === null
        ? 0
        : items.findIndex((other) => {
            // 선택한 앞 일정의 위치만 찾는다.
            return other.id === after;
          }) + 1,
    ),
    item,
    ...items.slice(
      after === null
        ? 0
        : items.findIndex((other) => {
            // 나머지 일정의 상대 순서를 유지한다.
            return other.id === after;
          }) + 1,
    ),
  ];
}

// 일정과 예상 비용을 같은 변경 결과로 저장한다.
function scheduleEstimates(
  s: Snapshot,
  input: ScheduleInput,
  identify: WorkspaceId,
): Snapshot['expenses'] {
  // 실제 지출과 영수증 비용은 수정하거나 삭제하지 않는다.
  return input.estimatedCost === undefined
    ? s.expenses
    : input.estimatedCost === null
      ? s.expenses.filter((expense) => {
          // 이 입력 화면에서 만든 예상 비용만 해제한다.
          return (
            expense.scheduleId !== input.id ||
            expense.source !== 'schedule-plan'
          );
        })
      : saveItem(s.expenses, {
          id:
            s.expenses.find((expense) => {
              // 다시 저장할 때 같은 예상 비용 ID를 재사용한다.
              return (
                expense.scheduleId === input.id &&
                expense.source === 'schedule-plan'
              );
            })?.id || identify(),
          dayId: input.dayId,
          scheduleId: input.id,
          title: `${input.title} 예상 비용`,
          ...input.estimatedCost,
          isActual: false,
          category:
            input.type === 'STAY'
              ? 'stay'
              : input.type === 'TRANSPORT'
                ? 'transport'
                : 'activity',
          source: 'schedule-plan',
        });
}
// 플랫폼이 제공하는 보안 UUID 생성기를 요청마다 전달한다.
export type WorkspaceId = () => string;

// 서버의 Web Crypto UUID 생성기를 기본값으로 사용한다.
function randomId(): string {
  // 네이티브 앱은 Expo UUID 함수를 별도로 주입한다.
  return crypto.randomUUID();
}
export type Change = {
  snapshot: Snapshot;
  result: Record<string, unknown>;
  post?: CommunityPost | null;
  invite?: {
    id: string;
    token: string;
    role: 'editor' | 'viewer';
    expires: number;
  };
};

// 달력 날짜를 UTC 기준으로 이동한다.
function dateAt(start: string, offset: number): string {
  // 지역 시간과 일광 절약 시간에 영향을 받지 않는다.
  return new Date(Date.parse(`${start}T00:00:00Z`) + offset * 86400000)
    .toISOString()
    .slice(0, 10);
}

// 날짜를 유지하는 DAY 목록을 생성한다.
export function tripDays(
  start: string,
  end: string,
  previous: Snapshot['days'] = [],
  identify: WorkspaceId = randomId,
): Snapshot['days'] {
  // 같은 날짜의 ID를 유지해 기존 일정 참조를 보존한다.
  return Array.from(
    {
      length: Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1,
    },
    (_, index) => {
      // 생성한 날짜에 대응하는 기존 ID만 재사용한다.
      return {
        id:
          previous.find((day) => {
            // 날짜가 동일한 DAY를 찾는다.
            return day.tripDate === dateAt(start, index);
          })?.id || identify(),
        dayNumber: index + 1,
        tripDate: dateAt(start, index),
      };
    },
  );
}

// 실제 계정과 입력으로 새로운 여행 스냅샷을 만든다.
export function newTrip(
  input: PersistedTripInput,
  actor: string,
  name: string,
  id: string = crypto.randomUUID(),
  identify: WorkspaceId = randomId,
): Snapshot {
  // 항공 입력도 첫 DAY의 사용자 등록 일정으로 저장한다.
  return attachInitialFlight(
    {
      trip: {
        ...tripMetadata(input),
        id,
        ownerId: actor,
        title: input.title || `${name}의 ${input.country} 여행`,
        status: 'PLANNED',
        version: 1,
        defaultCurrency: input.defaultCurrency || 'KRW',
        coverColor: input.coverColor || '#E84025',
      },
      myRole: 'owner',
      days: tripDays(input.startDate, input.endDate, [], identify),
      itinerary: [],
      expenses: [],
      checklists: [],
      members: [
        {
          memberId: identify(),
          userId: actor,
          nickname: name,
          role: 'owner',
          isMe: true,
        },
      ],
      media: [],
      receipts: [],
      invites: [],
      postId: null,
    },
    input,
    identify,
  );
}

// 입력한 항공편을 첫 날짜에 연결한다.
function attachInitialFlight(
  snapshot: Snapshot,
  input: PersistedTripInput,
  identify: WorkspaceId,
): Snapshot {
  // 운항 확인 정보로 오인하지 않도록 사용자 입력만 표시한다.
  return input.flights
    ? {
        ...snapshot,
        itinerary: input.flights.map((flight, index) => {
          // 각 항공편은 사용자가 선택한 출발일의 DAY에 한 번만 연결한다.
          return {
            id: identify(),
            dayId: snapshot.days.find((day) => day.tripDate === flight.date)!
              .id,
            title: `${flight.number} ${flight.departure} → ${flight.arrival}`,
            type: 'TRANSPORT' as const,
            timeSlot: flight.time,
            sortOrder: index + 1,
            memo: '',
            address: '',
            flight: initialFlightDetails(flight),
          };
        }),
      }
    : input.flight
      ? {
          ...snapshot,
          itinerary: [
            {
              id: identify(),
              dayId: snapshot.days[0]!.id,
              title: `${input.flight.number} ${input.flight.departure} → ${input.flight.arrival}`,
              type: 'TRANSPORT',
              timeSlot: input.flight.time || null,
              sortOrder: 1,
              memo: '사용자 등록 항공편',
              address: '',
              flight: initialFlightDetails(input.flight),
            },
          ],
        }
      : snapshot;
}

// 여행 생성 전용 출발 시각은 일정의 timeSlot에만 보관한다.
function initialFlightDetails(
  flight: NonNullable<PersistedTripInput['flight']>,
) {
  // 카드 상세 객체에는 구간 정보만 남겨 시각이 서로 달라지는 것을 방지한다.
  return Object.fromEntries(
    Object.entries(flight).filter(([key]) => {
      // 출발 시각의 단일 저장 위치를 유지한다.
      return !['time', 'date', 'role'].includes(key);
    }),
  ) as Omit<NonNullable<PersistedTripInput['flight']>, 'time'>;
}

// 생성용 항공편 목록을 일정과 중복 저장하지 않고 여행 속성만 남긴다.
function tripMetadata(input: PersistedTripInput) {
  // 항공편의 단일 저장 위치는 itinerary의 해당 DAY다.
  return Object.fromEntries(
    Object.entries(input).filter(
      ([key]) => !['flight', 'flights'].includes(key),
    ),
  ) as Omit<PersistedTripInput, 'flight' | 'flights'>;
}

// 기존 ID를 교체하거나 새 항목을 추가한다.
function saveItem<T extends { id: string }>(items: T[], item: T): T[] {
  // ID 중복을 생성하지 않는다.
  return [
    ...items.filter((previous) => {
      // 수정 대상 ID만 제외한다.
      return previous.id !== item.id;
    }),
    item,
  ];
}

// 지정 ID 한 개를 제거한다.
function without<T extends { id: string }>(items: T[], id: string): T[] {
  // 다른 항목은 유지한다.
  return items.filter((item) => {
    // 삭제 대상만 걸러낸다.
    return item.id !== id;
  });
}

// 일정 부모가 현재 여행에 속하는지 검사한다.
function validDay(snapshot: Snapshot, id?: string): boolean {
  // 다른 여행 DAY ID의 주입을 거부한다.
  return (
    !id ||
    snapshot.days.some((day) => {
      // 동일 여행의 DAY 목록에서만 찾는다.
      return day.id === id;
    })
  );
}

// 선택한 일정과 DAY의 관계를 검사한다.
function validSchedule(snapshot: Snapshot, id?: string, day?: string): boolean {
  // 부모 일정이 다른 날짜에 속하면 저장하지 않는다.
  return (
    !id ||
    snapshot.itinerary.some((item) => {
      // 일정 ID와 선택 날짜를 동시에 대조한다.
      return item.id === id && (!day || item.dayId === day);
    })
  );
}

// 완료 여행에서 사용자가 선택한 정보만 공개 스냅샷으로 만든다.
function publicPost(
  snapshot: Snapshot,
  input: Extract<WorkspaceCommand, { operation: 'community.publish' }>['input'],
): CommunityPost {
  // 영수증 원본과 메모는 공개 객체에 포함하지 않는다.
  return {
    id: snapshot.postId || crypto.randomUUID(),
    authorId: snapshot.trip.ownerId,
    author:
      snapshot.members.find((member) => {
        // 여행 소유자의 공개 닉네임만 사용한다.
        return member.userId === snapshot.trip.ownerId;
      })?.nickname || '여행자',
    title: input.title,
    body: input.body,
    publishedAt: new Date().toISOString(),
    ...publicSelection(snapshot, input),
  };
}

// 공개 미리보기와 게시 저장에 동일한 선택 결과를 사용한다.
export function publicSelection(
  snapshot: Snapshot,
  input: Pick<
    Extract<WorkspaceCommand, { operation: 'community.publish' }>['input'],
    'scheduleIds' | 'photoIds' | 'includeCosts'
  >,
): Pick<CommunityPost, 'photoPaths' | 'snapshot'> {
  // 공개 필드만 반환하며 비공개 원본을 화면 미리보기에도 섞지 않는다.
  return {
    photoPaths: input.photoIds.map((id) => {
      // 공개 선택된 일반 사진만 허용한다.
      return (
        snapshot.media.find((media) => {
          // 영수증이나 삭제한 사진은 공개하지 않는다.
          return media.id === id && media.purpose === 'photo';
        })?.path || rejectRequest('VALIDATION_FAILED')
      );
    }),
    snapshot: {
      country: snapshot.trip.country,
      city: snapshot.trip.city,
      startDate: snapshot.trip.startDate,
      endDate: snapshot.trip.endDate,
      itinerary: input.scheduleIds.map((id) => {
        // 선택한 일정의 공개 필드만 변환한다.
        return publicSchedule(snapshot, id);
      }),
      costs: input.includeCosts ? costTotals(snapshot) : {},
    },
  };
}

// 공개 일정 한 개에서 비공개 내용을 제거한다.
function publicSchedule(
  snapshot: Snapshot,
  id: string,
): CommunityPost['snapshot']['itinerary'][number] {
  // 존재하지 않는 ID를 빈 공개 일정으로 만들지 않는다.
  return selectedSchedule(
    snapshot,
    snapshot.itinerary.find((item) => {
      // 같은 여행 내에서 공개 선택을 찾는다.
      return item.id === id;
    }) || rejectRequest('VALIDATION_FAILED'),
  );
}

// 일정의 위치·시각·제목만 공개한다.
function selectedSchedule(
  snapshot: Snapshot,
  item: Snapshot['itinerary'][number],
): CommunityPost['snapshot']['itinerary'][number] {
  // 메모와 Google 원본 링크는 제외한다.
  return {
    title: item.title,
    address: item.address,
    timeSlot: item.timeSlot,
    date:
      snapshot.days.find((day) => {
        // 저장된 부모 날짜를 찾는다.
        return day.id === item.dayId;
      })?.tripDate || rejectRequest('VALIDATION_FAILED'),
  };
}

// 통화별 실제 비용을 정밀하게 집계한다.
function costTotals(snapshot: Snapshot): CommunityPost['snapshot']['costs'] {
  // 원화·엔·달러를 환율 없이 서로 합산하지 않는다.
  return Object.fromEntries(
    (['KRW', 'JPY', 'USD'] as const).map((currency) => {
      // 달러도 정수 센트 단위로 합산한다.
      return [currency, totalCurrency(snapshot, currency)];
    }),
  );
}

// 특정 통화의 금액을 문자열로 계산한다.
function totalCurrency(
  snapshot: Snapshot,
  currency: 'KRW' | 'JPY' | 'USD',
): string {
  // 십진 부동 소수 오차를 피한다.
  return formatTotal(
    snapshot.expenses
      .filter((expense) => {
        // 실제 지출과 해당 통화만 선택한다.
        return expense.isActual && expense.currency === currency;
      })
      .reduce((sum, expense) => {
        // 모든 통화를 임시 100분의 1 단위로 계산한다.
        return (
          sum +
          BigInt(expense.amount.split('.')[0]!) * 100n +
          BigInt((expense.amount.split('.')[1] || '').padEnd(2, '0'))
        );
      }, 0n),
    currency,
  );
}

// 정수 합계를 통화별 표시 규칙으로 변환한다.
function formatTotal(amount: bigint, currency: string): string {
  // 달러만 소수 두 자리를 표시한다.
  return currency === 'USD'
    ? `${amount / 100n}.${String(amount % 100n).padStart(2, '0')}`
    : String(amount / 100n);
}

// 역할·상태를 검사한 명령 한 개를 스냅샷 변화로 계산한다.
export function transform(
  snapshot: Snapshot,
  command: WorkspaceCommand,
  identify: WorkspaceId = randomId,
): Change {
  // 조회자, 보관 여행과 소유자 전용 명령을 보호한다.
  return snapshot.myRole === 'viewer'
    ? rejectRequest('ROLE_FORBIDDEN')
    : snapshot.trip.status === 'ARCHIVED'
      ? rejectRequest('TRIP_ARCHIVED')
      : /^(invite\.|member\.|community\.|trip\.)/.test(command.operation) &&
          snapshot.myRole !== 'owner'
        ? rejectRequest('ROLE_FORBIDDEN')
        : applyCommand(snapshot, command, identify);
}

// 검증된 입력의 도메인 변화 하나를 선택한다.
function applyCommand(
  s: Snapshot,
  command: WorkspaceCommand,
  identify: WorkspaceId,
): Change {
  // 각 분기는 한 종류의 명령 결과만 반환한다.
  switch (command.operation) {
    case 'schedule.save':
      return validSchedulePlacement(s, command.input)
        ? changed(
            s,
            {
              itinerary: placedSchedule(s, command.input, {
                ...scheduleStoredInput(command.input),
                durationMinutes:
                  command.input.durationMinutes === undefined
                    ? s.itinerary.find((item) => {
                        // 이전 앱의 수정에서도 기존 체류시간을 보존한다.
                        return item.id === command.input.id;
                      })?.durationMinutes
                    : command.input.durationMinutes,
                // 이전 앱의 수정에서는 상세를 보존하고 유형 변경 또는 null에서만 해제한다.
                flight:
                  command.input.type !== 'TRANSPORT'
                    ? null
                    : command.input.flight === undefined
                      ? s.itinerary.find((item) => {
                          // 같은 일정의 기존 항공편만 보존한다.
                          return item.id === command.input.id;
                        })?.flight
                      : command.input.flight,
                // 이전 앱이 위치 필드를 보내지 않아도 새 앱에서 선택한 위치를 보존한다.
                location:
                  command.input.location === undefined
                    ? s.itinerary.find((item) => {
                        // 같은 일정의 기존 위치만 재사용하며 null은 명시적 삭제로 처리한다.
                        return item.id === command.input.id;
                      })?.location
                    : command.input.location,
                timeSlot: command.input.timeSlot || null,
                memo: command.input.memo || null,
                ...(command.input.googlePlaceId
                  ? { googlePlaceId: command.input.googlePlaceId }
                  : { googlePlaceId: undefined }),
              }),
              expenses: scheduleEstimates(s, command.input, identify).map(
                (expense) => {
                  // 일정에 연결된 수동 비용도 방문 날짜와 함께 이동한다.
                  return expense.scheduleId === command.input.id
                    ? { ...expense, dayId: command.input.dayId }
                    : expense;
                },
              ),
            },
            { id: command.input.id },
          )
        : rejectRequest('VALIDATION_FAILED');
    case 'schedule.reorder':
      return validDay(s, command.input.dayId) &&
        command.input.ids.length ===
          s.itinerary.filter((item) => {
            // 선택 날짜의 모든 일정이 요청에 포함되어야 한다.
            return item.dayId === command.input.dayId;
          }).length &&
        command.input.ids.every((id) => {
          // 다른 날짜나 존재하지 않는 일정은 정렬하지 않는다.
          return s.itinerary.some((item) => {
            // 요청한 날짜의 일정만 변경 대상으로 허용한다.
            return item.id === id && item.dayId === command.input.dayId;
          });
        })
        ? changed(s, {
            itinerary: s.itinerary.map((item) => {
              // 다른 날짜와 사진·비용 연결은 그대로 유지한다.
              return item.dayId === command.input.dayId
                ? { ...item, sortOrder: command.input.ids.indexOf(item.id) + 1 }
                : item;
            }),
          })
        : rejectRequest('VALIDATION_FAILED');
    case 'schedule.delete':
      return s.receipts.some((item) => {
        /* 영수증 부모 삭제를 막는다. */ return (
          item.scheduleId === command.input.id
        );
      })
        ? rejectRequest('VALIDATION_FAILED')
        : changed(s, {
            itinerary: without(s.itinerary, command.input.id),
            media: s.media.map((item) => {
              /* 사진은 삭제하지 않고 일정 연결만 해제한다. */ return item.scheduleId ===
                command.input.id
                ? { ...item, scheduleId: null }
                : item;
            }),
            expenses: s.expenses
              .filter((item) => {
                // 삭제한 방문에서 자동으로 만든 예상 비용만 함께 제거한다.
                return (
                  item.scheduleId !== command.input.id ||
                  item.source !== 'schedule-plan'
                );
              })
              .map((item) => {
                /* 독립 비용으로 연결을 해제한다. */ return item.scheduleId ===
                  command.input.id
                  ? { ...item, scheduleId: null }
                  : item;
              }),
          });
    case 'expense.save':
      return validDay(s, command.input.dayId) &&
        validSchedule(s, command.input.scheduleId, command.input.dayId) &&
        !s.expenses.some((item) => {
          /* 영수증 자동 비용을 수동 덮어쓰지 못하게 한다. */ return (
            item.id === command.input.id && item.source === 'receipt'
          );
        })
        ? changed(s, {
            expenses: saveItem(s.expenses, {
              ...command.input,
              dayId: command.input.dayId || null,
              scheduleId: command.input.scheduleId || null,
              source: 'manual',
            }),
          })
        : rejectRequest('VALIDATION_FAILED');
    case 'expense.delete':
      return s.expenses.some((item) => {
        /* 영수증 비용은 영수증 명령에서만 지운다. */ return (
          item.id === command.input.id && item.source === 'receipt'
        );
      })
        ? rejectRequest('VALIDATION_FAILED')
        : changed(s, { expenses: without(s.expenses, command.input.id) });
    case 'trip.update':
      return changed(s, { trip: { ...s.trip, ...command.input } });
    case 'trip.period':
      return changePeriod(
        s,
        command.input.startDate,
        command.input.endDate,
        identify,
      );
    case 'media.register':
      return validSchedule(s, command.input.scheduleId) &&
        command.input.path ===
          `${s.trip.id}/${command.input.id}.${command.input.mimeType === 'image/png' ? 'png' : 'jpg'}` &&
        !s.media.some((item) => {
          /* 이미 등록한 사진의 목적 변경을 금지한다. */ return (
            item.id === command.input.id
          );
        })
        ? changed(s, {
            media: [
              ...s.media,
              {
                id: command.input.id,
                path: command.input.path,
                purpose: command.input.purpose,
                scheduleId: command.input.scheduleId || null,
              },
            ],
          })
        : rejectRequest('VALIDATION_FAILED');
    case 'media.delete':
      return s.receipts.some((item) => {
        /* 확정 영수증이 참조하는 파일은 보존한다. */ return (
          item.mediaId === command.input.id
        );
      })
        ? rejectRequest('VALIDATION_FAILED')
        : changed(
            s,
            { media: without(s.media, command.input.id), postId: null },
            {},
            { post: null },
          );
    case 'receipt.confirm':
      return confirmReceipt(s, command.input, identify);
    case 'receipt.delete':
      return changed(s, {
        receipts: without(s.receipts, command.input.id),
        expenses: without(s.expenses, command.input.id),
      });
    case 'invite.create':
      return createInvite(s, command.input.role);
    case 'invite.revoke':
      return changed(s, {
        invites: s.invites.map((item) => {
          /* 요청한 초대만 철회한다. */ return item.id === command.input.id
            ? { ...item, revokedAt: new Date().toISOString() }
            : item;
        }),
      });
    case 'member.role':
      return s.members.some((item) => {
        /* 소유자 역할을 바꾸지 않는다. */ return (
          item.userId === command.input.userId && item.role !== 'owner'
        );
      })
        ? changed(s, {
            members: s.members.map((item) => {
              /* 대상 멤버 역할만 수정한다. */ return item.userId ===
                command.input.userId
                ? { ...item, role: command.input.role }
                : item;
            }),
          })
        : rejectRequest('ROLE_FORBIDDEN');
    case 'member.remove':
      return command.input.userId === s.trip.ownerId
        ? rejectRequest('ROLE_FORBIDDEN')
        : changed(s, {
            members: s.members.filter((item) => {
              /* 대상 멤버만 제거한다. */ return (
                item.userId !== command.input.userId
              );
            }),
          });
    case 'community.publish':
      return s.trip.status === 'COMPLETED'
        ? attachPost(s, publicPost(s, command.input))
        : rejectRequest('VALIDATION_FAILED');
    case 'community.withdraw':
      return changed(s, { postId: null }, {}, { post: null });
  }
}

// 변경 필드만 합성해 저장 후보를 만든다.
export function changed(
  s: Snapshot,
  patch: Partial<Snapshot>,
  result: Record<string, unknown> = {},
  extra: Partial<Change> = {},
): Change {
  // 버전 증가는 저장 계층이 CAS 시 확정한다.
  return { snapshot: { ...s, ...patch }, result, ...extra };
}

// DAY 축소 시 기존 기록을 잃지 않게 검사한다.
function changePeriod(
  s: Snapshot,
  start: string,
  end: string,
  identify: WorkspaceId,
): Change {
  // 일정·비용·영수증이 존재하는 날짜의 제거를 거부한다.
  return s.days.some((day) => {
    /* 범위 밖에 연결 데이터가 있는지 검사한다. */ return (
      (day.tripDate < start || day.tripDate > end) &&
      (s.itinerary.some((item) => {
        /* 날짜의 일정을 검사한다. */ return item.dayId === day.id;
      }) ||
        s.expenses.some((item) => {
          /* 날짜의 비용을 검사한다. */ return item.dayId === day.id;
        }))
    );
  }) ||
    s.receipts.some((item) => {
      /* 결제 날짜도 범위 안에 남아야 한다. */ return (
        item.date < start || item.date > end
      );
    })
    ? rejectRequest('VALIDATION_FAILED')
    : changed(s, {
        trip: { ...s.trip, startDate: start, endDate: end },
        days: tripDays(start, end, s.days, identify),
      });
}

// 확인한 영수증에서 일정·실제 비용을 함께 계산한다.
function confirmReceipt(
  s: Snapshot,
  input: Extract<WorkspaceCommand, { operation: 'receipt.confirm' }>['input'],
  identify: WorkspaceId,
): Change {
  // 영수증 재등록과 다른 여행 참조를 거부한다.
  return validDay(s, input.dayId) &&
    validSchedule(s, input.scheduleId, input.dayId) &&
    s.days.some((day) => {
      // 선택 DAY와 실제 결제 날짜가 같은지 서버에서도 확인한다.
      return day.id === input.dayId && day.tripDate === input.transactionDate;
    }) &&
    input.transactionDate >= s.trip.startDate &&
    input.transactionDate <= s.trip.endDate &&
    s.media.some((media) => {
      /* 영수증 목적 원본만 선택한다. */ return (
        media.id === input.mediaId && media.purpose === 'receipt'
      );
    }) &&
    !s.receipts.some((item) => {
      /* 한 원본에 두 결제를 등록하지 않는다. */ return (
        item.mediaId === input.mediaId || item.id === input.id
      );
    })
    ? receiptChange(s, input, input.scheduleId || identify())
    : rejectRequest('VALIDATION_FAILED');
}

// 영수증 연결 일정과 동일 ID 비용을 저장 후보에 반영한다.
function receiptChange(
  s: Snapshot,
  input: Extract<WorkspaceCommand, { operation: 'receipt.confirm' }>['input'],
  scheduleId: string,
): Change {
  // 사용자가 선택한 기존 일정은 내용을 덮어쓰지 않는다.
  return changed(
    s,
    {
      itinerary: input.scheduleId
        ? s.itinerary
        : [
            ...s.itinerary,
            {
              id: scheduleId,
              dayId: input.dayId,
              title: input.merchant,
              type: 'PLACE',
              timeSlot: input.transactionTime || null,
              sortOrder: s.itinerary.length + 1,
              memo: input.details || null,
              address: input.address,
            },
          ],
      media: s.media
        .filter((media) => {
          // 정보만 저장할 때 인식용 사진의 영구 참조를 제거한다.
          return input.keepPhoto !== false || media.id !== input.mediaId;
        })
        .map((media) => {
          // 확정한 영수증 원본을 같은 장소 기록에 연결한다.
          return media.id === input.mediaId ? { ...media, scheduleId } : media;
        }),
      receipts: [
        ...s.receipts,
        {
          id: input.id,
          scheduleId,
          mediaId: input.mediaId,
          keepPhoto: input.keepPhoto !== false,
          merchant: input.merchant,
          date: input.transactionDate,
          amount: input.amount,
          currency: input.currency,
          details: input.details,
          address: input.address,
          transactionTime: input.transactionTime,
          items: input.items,
          category: input.category,
        },
      ],
      expenses: [
        ...s.expenses,
        {
          id: input.id,
          dayId: input.dayId,
          scheduleId,
          title: input.merchant,
          amount: input.amount,
          currency: input.currency,
          isActual: true,
          category: input.category,
          source: 'receipt',
        },
      ],
    },
    {
      id: input.id,
      scheduleId,
      ...(input.keepPhoto !== false
        ? {}
        : {
            discardedReceiptPath: s.media.find((media) => {
              // 성공한 동일 요청의 재시도에서도 지울 원본 경로를 보존한다.
              return media.id === input.mediaId;
            })!.path,
          }),
    },
  );
}

// 보안 난수 초대 토큰을 만든다.
function createInvite(
  s: Snapshot,
  role: 'editor' | 'viewer',
  id = crypto.randomUUID(),
  token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((byte) => {
      /* 바이트를 16진수로 표시한다. */ return byte
        .toString(16)
        .padStart(2, '0');
    })
    .join(''),
  expires = Date.now() + 86400000,
): Change {
  // 토큰 원문은 명령 응답에서만 공유하고 DB에는 해시를 저장한다.
  return changed(
    s,
    {
      invites: [
        ...s.invites,
        {
          id,
          role,
          expiresAt: new Date(expires).toISOString(),
          revokedAt: null,
          usedAt: null,
        },
      ],
    },
    { id, token },
    { invite: { id, token, role, expires } },
  );
}

// 게시물 ID와 공개 스냅샷을 함께 확정 후보로 만든다.
function attachPost(s: Snapshot, post: CommunityPost): Change {
  // 한 여행당 공개 게시물 하나를 유지한다.
  return changed(s, { postId: post.id }, { id: post.id }, { post });
}
