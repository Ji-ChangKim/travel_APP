import HaruState from '@/components/HaruState';
import type { WorkspaceSnapshot } from '@wherego/domain';
import { LedgerAction as Action } from './LedgerUI';
import { renderReceiptItems, renderReceiptSummary } from './ReceiptReviewView';
import type { PlanForm } from './forms';

// 사진에서 인식한 후보를 먼저 보여주고 틀린 항목만 수정하도록 안내한다.
export default function ReceiptReview({
  form,
  snapshot,
  busy,
  onChange,
  onRetry,
  onPhoto,
}: {
  form: PlanForm;
  snapshot: WorkspaceSnapshot;
  busy: boolean;
  onChange: (key: string, value: string) => void;
  onRetry: () => void;
  onPhoto: () => void;
}) {
  // 인식 대기·실패를 자동 등록 가능한 결과와 구분한다.
  return form.values.receiptStatus === 'loading' ? (
    <HaruState
      kind="loading"
      title="영수증을 읽고 있어요"
      description="장소, 결제 일시, 메뉴와 합계를 찾고 있어요."
    />
  ) : form.values.receiptStatus === 'error' ? (
    <HaruState
      kind="error"
      title="영수증을 읽지 못했어요"
      description={
        form.values.receiptError ||
        '글자가 선명하게 보이도록 촬영해 주세요. 원본 사진은 보관되어 있어요.'
      }
    >
      <Action
        label="다시 스캔하기"
        disabled={busy}
        variant="primary"
        onPress={onRetry}
      />
      <Action label="다른 영수증 사진 선택" disabled={busy} onPress={onPhoto} />
      <Action
        label="직접 입력으로 계속"
        disabled={busy}
        variant="quiet"
        onPress={() => {
          // 사용자가 선택한 경우에만 수동 입력을 제공한다.
          return onChange('receiptStatus', 'manual');
        }}
      />
    </HaruState>
  ) : (
    <>
      {renderReceiptSummary({ form, snapshot, busy, onChange, onRetry })}
      {renderReceiptItems({ form, onChange })}
    </>
  );
}
