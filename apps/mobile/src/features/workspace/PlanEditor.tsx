import Modal from '@/components/AppModal';
import type { WorkspaceSnapshot } from '@wherego/domain';
import { useRef, type RefObject } from 'react';
import { ScrollView } from 'react-native';
import { renderPlanEditor } from './PlanEditorView';
import PublishFlow from './PublishFlow';
import { Action } from './ui';

import { FormFeedback } from './InputFeedback';
import { LedgerAction, useLedgerWide } from './LedgerUI';
import ScheduleEditor from './ScheduleEditor';
import DestinationEditor from './DestinationEditor';
import TripPlanningFlow from './TripPlanningFlow';
import { type FieldErrors, type FormFeedbackState } from './formFeedback';
import type { PlanForm } from './forms';
import { tripPeriodImpact } from './tripPeriod';
// 폼이 닫혀도 전환이 끝날 때까지 마지막 작성 내용을 보존한다.
export default function PlanEditor(props: EditorProps) {
  // 입력 참조는 폼이 바뀌어도 현재 스크롤에 연결한다.
  const scroll = useRef<ScrollView>(null);
  const publishBack = useRef<(() => void) | null>(null);
  const content = (
    <EditorScope
      key={props.form?.id || 'closed'}
      {...props}
      scroll={scroll}
      publishBack={publishBack}
    />
  );
  // 여행 생성은 페이지 전환을 사용하고 편집은 공통 모달 수명을 사용한다.
  return props.form?.kind === 'trip' ? (
    content
  ) : (
    <Modal
      visible={Boolean(props.form)}
      accessibilityLabel={editorLabel(props.form)}
      animationType="slide"
      onRequestClose={() => {
        // 공개 미리보기의 시스템 뒤로는 선택 단계로 먼저 돌아간다.
        return props.form?.kind === 'publish' && publishBack.current
          ? publishBack.current()
          : props.onClose();
      }}
    >
      {content}
    </Modal>
  );
}

// 폼 종류가 바뀌면 화면 읽기 이름도 현재 작성 내용으로 갱신한다.
function editorLabel(form: PlanForm | null): string {
  // 로그인·출처 창과 편집 내용을 읽기 이름으로 구분한다.
  return (
    (
      {
        schedule: '일정 작성',
        receipt: '영수증 확인',
        publish: '여행 공유',
        metadata: '여행 정보 수정',
        period: '여행 기간 변경',
        dayPlan: '이날 여행계획',
        expense: '비용 작성',
      } as Record<string, string>
    )[form?.kind || ''] || '여행 내용 작성'
  );
}

// 폼 전체에 오류 이동과 저장 중 입력 잠금을 적용한다.
function EditorScope(
  props: EditorProps & { scroll: RefObject<ScrollView | null> },
) {
  // 일정 전용 모달도 같은 저장 상태와 검증 결과를 사용한다.
  return (
    <FormFeedback
      locked={props.locked}
      feedback={props.feedback}
      scroll={props.scroll}
    >
      {props.form?.kind === 'trip' ? (
        <TripPlanningFlow {...props} form={props.form} />
      ) : (
        <PlanEditorContent {...props} />
      )}
    </FormFeedback>
  );
}

type EditorProps = {
  publishBack?: RefObject<(() => void) | null>;
  userId: string;
  form: PlanForm | null;
  snapshot?: WorkspaceSnapshot;
  busy: boolean;
  locked: boolean;
  feedback: FormFeedbackState;
  onInvalid: (fields: FieldErrors) => void;
  error: string;
  conflicted?: boolean;
  onChange: (key: string, value: string) => void;
  onSave: () => void;
  onReload: () => void;
  onClose: () => void;
  onReceipt: (camera: boolean) => void;
  onRescan: () => void;
};

// 명령 종류별 작성 화면을 같은 입력 계약으로 연결한다.
function PlanEditorContent({
  userId,
  form,
  snapshot,
  busy,
  error,
  conflicted = false,
  onChange,
  onSave,
  onReload,
  onClose,
  onReceipt,
  onRescan,
  locked,
  scroll,
  publishBack,
}: EditorProps & { scroll: RefObject<ScrollView | null> }) {
  // 아니요 선택 시 수정할 정보를 화면 위에서 바로 확인할 수 있게 한다.
  const receiptScroll = scroll;
  const wide = useLedgerWide();
  const SaveAction = form?.kind === 'receipt' ? LedgerAction : Action;
  const periodImpact =
    form?.kind === 'period' && snapshot
      ? tripPeriodImpact(snapshot, form.values)
      : null;
  // 선택값을 반영한 다음 수정 화면의 시작으로 이동한다.
  function chooseReceiptValue(key: string, value: string) {
    // 사진 선택은 위치를 유지하고 정보 수정 선택만 위로 이동한다.
    return Promise.resolve(onChange(key, value)).then(() => {
      // 새 입력 필드가 배치된 프레임에서 이동한다.
      return key === 'receiptConfirmed' && value === 'false'
        ? requestAnimationFrame(() => {
            // 잘못 인식된 항목의 확인·수정 영역으로 돌아간다.
            return receiptScroll.current?.scrollTo({ y: 0, animated: true });
          })
        : undefined;
    });
  }
  // 실패해도 같은 폼 입력값과 원본을 유지한다.
  if (form?.kind === 'publish' && snapshot)
    return (
      <PublishFlow
        form={form}
        snapshot={snapshot}
        userId={userId}
        locked={locked}
        busy={busy}
        error={error}
        conflicted={conflicted}
        onReload={onReload}
        scroll={scroll}
        backActionRef={publishBack}
        onChange={onChange}
        onSave={onSave}
        onClose={onClose}
      />
    );
  if (form?.kind === 'destinations' && snapshot)
    return (
      <DestinationEditor
        form={form}
        snapshot={snapshot}
        locked={locked}
        busy={busy}
        error={error}
        onChange={onChange}
        onSave={onSave}
        onClose={onClose}
        conflicted={conflicted}
        onReload={onReload}
      />
    );
  if (form?.kind === 'schedule' && snapshot)
    return (
      <ScheduleEditor
        userId={userId}
        form={form}
        snapshot={snapshot}
        busy={busy}
        locked={locked}
        scroll={scroll}
        error={error}
        onChange={onChange}
        onSave={onSave}
        onReload={onReload}
        onClose={onClose}
        onReceipt={onReceipt}
      />
    );
  return renderPlanEditor({
    form,
    onClose,
    busy,
    locked,
    receiptScroll,
    wide,
    snapshot,
    userId,
    onChange,
    onRescan,
    onReceipt,
    chooseReceiptValue,
    periodImpact,
    error,
    conflicted,
    SaveAction,
    onSave,
    onReload,
  });
}
