import DesignButton from '@/components/DesignButton';
import { Ionicons } from '@expo/vector-icons';
import type { WorkspaceSchedule, WorkspaceSnapshot } from '@wherego/domain';
import type { Dispatch, SetStateAction } from 'react';
import { View } from 'react-native';
import PlanEditor from './PlanEditor';
import ReceiptCapture from './ReceiptCapture';
import { TripMoreMenu } from './TripSectionNavigation';
import type { FieldErrors, FormFeedbackState } from './formFeedback';
import { type PlanForm } from './forms';
import { requestScheduleExit } from './scheduleExitGuard';
import { tripHubStyles as hub } from './tripHubStyles';
import type { WorkspaceConfirmation } from './workspaceConfirmation';
import type { WorkspaceDraftKind } from './workspaceDrafts';
import type { WorkspaceScreenActions } from './workspaceScreenActions';

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
}) {
  // 전달받은 값과 행동을 기존 화면 규격으로 표시한다.

  return (
    <TripMoreMenu
      visible={showTripMore}
      owner={owner}
      selected={activeSection}
      disabled={busy || scanning || hasPending}
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
      onClose={() => {
        /* 메뉴를 닫아도 기존 영역을 유지한다. */ return setShowTripMore(false);
      }}
      onSelect={(next) => {
        /* 영역을 선택한 뒤 보조 메뉴만 닫는다. */ return void (setActiveSection(
          next,
        ),
        setShowTripMore(false));
      }}
    />
  );
}

// 일정 추가의 하단 주요 행동을 표시한다.
export function renderWorkspaceAddSchedule({
  busy,
  scanning,
  hasPending,
  actions,
  selectedDay,
}: {
  busy: boolean;
  scanning: boolean;
  hasPending: boolean;
  actions: WorkspaceScreenActions;
  selectedDay: string;
}): import('react').ReactNode {
  // 전달받은 값과 행동을 기존 화면 규격으로 표시한다.

  return (
    <View style={hub.primaryBar} testID="trip-primary-action">
      <View style={hub.primaryButton}>
        <DesignButton
          label="일정 추가"
          variant="primary"
          disabled={busy || scanning || hasPending}
          icon={(color) => {
            // 하단의 유일한 주요 행동에 추가 아이콘을 붙인다.
            return <Ionicons name="add" size={22} color={color} />;
          }}
          onPress={() => {
            // 전체 날짜에서는 기존 규칙대로 첫 날짜의 작성 화면을 연다.
            return actions.startSchedule(selectedDay);
          }}
        />
      </View>
    </View>
  );
}
