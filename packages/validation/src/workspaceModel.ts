import type { CommunityPost, PersistedTripInput } from '@wherego/domain';
import { tripDestinations, validTravelLeg } from '@wherego/domain';
import {
  updateTripDestinations,
  representativeDestinations,
} from './workspaceDestinations';
import type { WorkspaceCommand } from './workspace';
import {
  changed,
  rejectRequest,
  saveItem,
  without,
  validDay,
  validSchedule,
  type Snapshot,
  type Change,
  type WorkspaceId,
} from './workspaceModelCore';
import {
  saveSchedule,
  reorderSchedules,
  deleteSchedule,
} from './workspaceSchedules';
export {
  WorkspaceModelError,
  changed,
  type Snapshot,
  type Change,
  type WorkspaceId,
} from './workspaceModelCore';

// 서버의 Web Crypto UUID 생성기를 기본값으로 사용한다.
function randomId(): string {
  // 네이티브 앱은 Expo UUID 함수를 별도로 주입한다.
  return crypto.randomUUID();
}

// 달력 날짜를 UTC 기준으로 이동한다.
function dateAt(start: string, offset: number): string {
  // 지역 시간과 일광 절약 시간에 영향을 받지 않는다.
  return new Date(Date.parse(`${start}T00:00:00Z`) + offset * 86400000)
    .toISOString()
    .slice(0, 10);
}
export function tripDays(
  start: string,
  end: string,
  previous: Snapshot['days'] = [],
  identify: WorkspaceId = randomId,
): Snapshot['days'] {
  // 같은 날짜의 DAY와 계획 소개를 유지해 기간 확장에서도 기존 연결을 보존한다.
  const previousByDate = new Map(previous.map((day) => [day.tripDate, day]));
  const length =
    Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
  return Array.from({ length }, (_, index) => {
    const tripDate = dateAt(start, index);
    const existing = previousByDate.get(tripDate);
    return {
      ...existing,
      id: existing?.id || identify(),
      dayNumber: index + 1,
      tripDate,
    };
  });
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
      days: tripDays(input.startDate, input.endDate, [], identify).map(
        (day) => ({
          ...day,
          ...(input.destinations
            ? { destinationId: input.destinations[0]!.id }
            : {}),
        }),
      ),
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

// 완료 여행에서 사용자가 선택한 정보만 공개 스냅샷으로 만든다.
function publicPost(
  snapshot: Snapshot,
  input: Extract<WorkspaceCommand, { operation: 'community.publish' }>['input'],
): CommunityPost {
  // 영수증 원본과 메모는 공개 객체에 포함하지 않는다.
  return {
    id: snapshot.postId || crypto.randomUUID(),
    authorId: snapshot.trip.ownerId,
    kind: input.kind || 'record',
    author:
      snapshot.members.find((member) => {
        // 여행 소유자의 공개 닉네임만 사용한다.
        return member.userId === snapshot.trip.ownerId;
      })?.nickname || '여행자',
    title: input.kind === 'plan' ? snapshot.trip.title : input.title,
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
    'scheduleIds' | 'photoIds' | 'includeCosts' | 'kind'
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
      ...(input.kind === 'plan' && snapshot.trip.destinations
        ? {
            destinations: tripDestinations(snapshot.trip).filter(
              (destination, index) =>
                index === 0 ||
                snapshot.days.some(
                  (day) =>
                    day.destinationId === destination.id &&
                    snapshot.itinerary.some(
                      (item) =>
                        item.dayId === day.id &&
                        input.scheduleIds.includes(item.id),
                    ),
                ),
            ),
          }
        : {}),
      ...(input.kind === 'plan' && snapshot.travelLegs
        ? {
            travelLegs: snapshot.travelLegs
              .filter(
                (leg) =>
                  input.scheduleIds.includes(leg.fromScheduleId) &&
                  input.scheduleIds.includes(leg.toScheduleId) &&
                  Boolean(
                    snapshot.itinerary.find(
                      (item) => item.id === leg.fromScheduleId,
                    )?.googlePlaceId,
                  ) &&
                  Boolean(
                    snapshot.itinerary.find(
                      (item) => item.id === leg.toScheduleId,
                    )?.googlePlaceId,
                  ) &&
                  validTravelLeg(snapshot, leg),
              )
              .map(({ fromScheduleId, toScheduleId, mode }) => ({
                fromScheduleId,
                toScheduleId,
                mode,
              })),
          }
        : {}),
      country: snapshot.trip.country,
      city: snapshot.trip.city,
      startDate: snapshot.trip.startDate,
      endDate: snapshot.trip.endDate,
      ...(input.kind === 'plan'
        ? { days: publicPlanDays(snapshot, input.scheduleIds) }
        : {}),
      itinerary: input.scheduleIds.map((id) => {
        // 선택한 일정의 공개 필드만 변환한다.
        return publicSchedule(snapshot, id, input.kind === 'plan');
      }),
      costs: input.includeCosts ? costTotals(snapshot) : {},
    },
  };
}

// 공개 일정 한 개에서 비공개 내용을 제거한다.
function publicSchedule(
  snapshot: Snapshot,
  id: string,
  includePlan = false,
): CommunityPost['snapshot']['itinerary'][number] {
  // 존재하지 않는 ID를 빈 공개 일정으로 만들지 않는다.
  return selectedSchedule(
    snapshot,
    snapshot.itinerary.find((item) => {
      // 같은 여행 내에서 공개 선택을 찾는다.
      return item.id === id;
    }) || rejectRequest('VALIDATION_FAILED'),
    includePlan,
  );
}

// 일정의 위치·시각·제목만 공개한다.
function selectedSchedule(
  snapshot: Snapshot,
  item: Snapshot['itinerary'][number],
  includePlan: boolean,
): CommunityPost['snapshot']['itinerary'][number] {
  // 메모와 Google 원본 링크는 제외한다.
  return {
    title: item.title,
    ...(includePlan ? publicPlanSchedule(snapshot, item) : {}),
    address: item.address,
    timeSlot: item.timeSlot,
    date:
      snapshot.days.find((day) => {
        // 저장된 부모 날짜를 찾는다.
        return day.id === item.dayId;
      })?.tripDate || rejectRequest('VALIDATION_FAILED'),
  };
}

// 선택된 일정이 있는 DAY의 공개용 테마만 내보낸다.
function publicPlanDays(snapshot: Snapshot, selected: string[]) {
  // 비공개 DAY의 임의 필드는 복사하지 않는다.
  return snapshot.days
    .filter((day) => {
      // 같은 여행의 선택 일정에 연결된 날짜만 공개한다.
      return snapshot.itinerary.some((item) => {
        // 공개 선택 ID와 부모 DAY를 함께 대조한다.
        return selected.includes(item.id) && item.dayId === day.id;
      });
    })
    .map((day) => {
      // 원본 식별자 대신 DAY 번호와 명시적 계획 제목·컨셉만 공개한다.
      return {
        dayNumber: day.dayNumber,
        ...(day.destinationId ? { destinationId: day.destinationId } : {}),
        date: day.tripDate,
        planTitle: day.planTitle,
        planConcept: day.planConcept,
      };
    });
}

// 사용자가 별도로 저장한 공개용 계획 필드만 일정에 투영한다.
function publicPlanSchedule(
  snapshot: Snapshot,
  item: Snapshot['itinerary'][number],
) {
  // 개인 메모·항공 상세·영수증 정보는 이 객체에 포함하지 않는다.
  return {
    id: item.id,
    dayNumber: snapshot.days.find((day) => {
      // 같은 여행의 부모 DAY에서 일차 번호를 찾는다.
      return day.id === item.dayId;
    })?.dayNumber,
    sortOrder: item.sortOrder,
    type: item.type,
    googlePlaceId: item.googlePlaceId,
    planContent: item.planContent
      ? {
          description: item.planContent.description,
          choiceGroup: item.planContent.choiceGroup,
          choiceLabel: item.planContent.choiceLabel,
          choiceKind: item.planContent.choiceKind,
        }
      : item.planContent,
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
  if (snapshot.myRole === 'viewer') return rejectRequest('ROLE_FORBIDDEN');
  if (snapshot.trip.status === 'ARCHIVED')
    return rejectRequest('TRIP_ARCHIVED');
  if (
    /^(invite\.|member\.|community\.|trip\.)/.test(command.operation) &&
    snapshot.myRole !== 'owner'
  ) {
    return rejectRequest('ROLE_FORBIDDEN');
  }
  return applyCommand(snapshot, command, identify);
}

// 검증된 입력의 도메인 변화 하나를 선택한다.
function applyCommand(
  s: Snapshot,
  command: WorkspaceCommand,
  identify: WorkspaceId,
): Change {
  // 각 분기는 한 종류의 명령 결과만 반환한다.
  switch (command.operation) {
    case 'trip.destinations':
      return updateTripDestinations(s, command.input);
    case 'schedule.route':
      return validTravelLeg(s, command.input)
        ? changed(s, {
            travelLegs: [
              ...(s.travelLegs || []).filter(
                (leg) => leg.toScheduleId !== command.input.toScheduleId,
              ),
              command.input,
            ],
          })
        : rejectRequest('VALIDATION_FAILED');
    case 'day.plan':
      return validDay(s, command.input.dayId)
        ? changed(s, {
            days: s.days.map((day) => {
              // 선택 DAY만 변경하며 기존 DAY 식별자와 날짜를 보존한다.
              return day.id === command.input.dayId
                ? {
                    ...day,
                    planTitle: command.input.planTitle,
                    planConcept: command.input.planConcept,
                  }
                : day;
            }),
          })
        : rejectRequest('VALIDATION_FAILED');
    case 'schedule.save':
      return saveSchedule(s, command.input, identify);
    case 'schedule.reorder':
      return reorderSchedules(s, command.input);
    case 'schedule.delete':
      return deleteSchedule(s, command.input.id);
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
      return changed(s, {
        trip: {
          ...s.trip,
          ...command.input,
          ...(s.trip.destinations
            ? {
                destinations: representativeDestinations(
                  s,
                  command.input.country,
                  command.input.city,
                ),
              }
            : {}),
        },
      });
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
    case 'receipt.update':
      return updateReceipt(s, command.input);
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
      return (
        command.input.kind === 'plan'
          ? command.input.scheduleIds.length > 0 && s.trip.status !== 'ARCHIVED'
          : s.trip.status === 'COMPLETED'
      )
        ? attachPost(s, publicPost(s, command.input))
        : rejectRequest('VALIDATION_FAILED');
    case 'community.withdraw':
      return changed(s, { postId: null }, {}, { post: null });
  }
}

// DAY 축소 시 기존 기록을 잃지 않게 검사한다.
function changePeriod(
  s: Snapshot,
  start: string,
  end: string,
  identify: WorkspaceId,
): Change {
  // DAY 소개·일정·비용·영수증이 있는 날짜를 조용히 버리지 않는다.
  return s.days.some((day) => {
    /* 범위 밖에 연결 데이터가 있는지 검사한다. */ return (
      (day.tripDate < start || day.tripDate > end) &&
      (Boolean(day.planTitle || day.planConcept) ||
        s.itinerary.some((item) => {
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
function updateReceipt(
  s: Snapshot,
  input: Extract<WorkspaceCommand, { operation: 'receipt.update' }>['input'],
): Change {
  // 확정한 원본·보관 선택은 바꾸지 않고 같은 영수증·지출만 교체한다.
  return s.receipts.some((receipt) => {
    // 다른 영수증의 원본을 가로채거나 삭제한 사진을 보관 상태로 되돌리지 않는다.
    return (
      receipt.id === input.id &&
      receipt.mediaId === input.mediaId &&
      receipt.keepPhoto === (input.keepPhoto !== false)
    );
  }) &&
    validDay(s, input.dayId) &&
    Boolean(input.scheduleId) &&
    validSchedule(s, input.scheduleId, input.dayId) &&
    s.days.some((day) => {
      // 수정한 결제일도 같은 여행 날짜에 연결한다.
      return day.id === input.dayId && day.tripDate === input.transactionDate;
    })
    ? receiptChange(
        {
          ...s,
          receipts: without(s.receipts, input.id),
          expenses: without(s.expenses, input.id),
        },
        input,
        input.scheduleId!,
      )
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
      ...(input.keepPhoto !== false ||
      !s.media.some((media) => {
        // 정보만 남긴 영수증 수정에서는 이미 삭제한 원본을 다시 찾지 않는다.
        return media.id === input.mediaId;
      })
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
