import { returnToScreen } from '@/components/navigationModel';
import Text from '@/components/AppText';
import DesignButton from '@/components/DesignButton';
import ScreenHeader from '@/components/ScreenHeader';
import ScreenTitle from '@/components/ScreenTitle';
import TripIcon from '@/components/icons/TripIcon';
import { Ionicons } from '@expo/vector-icons';
import type { UseQueryResult } from '@tanstack/react-query';
import type { WorkspaceSchedule, WorkspaceSnapshot } from '@wherego/domain';
import type { ImperativeRouter } from 'expo-router';
import type { Dispatch, SetStateAction } from 'react';
import { View } from 'react-native';
import PublishReadiness from './PublishReadiness';
import PublishedPlanActions from './PublishedPlanActions';
import ReceiptDetails from './ReceiptDetails';
import ScheduleCoursePicker from './ScheduleCoursePicker';
import ServerPhoto from './ServerPhoto';
import {
  TripChecklistProgress,
  TripCostSummary,
  TripDetailEmpty,
  TripExpenseHeading,
  TripMemberHeading,
} from './TripDetailParts';
import TripMap from './TripMap';
import TripMapCanvas from './TripMapCanvas';
import { tripMapStops } from './tripMapModel';
import { triggerHaptic } from '@/components/haptics';
import { colors } from '@/constants/theme';
import TripTimeline, { TripDayStrip } from './TripTimeline';
import { type PlanForm } from './forms';
import { memberRoleLabel } from './presentation';
import { requestScheduleExit } from './scheduleExitGuard';
import { travelDateRange } from './travelDateRange';
import { tripDetailStyles as detail } from './tripDetailStyles';
import { tripHubStyles as hub } from './tripHubStyles';
import { tripPresentation } from './tripLifecycle';
import { Action, Field } from './ui';
import type { WorkspaceDraftKind } from './workspaceDrafts';
import type { WorkspaceScreenActions } from './workspaceScreenActions';
import { styles } from './workspaceStyles';
// renderWorkspaceCourse이 읽는 값과 실행 가능한 행동의 계약이다.
type RenderWorkspaceCourseProps = {
  snapshot: WorkspaceSnapshot | undefined;
  courseDay: string;
  setCourseDay: Dispatch<SetStateAction<string>>;
  actions: WorkspaceScreenActions;
};

// 선택 날짜에 넣을 추천 코스 선택을 표시한다.
export function renderWorkspaceCourse({
  snapshot,
  courseDay,
  setCourseDay,
  actions,
}: RenderWorkspaceCourseProps): import('react').ReactNode {
  // 전달받은 값과 행동을 기존 화면 규격으로 표시한다.

  return (
    snapshot && (
      <ScheduleCoursePicker
        visible={Boolean(courseDay)}
        country={snapshot.trip.country}
        city={snapshot.trip.city}
        onClose={() => {
          // 미리보기 취소는 일정이나 날짜를 바꾸지 않는다.
          return setCourseDay('');
        }}
        onSelect={(place) => {
          /* 코스 선택 후 같은 작성 화면으로 이동한다. */ actions.chooseCoursePlace(
            courseDay,
            place,
          );
          setCourseDay('');
        }}
        onSearch={() => {
          /* 선택 날짜의 실제 장소 검색을 연다. */ actions.addSchedule(
            courseDay,
          );
          setCourseDay('');
        }}
      />
    )
  );
}
// renderWorkspaceSharing이 읽는 값과 실행 가능한 행동의 계약이다.
type RenderWorkspaceSharingProps = {
  owner: boolean;
  activeSection: string;
  router: ImperativeRouter;
  snapshot: WorkspaceSnapshot;
  busy: boolean;
  scanning: boolean;
  hasPending: boolean;
  openDraft: (kind: WorkspaceDraftKind, schedule?: WorkspaceSchedule) => void;
  actions: WorkspaceScreenActions;
};

// 여행 공유와 공개 관리 행동을 표시한다.
export function renderWorkspaceSharing({
  owner,
  activeSection,
  router,
  snapshot,
  busy,
  scanning,
  hasPending,
  openDraft,
  actions,
}: RenderWorkspaceSharingProps) {
  // 전달받은 값과 행동을 기존 화면 규격으로 표시한다.

  return (
    owner &&
    activeSection === 'share' && (
      <View style={styles.card}>
        <Text style={styles.title}>선택해서 공유</Text>
        <Action
          label="공개된 여행 둘러보기"
          variant="quiet"
          onPress={() => {
            // 공개된 여행을 확인할 수 있는 피드로 이동한다.
            return router.push('/(tabs)/community');
          }}
        />
        <Text>
          공개할 일정·사진·금액을 직접 골라 주세요. 게시하지 않아도 개인 기록은
          남아요.
        </Text>
        {snapshot.postId && (
          <>
            <Text style={styles.subtitle}>
              다시 공개하면 같은 링크의 내용이 새 선택으로 바뀌어요. 여행계획과
              여행기록은 한 여행당 하나만 공개돼요.
            </Text>
            <Action
              label="내 공개 화면 보기"
              variant="quiet"
              onPress={() => {
                // 공개본 ID는 원본 여행의 서버 응답에서만 읽는다.
                return router.push({
                  pathname: '/community/[postId]',
                  params: { postId: snapshot.postId! },
                });
              }}
            />
            <PublishedPlanActions
              key={snapshot.postId}
              title={snapshot.trip.title}
              postId={snapshot.postId}
              disabled={busy || scanning || hasPending}
            />
          </>
        )}
        <Action
          label="여행계획 공유하기"
          disabled={
            snapshot.trip.status === 'ARCHIVED' ||
            busy ||
            scanning ||
            hasPending
          }
          onPress={() => {
            // 다녀온 기록으로 바꾸지 않고 계획 자체의 공개 내용을 선택한다.
            return openDraft('plan-share');
          }}
        />
        {snapshot.trip.status !== 'COMPLETED' &&
          snapshot.trip.status !== 'ARCHIVED' && (
            <PublishReadiness
              disabled={busy || scanning || hasPending}
              onComplete={actions.completeTrip}
            />
          )}
        <Action
          label={
            snapshot.postId ? '여행기록으로 바꿔 공유' : '여행기록 공유하기'
          }
          disabled={snapshot.trip.status !== 'COMPLETED' || busy || hasPending}
          onPress={() => {
            // 새 공개 폼은 모든 민감 항목을 선택 해제한다.
            openDraft('record-share');
          }}
        />
        {snapshot.postId && (
          <Action
            variant="danger"
            label="공개 중단"
            disabled={busy || scanning || hasPending}
            onPress={actions.withdraw}
          />
        )}
      </View>
    )
  );
}
// renderWorkspaceMembers이 읽는 값과 실행 가능한 행동의 계약이다.
type RenderWorkspaceMembersProps = {
  activeSection: string;
  snapshot: WorkspaceSnapshot;
  owner: boolean;
  busy: boolean;
  scanning: boolean;
  hasPending: boolean;
  invite: (role: 'viewer' | 'editor') => void;
  actions: WorkspaceScreenActions;
};

// 동행자와 초대 관리 행동을 표시한다.
export function renderWorkspaceMembers({
  activeSection,
  snapshot,
  owner,
  busy,
  scanning,
  hasPending,
  invite,
  actions,
}: RenderWorkspaceMembersProps) {
  // 전달받은 값과 행동을 기존 화면 규격으로 표시한다.

  return (
    activeSection === 'companions' && (
      <View testID="trip-companions-panel" style={detail.section}>
        <Text style={detail.title}>동행</Text>
        <Text style={detail.meta}>
          함께하는 {snapshot.members.length}명 · 여행을 만든 사람이 초대와
          역할을 관리해요.
        </Text>
        {snapshot.members.map((member) => (
          <View key={member.memberId} style={detail.card}>
            <TripMemberHeading member={member} />
            {owner && member.role !== 'owner' && (
              <View style={styles.row}>
                <Action
                  label={
                    member.role === 'viewer'
                      ? '편집자로 변경'
                      : '보기 전용으로 변경'
                  }
                  disabled={busy || scanning || hasPending}
                  onPress={() => actions.changeMemberRole(member)}
                />
                <Action
                  variant="danger"
                  label="동행 참여 해제"
                  disabled={busy || scanning || hasPending}
                  onPress={() => actions.removeMember(member)}
                />
              </View>
            )}
          </View>
        ))}
        {owner && (
          <>
            <View style={styles.row}>
              <Action
                label="편집 초대 공유"
                variant="primary"
                disabled={busy || scanning || hasPending}
                onPress={() => {
                  // 공동 작성 가능한 초대를 발급한다.
                  invite('editor');
                }}
              />
              <Action
                label="보기 초대 공유"
                disabled={busy || scanning || hasPending}
                onPress={() => {
                  // 읽기 전용 역할을 서버에 기록한다.
                  invite('viewer');
                }}
              />
            </View>
            <Text style={detail.title}>초대 내역</Text>
            {!snapshot.invites.length && (
              <Text style={detail.meta}>
                아직 보낸 초대가 없어요. 위에서 함께할 사람을 초대해 보세요.
              </Text>
            )}
            {snapshot.invites.map((item) => (
              <View key={item.id} style={detail.card}>
                <Text style={detail.meta}>
                  {memberRoleLabel(item.role)} · 만료{' '}
                  {item.expiresAt.slice(0, 10)} ·{' '}
                  {item.revokedAt
                    ? '취소됨'
                    : item.usedAt
                      ? '수락됨'
                      : '대기 중'}
                </Text>
                {!item.revokedAt && (
                  <Action
                    variant="danger"
                    label="초대 취소"
                    disabled={busy || scanning || hasPending}
                    onPress={() => actions.revokeInvite(item)}
                  />
                )}
              </View>
            ))}
          </>
        )}
      </View>
    )
  );
}
// renderWorkspaceChecklist이 읽는 값과 실행 가능한 행동의 계약이다.
type RenderWorkspaceChecklistProps = {
  activeSection: string;
  snapshot: WorkspaceSnapshot;
  writable: boolean;
  busy: boolean;
  scanning: boolean;
  hasPending: boolean;
  check: (item: { id: string; isCompleted: boolean }) => void;
  checklist: string;
  changeChecklist: (value: string) => void;
  checklistError: string;
  addCheck: () => void;
};

// 준비물 상태와 추가 입력을 표시한다.
export function renderWorkspaceChecklist({
  activeSection,
  snapshot,
  writable,
  busy,
  scanning,
  hasPending,
  check,
  checklist,
  changeChecklist,
  checklistError,
  addCheck,
}: RenderWorkspaceChecklistProps) {
  // 전달받은 값과 행동을 기존 화면 규격으로 표시한다.

  return (
    activeSection === 'preparation' && (
      <View testID="trip-checklist-panel" style={detail.section}>
        <TripChecklistProgress items={snapshot.checklists} />
        {!snapshot.checklists.length && (
          <TripDetailEmpty
            title="아직 준비물이 없어요"
            description={
              writable
                ? '아래에 챙길 물건을 적어보세요. 준비한 항목은 체크할 수 있어요.'
                : '동행자가 추가한 준비물을 여기서 함께 확인해요.'
            }
          />
        )}
        {snapshot.checklists.map((item) => (
          <DesignButton
            key={item.id}
            label={item.title}
            accessibilityLabel={`${item.isCompleted ? '✓ ' : '□ '}${item.title}`}
            checked={item.isCompleted}
            selected={item.isCompleted}
            icon={(color) => {
              /* 완료 전에도 체크 위치를 읽기 쉬운 선으로 표시한다. */ return (
                <Ionicons name="square-outline" size={20} color={color} />
              );
            }}
            disabled={!writable || busy || scanning || hasPending}
            onPress={() => {
              // 권한·버전 검증을 포함해 완료 상태를 저장한다.
              check(item);
            }}
          />
        ))}
        {writable && (
          <>
            <Field
              label="새 준비물"
              disabled={busy || scanning || hasPending}
              value={checklist}
              onChange={(value) => {
                /* 대기 중인 준비물 요청과 입력을 섞지 않는다. */ return changeChecklist(
                  value,
                );
              }}
            />
            {checklistError ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {checklistError}
              </Text>
            ) : null}
            <Action
              label="준비물 추가"
              variant="primary"
              disabled={busy || scanning || hasPending}
              onPress={addCheck}
            />
          </>
        )}
      </View>
    )
  );
}
// renderWorkspacePhotos이 읽는 값과 실행 가능한 행동의 계약이다.
type RenderWorkspacePhotosProps = {
  activeSection: string;
  snapshot: WorkspaceSnapshot;
  writable: boolean;
  busy: boolean;
  scanning: boolean;
  hasPending: boolean;
  userId: string;
  retryReceipt: (mediaId: string) => void;
  actions: WorkspaceScreenActions;
};

// 등록 사진과 영수증 기록을 표시한다.
export function renderWorkspacePhotos({
  activeSection,
  snapshot,
  writable,
  busy,
  scanning,
  hasPending,
  userId,
  retryReceipt,
  actions,
}: RenderWorkspacePhotosProps) {
  // 전달받은 값과 행동을 기존 화면 규격으로 표시한다.

  return (
    activeSection === 'photos' && (
      <View style={styles.card}>
        <Text style={styles.title}>사진 · 영수증</Text>
        {snapshot.receipts
          .filter((item) => {
            // 원본을 보관하지 않은 기록도 다시 조회할 수 있다.
            return item.keepPhoto === false;
          })
          .map((item) => (
            <View key={item.id} style={styles.card}>
              <Text style={styles.title}>
                {item.merchant} · {item.date} · {item.amount} {item.currency}
              </Text>
              <Text style={styles.subtitle}>정보만 저장한 영수증</Text>
              <ReceiptDetails receipt={item} />
              <Action
                label="영수증 기록 수정"
                disabled={!writable || busy || scanning || hasPending}
                onPress={() => actions.editReceipt(item)}
              />
              <Action
                label="영수증 기록·지출 삭제"
                disabled={!writable || busy || scanning || hasPending}
                onPress={() => actions.deleteReceipt(item)}
              />
            </View>
          ))}
        {snapshot.media.map((media) => (
          <View key={media.id} style={{ gap: 10 }}>
            <ServerPhoto
              userId={userId}
              tripId={snapshot.trip.id}
              mediaId={media.id}
            />
            <Text>
              {media.purpose === 'receipt' ? '비공개 영수증' : '여행 사진'}
            </Text>
            {media.purpose === 'receipt' &&
              !snapshot.receipts.some((item) => {
                // 확정 기록이 없는 원본은 인식·수동 확인을 재개할 수 있다.
                return item.mediaId === media.id;
              }) && (
                <Action
                  label="영수증 확인 / 인식 재시도"
                  disabled={!writable || busy || scanning || hasPending}
                  onPress={() => {
                    // 같은 원본에서 확인 폼을 다시 작성한다.
                    retryReceipt(media.id);
                  }}
                />
              )}
            {snapshot.receipts
              .filter((item) => {
                // 원본과 확정 기록을 함께 표시한다.
                return item.mediaId === media.id;
              })
              .map((item) => (
                <View key={item.id}>
                  <Text>
                    {item.merchant} · {item.date} · {item.amount}{' '}
                    {item.currency}
                  </Text>
                  <ReceiptDetails receipt={item} />
                  <Action
                    label="영수증 기록 수정"
                    disabled={!writable || busy || scanning || hasPending}
                    onPress={() => actions.editReceipt(item)}
                  />
                  <Action
                    variant="danger"
                    label="영수증 기록·지출 삭제"
                    disabled={!writable || busy || scanning || hasPending}
                    onPress={() => actions.deleteReceipt(item)}
                  />
                </View>
              ))}
            <Action
              variant="danger"
              label="사진 등록 삭제"
              disabled={!writable || busy || scanning || hasPending}
              onPress={() => actions.deleteMedia(media)}
            />
          </View>
        ))}
      </View>
    )
  );
}
// renderWorkspaceExpenses이 읽는 값과 실행 가능한 행동의 계약이다.
type RenderWorkspaceExpensesProps = {
  activeSection: string;
  snapshot: WorkspaceSnapshot;
  writable: boolean;
  busy: boolean;
  scanning: boolean;
  hasPending: boolean;
  actions: WorkspaceScreenActions;
};

// 실제 비용과 수정·삭제 행동을 표시한다.
export function renderWorkspaceExpenses({
  activeSection,
  snapshot,
  writable,
  busy,
  scanning,
  hasPending,
  actions,
}: RenderWorkspaceExpensesProps) {
  // 전달받은 값과 행동을 기존 화면 규격으로 표시한다.

  return (
    activeSection === 'expenses' && (
      <View testID="trip-expenses-panel" style={detail.section}>
        <Text style={detail.title}>비용</Text>
        <TripCostSummary expenses={snapshot.expenses} />
        {!snapshot.expenses.length && (
          <TripDetailEmpty
            title="아직 기록한 비용이 없어요"
            description={
              writable
                ? '비용 추가에서 실제 지출이나 예상 비용을 남겨보세요.'
                : '여행에서 남긴 비용을 여기서 함께 확인해요.'
            }
          />
        )}
        {snapshot.expenses.map((item) => (
          <View key={item.id} style={detail.card}>
            <TripExpenseHeading
              item={item}
              scheduleTitle={
                snapshot.itinerary.find((schedule) => {
                  /* 비용에 연결한 실제 일정만 찾는다. */ return (
                    schedule.id === item.scheduleId
                  );
                })?.title
              }
            />
            {item.source === 'manual' && (
              <View style={styles.row}>
                <Action
                  label="비용 수정"
                  disabled={!writable || busy || scanning || hasPending}
                  onPress={() => actions.editExpense(item)}
                />
                <Action
                  variant="danger"
                  label="비용 삭제"
                  disabled={!writable || busy || scanning || hasPending}
                  onPress={() => actions.deleteExpense(item)}
                />
              </View>
            )}
          </View>
        ))}
      </View>
    )
  );
}
// renderWorkspaceCapture이 읽는 값과 실행 가능한 행동의 계약이다.
type RenderWorkspaceCaptureProps = {
  activeSection: string;
  writable: boolean;
  busy: boolean;
  scanning: boolean;
  hasPending: boolean;
  openDraft: (kind: WorkspaceDraftKind, schedule?: WorkspaceSchedule) => void;
  photo: (
    purpose: 'photo' | 'receipt',
    camera?: boolean,
    scheduleId?: string,
  ) => void;
  setShowReceiptCapture: Dispatch<SetStateAction<boolean>>;
};

// 비용·사진·영수증 등록 진입을 표시한다.
export function renderWorkspaceCapture({
  activeSection,
  writable,
  busy,
  scanning,
  hasPending,
  openDraft,
  photo,
  setShowReceiptCapture,
}: RenderWorkspaceCaptureProps) {
  // 전달받은 값과 행동을 기존 화면 규격으로 표시한다.

  return (
    ['expenses', 'photos'].includes(activeSection) && (
      <View style={styles.row}>
        {activeSection === 'expenses' && (
          <Action
            variant="primary"
            label="비용 추가"
            disabled={!writable || busy || scanning || hasPending}
            onPress={() => {
              // 실제 비용과 예상 비용은 명시적으로 구분한다.
              openDraft('expense');
            }}
          />
        )}
        {activeSection === 'photos' && (
          <Action
            variant="primary"
            label="사진 추가"
            disabled={!writable || busy || scanning || hasPending}
            onPress={() => {
              // 사진은 멤버만 읽는 비공개 원본으로 업로드한다.
              photo('photo');
            }}
          />
        )}
        <Action
          label="영수증 촬영"
          disabled={!writable || busy || scanning || hasPending}
          onPress={() => {
            // 촬영 안내를 확인한 뒤 실제 기기 카메라로 진행한다.
            return setShowReceiptCapture(true);
          }}
        />
        <Action
          label="영수증 사진 선택"
          disabled={!writable || busy || scanning || hasPending}
          onPress={() => {
            // 기존 촬영 영수증도 같은 확인 절차를 사용한다.
            photo('receipt');
          }}
        />
      </View>
    )
  );
}
// renderWorkspaceItinerary이 읽는 값과 실행 가능한 행동의 계약이다.
type RenderWorkspaceItineraryProps = {
  activeSection: string;
  snapshot: WorkspaceSnapshot;
  selectedDay: string;
  setSelectedDay: Dispatch<SetStateAction<string>>;
  selectedScheduleId?: string;
  setSelectedScheduleId?: Dispatch<SetStateAction<string>>;
  userId: string;
  writable: boolean;
  setCourseDay: Dispatch<SetStateAction<string>>;
  busy: boolean;
  scanning: boolean;
  hasPending: boolean;
  openDraft: (kind: WorkspaceDraftKind, schedule?: WorkspaceSchedule) => void;
  photo: (
    purpose: 'photo' | 'receipt',
    camera?: boolean,
    scheduleId?: string,
  ) => void;
  actions: WorkspaceScreenActions;
};

// 선택 날짜의 일정과 편집 행동을 표시한다.
export function renderWorkspaceItinerary({
  activeSection,
  snapshot,
  selectedDay,
  setSelectedDay,
  selectedScheduleId = '',
  setSelectedScheduleId,
  userId,
  writable,
  setCourseDay,
  busy,
  scanning,
  hasPending,
  openDraft,
  photo,
  actions,
}: RenderWorkspaceItineraryProps) {
  // 전달받은 값과 행동을 기존 화면 규격으로 표시한다.
  const currentDayId =
    selectedDay === 'all'
      ? snapshot.days[0]?.id || ''
      : snapshot.days.find((day) => day.id === selectedDay)?.id ||
        snapshot.days[0]?.id ||
        '';
  const currentStops = tripMapStops(snapshot.itinerary, currentDayId);

  return (
    activeSection === 'itinerary' && (
      <>
        {currentStops.length > 0 && (
          <View
            style={{
              marginBottom: 16,
              borderRadius: 16,
              overflow: 'hidden',
              backgroundColor: colors.surface,
            }}
          >
            <TripMapCanvas
              stops={currentStops}
              selectedId={selectedScheduleId}
              onSelect={(id) => {
                triggerHaptic('selection');
                setSelectedScheduleId?.(id);
              }}
            />
          </View>
        )}
        <TripDayStrip
          allowAll
          days={snapshot.days}
          selected={
            selectedDay === 'all'
              ? 'all'
              : snapshot.days.find((day) => {
                  // 여행 기간 변경으로 사라진 선택 날짜는 첫 날짜로 복구한다.
                  return day.id === selectedDay;
                })?.id ||
                snapshot.days[0]?.id ||
                ''
          }
          onSelect={(dayId) => {
            triggerHaptic('light');
            setSelectedDay(dayId);
          }}
        />
        {snapshot.days
          .filter((day) => {
            // 기간 변경으로 선택 날짜가 사라지면 첫 날짜를 표시한다.
            return (
              selectedDay === 'all' ||
              day.id ===
                (snapshot.days.some((item) => {
                  // 선택 날짜가 최신 여행에 남아 있는지 확인한다.
                  return item.id === selectedDay;
                })
                  ? selectedDay
                  : snapshot.days[0]?.id)
            );
          })
          .map((day) => (
            <TripTimeline
              key={day.id}
              snapshot={snapshot}
              userId={userId}
              day={day}
              selectedScheduleId={selectedScheduleId}
              onSelectSchedule={(id) => {
                triggerHaptic('selection');
                setSelectedScheduleId?.(id);
              }}
              canCreate={writable}
              onPlan={() => actions.editDayPlan(day)}
              onAdd={() => actions.addSchedule(day.id)}
              onCourse={() => {
                // 코스를 넣을 날짜를 선택 당시 값으로 고정한다.
                return setCourseDay(day.id);
              }}
              disabled={!writable || busy || scanning || hasPending}
              onReorder={(ids) => actions.reorderSchedules(day.id, ids)}
              onRecommend={(item) => actions.chooseRecommendation(day.id, item)}
              onRoute={actions.saveTravelLeg}
              onExpense={(item) => {
                // 선택 장소에 실제 지출을 연결한다.
                return openDraft('expense', item);
              }}
              onCapture={(item) => {
                // 실제 카메라 사진을 선택한 장소에 연결한다.
                return photo('photo', true, item.id);
              }}
              onPhoto={(item) => {
                // 기존 앨범 사진을 선택한 장소에 연결한다.
                return photo('photo', false, item.id);
              }}
              onEdit={(item) => actions.editSchedule(item)}
              onCopy={(item) => actions.copySchedule(item)}
              onDelete={(item) => actions.deleteSchedule(item)}
            />
          ))}
      </>
    )
  );
}
// renderWorkspaceMap이 읽는 값과 실행 가능한 행동의 계약이다.
type RenderWorkspaceMapProps = {
  activeSection: string;
  form: PlanForm | null;
  snapshot: WorkspaceSnapshot;
  selectedDay: string;
  setSelectedDay: Dispatch<SetStateAction<string>>;
  writable: boolean;
  busy: boolean;
  scanning: boolean;
  hasPending: boolean;
  actions: WorkspaceScreenActions;
};

// 선택 날짜의 지도 영역을 표시한다.
export function renderWorkspaceMap({
  activeSection,
  form,
  snapshot,
  selectedDay,
  setSelectedDay,
  writable,
  busy,
  scanning,
  hasPending,
  actions,
}: RenderWorkspaceMapProps) {
  // 전달받은 값과 행동을 기존 화면 규격으로 표시한다.

  return (
    activeSection === 'map' &&
    !form && (
      <>
        <TripDayStrip
          days={snapshot.days}
          selected={
            snapshot.days.some((day) => {
              // 기간 변경으로 사라진 선택은 첫 여행 날짜로 복구한다.
              return day.id === selectedDay;
            })
              ? selectedDay
              : snapshot.days[0]?.id || ''
          }
          onSelect={setSelectedDay}
        />
        <TripMap
          key={selectedDay}
          snapshot={snapshot}
          dayId={
            snapshot.days.some((day) => {
              // 해당 날짜의 저장된 일정만 지도에서 읽는다.
              return day.id === selectedDay;
            })
              ? selectedDay
              : snapshot.days[0]?.id || ''
          }
          disabled={!writable || busy || scanning || hasPending}
          onEdit={(item) => actions.editSchedule(item)}
        />
      </>
    )
  );
}
// renderWorkspaceSummary이 읽는 값과 실행 가능한 행동의 계약이다.
type RenderWorkspaceSummaryProps = {
  snapshot: WorkspaceSnapshot;
  router: ImperativeRouter;
};

// 여행 제목·상태·동행 요약을 표시한다.
export function renderWorkspaceSummary({
  snapshot,
  router,
}: RenderWorkspaceSummaryProps) {
  // 전달받은 값과 행동을 기존 화면 규격으로 표시한다.

  return (
    <View style={hub.tripHeader}>
      <View style={hub.titleRow}>
        <ScreenTitle grow>{snapshot.trip.title}</ScreenTitle>
      </View>
      <Text style={hub.status}>
        {tripPresentation(snapshot.trip).label} ·{' '}
        {travelDateRange(snapshot.trip.startDate, snapshot.trip.endDate)}
      </Text>
      {tripPresentation(snapshot.trip).phase === 'COMPLETED' && (
        <Text style={hub.meta}>
          여행이 끝났어요. 남긴 일정과 사진, 비용을 기록에서 확인해 보세요.
        </Text>
      )}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <TripIcon name="user-outline" size={16} />
        <Text style={hub.meta}>
          {snapshot.trip.city || snapshot.trip.country} · 함께하는 멤버{' '}
          {snapshot.members.length}명 · {memberRoleLabel(snapshot.myRole)}
        </Text>
      </View>
      {tripPresentation(snapshot.trip).phase === 'COMPLETED' && (
        <Action
          label="기록 보러가기"
          onPress={() => {
            // 종료된 여행의 일정·사진·비용을 날짜별로 읽는다.
            return router.push(`/diary/${snapshot.trip.id}`);
          }}
        />
      )}
    </View>
  );
}
// renderWorkspaceHeader이 읽는 값과 실행 가능한 행동의 계약이다.
type RenderWorkspaceHeaderProps = {
  id: string | undefined;
  router: ImperativeRouter;
  snapshot: WorkspaceSnapshot | undefined;
  workspace: UseQueryResult<WorkspaceSnapshot, Error>;
  showTripMore: boolean;
  setShowTripMore: Dispatch<SetStateAction<boolean>>;
};

// 실제 여행의 공통 이동 헤더를 표시한다.
export function renderWorkspaceHeader({
  id,
  router,
  snapshot,
  workspace,
  showTripMore,
  setShowTripMore,
}: RenderWorkspaceHeaderProps): import('react').ReactNode {
  // 전달받은 값과 행동을 기존 화면 규격으로 표시한다.

  return (
    id && (
      <ScreenHeader
        backLabel="내 여행 목록"
        onBack={() => {
          /* 작성 중인 내용과 대기 요청을 확인한 뒤 목록으로 돌아간다. */ return requestScheduleExit(
            () => {
              /* 기존 목록 경로를 연다. */ return returnToScreen(
                router,
                '/plans',
              );
            },
          );
        }}
        actions={
          snapshot && !workspace.isError
            ? [
                {
                  icon: 'more',
                  label: '여행 더보기',
                  expanded: showTripMore,
                  onPress: () => {
                    // 여행에 관련된 보조 행동만 메뉴로 연다.
                    return setShowTripMore(true);
                  },
                },
              ]
            : undefined
        }
      />
    )
  );
}
