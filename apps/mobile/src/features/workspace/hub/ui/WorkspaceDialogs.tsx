import { t } from '@/features/localization/translate';
import Text from '@/components/ui/AppText';
import CenteredNoticeModal from '@/components/ui/CenteredNoticeModal';
import DesignButton from '@/components/ui/DesignButton';
import { Ionicons } from '@expo/vector-icons';
import type { WorkspaceSchedule, WorkspaceSnapshot } from '@wherego/domain';
import { useState, type Dispatch, type SetStateAction } from 'react';
import { View } from 'react-native';
import PlanEditor from '../../my-trips/manager/PlanEditor';
import ReceiptCapture from '../../receipt/ui/ReceiptCapture';
import { TripMoreMenu } from './TripSectionNavigation';
import type {
  FieldErrors,
  FormFeedbackState,
} from '../../shared/model/formFeedback';
import { type PlanForm } from '../../shared/model/forms';
import { requestScheduleExit } from '../../schedule/ui/scheduleExitGuard';
import { tripHubStyles as hub } from '../styles/tripHubStyles';
import type { WorkspaceConfirmation } from '../model/workspaceConfirmation';
import type { WorkspaceDraftKind } from '../model/workspaceDrafts';
import type { WorkspaceScreenActions } from '../model/workspaceScreenActions';

// 현재 초안의 편집·저장·이탈 행동을 연결한다.
export function renderWorkspaceEditDialog({
  receipt,
  form,
  photo,
  userId,
  snapshot,
  busy,
  scanning,
  error,
  conflicted,
  hasPending,
  confirmation,
  feedback,
  invalidForm,
  change,
  save,
  reload,
  setForm,
}: {
  receipt: (mediaId: string) => Promise<unknown>;
  form: PlanForm | null;
  photo: (
    purpose: 'photo' | 'receipt',
    camera?: boolean,
    scheduleId?: string,
  ) => void;
  userId: string;
  snapshot: WorkspaceSnapshot | undefined;
  busy: boolean;
  scanning: boolean;
  error: string;
  conflicted: boolean;
  hasPending: boolean;
  confirmation: WorkspaceConfirmation | null;
  feedback: FormFeedbackState;
  invalidForm: (fields: FieldErrors) => void;
  change: (key: string, value: string) => void;
  save: () => void;
  reload: () => void;
  setForm: Dispatch<SetStateAction<PlanForm | null>>;
}) {
  // 전달받은 값과 행동을 기존 화면 규격으로 표시한다.

  return (
    <PlanEditor
      conflicted={conflicted}
      onRescan={() => {
        // 현재 확인 중인 원본 하나만 다시 요청한다.
        return requestScheduleExit(() => {
          // 수정한 초안을 버릴지 확인한 뒤 같은 원본을 다시 인식한다.
          return void receipt(form?.values.mediaId || '');
        });
      }}
      onReceipt={(camera) => {
        // 팝업을 닫지 않아 취소 시 입력을 유지하고 업로드 성공 시 영수증 확인으로 전환한다.
        requestScheduleExit(() => {
          // 영수증 작성으로 전환하기 전에 기존 변경 내용을 확인한다.
          return photo('receipt', camera);
        });
      }}
      userId={userId}
      form={form}
      snapshot={snapshot}
      busy={busy || scanning}
      error={error}
      locked={busy || scanning || hasPending || Boolean(confirmation)}
      feedback={feedback}
      onInvalid={invalidForm}
      onChange={change}
      onSave={save}
      onReload={reload}
      onClose={() => {
        // 저장 결과가 미확정이면 복구 전까지 폼을 유지한다.
        requestScheduleExit(() => {
          // 사용자가 명시적으로 버린 변경 내용만 해제한다.
          return setForm(null);
        });
      }}
    />
  );
}

// 영수증 촬영 안내와 실제 촬영·앨범 진입을 표시한다.
export function renderWorkspaceReceiptCapture({
  showReceiptCapture,
  busy,
  scanning,
  setShowReceiptCapture,
  captureReceipt,
  snapshot,
  writable,
  hasPending,
  openDraft,
}: {
  showReceiptCapture: boolean;
  busy: boolean;
  scanning: boolean;
  setShowReceiptCapture: Dispatch<SetStateAction<boolean>>;
  captureReceipt: (camera: boolean) => Promise<void>;
  snapshot: WorkspaceSnapshot | undefined;
  writable: boolean;
  hasPending: boolean;
  openDraft: (kind: WorkspaceDraftKind, schedule?: WorkspaceSchedule) => void;
}) {
  // 전달받은 값과 행동을 기존 화면 규격으로 표시한다.

  return (
    <ReceiptCapture
      visible={showReceiptCapture}
      busy={busy || scanning}
      onClose={() => {
        // 취소는 업로드나 일정 변경을 만들지 않는다.
        return setShowReceiptCapture(false);
      }}
      onCapture={() => {
        // 촬영 안내를 닫은 다음 시스템 카메라를 요청한다.
        return captureReceipt(true);
      }}
      onLibrary={() => {
        // 이미 찍은 영수증도 동일한 확인 절차로 연결한다.
        return captureReceipt(false);
      }}
      onManual={() => {
        // 사진이 없으면 가짜 영수증을 만들지 않고 기존 실제 지출 입력으로 연결한다.
        if (!snapshot || !writable || busy || scanning || hasPending) return;
        setShowReceiptCapture(false);
        openDraft('expense');
      }}
    />
  );
}

// 여행 부가 영역과 관리 메뉴를 표시한다.
export function renderWorkspaceMoreMenu({
  showTripMore,
  owner,
  activeSection,
  busy,
  scanning,
  hasPending,
  snapshot,
  setShowTripMore,
  openDraft,
  setActiveSection,
  offline,
  removeTrip,
}: {
  showTripMore: boolean;
  owner: boolean;
  activeSection: string;
  busy: boolean;
  scanning: boolean;
  hasPending: boolean;
  snapshot: WorkspaceSnapshot | undefined;
  setShowTripMore: Dispatch<SetStateAction<boolean>>;
  openDraft: (kind: WorkspaceDraftKind, schedule?: WorkspaceSchedule) => void;
  setActiveSection: Dispatch<SetStateAction<string>>;
  offline: boolean;
  removeTrip?: () => Promise<void>;
}) {
  return (
    <WorkspaceMoreMenuContainer
      showTripMore={showTripMore}
      owner={owner}
      activeSection={activeSection}
      busy={busy}
      scanning={scanning}
      hasPending={hasPending}
      snapshot={snapshot}
      setShowTripMore={setShowTripMore}
      openDraft={openDraft}
      setActiveSection={setActiveSection}
      offline={offline}
      removeTrip={removeTrip}
    />
  );
}

function WorkspaceMoreMenuContainer({
  showTripMore,
  owner,
  activeSection,
  busy,
  scanning,
  hasPending,
  snapshot,
  setShowTripMore,
  openDraft,
  setActiveSection,
  offline,
  removeTrip,
}: {
  showTripMore: boolean;
  owner: boolean;
  activeSection: string;
  busy: boolean;
  scanning: boolean;
  hasPending: boolean;
  snapshot: WorkspaceSnapshot | undefined;
  setShowTripMore: Dispatch<SetStateAction<boolean>>;
  openDraft: (kind: WorkspaceDraftKind, schedule?: WorkspaceSchedule) => void;
  setActiveSection: Dispatch<SetStateAction<string>>;
  offline: boolean;
  removeTrip?: () => Promise<void>;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  return (
    <>
      <TripMoreMenu
        visible={showTripMore}
        owner={owner}
        selected={activeSection}
        disabled={busy || scanning || hasPending || offline}
        onEditDestinations={() => {
          // 도시 편집도 기존 초안과 이탈 보호를 거친다.
          if (!snapshot) return;
          setShowTripMore(false);
          openDraft('destinations');
        }}
        onEditInfo={() => {
          // 메뉴를 닫고 소유자의 기존 정보·종료 상태 폼을 연다.
          return snapshot
            ? void (setShowTripMore(false), openDraft('metadata'))
            : undefined;
        }}
        onEditPeriod={() => {
          // 기간 변경은 기존 기록 유지와 확인 경로를 그대로 사용한다.
          return snapshot
            ? void (setShowTripMore(false), openDraft('period'))
            : undefined;
        }}
        onDeleteOrLeave={
          snapshot
            ? () => {
                setShowTripMore(false);
                setDeleteError('');
                setConfirmDelete(true);
              }
            : undefined
        }
        onClose={() => {
          /* 메뉴를 닫아도 기존 영역을 유지한다. */ return setShowTripMore(
            false,
          );
        }}
        onSelect={(next) => {
          /* 영역을 선택한 뒤 보조 메뉴만 닫는다. */ return void (setActiveSection(
            next,
          ),
          setShowTripMore(false));
        }}
      />
      <CenteredNoticeModal
        visible={confirmDelete}
        title={owner ? t('여행을 삭제할까요?') : t('여행에서 나갈까요?')}
        paragraphs={
          owner
            ? [
                t(
                  '삭제하면 일정·영수증·사진이 모두 지워지고, 커뮤니티에 공개한 글도 함께 내려갑니다. 이 작업은 되돌릴 수 없어요.',
                ),
              ]
            : [
                t(
                  '나가면 내 여행 목록에서 이 여행이 사라집니다. 다시 참여하려면 새 초대 링크가 필요해요.',
                ),
              ]
        }
      >
        <View style={{ gap: 10 }}>
          {deleteError ? (
            <Text accessibilityRole="alert" style={{ color: '#DC2626' }}>
              {t(deleteError)}
            </Text>
          ) : null}
          <DesignButton
            label={owner ? t('여행 삭제') : t('여행 나가기')}
            variant="danger"
            loading={deleting}
            disabled={deleting}
            onPress={() => {
              if (!snapshot || !removeTrip) return;
              setDeleting(true);
              setDeleteError('');
              void removeTrip()
                .then(() => {
                  setConfirmDelete(false);
                })
                .catch(() => {
                  setDeleteError(
                    '여행을 정리하지 못했어요. 잠시 후 다시 시도해 주세요.',
                  );
                })
                .finally(() => {
                  setDeleting(false);
                });
            }}
          />
          <DesignButton
            label={t('취소')}
            variant="secondary"
            disabled={deleting}
            onPress={() => setConfirmDelete(false)}
          />
        </View>
      </CenteredNoticeModal>
    </>
  );
}

// 04_1 하단 고정 액션바([ 🗺️ 동선 지도 보기 ] | [ 🧾 영수증으로 기록 ] | [ + 일정 추가 ])를 제공한다.
export function renderWorkspaceAddSchedule({
  busy,
  scanning,
  hasPending,
  actions,
  selectedDay,
  snapshot,
  setActiveSection,
  setShowReceiptCapture,
}: {
  busy: boolean;
  scanning: boolean;
  hasPending: boolean;
  actions: WorkspaceScreenActions;
  selectedDay: string;
  snapshot: WorkspaceSnapshot | undefined;
  setActiveSection?: Dispatch<SetStateAction<string>>;
  setShowReceiptCapture?: Dispatch<SetStateAction<boolean>>;
}): import('react').ReactNode {
  const dayId =
    snapshot?.days.find((day) => day.id === selectedDay)?.id ||
    snapshot?.days[0]?.id ||
    '';
  const locked = busy || scanning || hasPending;
  return (
    <View
      style={[hub.primaryBar, hub.primaryActionRow]}
      testID="trip-primary-action"
    >
      {setActiveSection && (
        <View style={hub.secondaryActionWrap}>
          <DesignButton
            label={t('동선 지도 보기')}
            accessibilityLabel={t('동선 지도 보기')}
            size="chip"
            disabled={locked}
            icon={(color) => (
              <Ionicons name="map-outline" size={16} color={color} />
            )}
            onPress={() => setActiveSection('map')}
          />
        </View>
      )}
      {setShowReceiptCapture && (
        <View style={hub.secondaryActionWrap}>
          <DesignButton
            label={t('영수증으로 기록')}
            accessibilityLabel={t('영수증으로 기록')}
            size="chip"
            disabled={locked}
            icon={(color) => (
              <Ionicons name="receipt-outline" size={16} color={color} />
            )}
            onPress={() => setShowReceiptCapture(true)}
          />
        </View>
      )}
      <View style={hub.primaryActionWrap}>
        <DesignButton
          label={t('일정 추가')}
          // 화면 문구와 보조기기 이름을 같게 두어 음성 명령·화면 낭독에서 같은 버튼으로 찾게 한다.
          accessibilityLabel={t('일정 추가')}
          variant="primary"
          size="chip"
          disabled={locked}
          icon={(color) => <Ionicons name="add" size={18} color={color} />}
          onPress={() => actions.addSchedule(dayId)}
        />
      </View>
    </View>
  );
}
