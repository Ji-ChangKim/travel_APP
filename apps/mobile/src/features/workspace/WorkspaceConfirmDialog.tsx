import Text from '@/components/AppText';
import ActionSheet from '@/components/ActionSheet';
import { Action, ServerPhoto, styles } from './ui';
import type { WorkspaceConfirmation } from './workspaceConfirmation';

// 실제 삭제 요청 전에 고정된 대상과 영향을 확인한다.
export default function WorkspaceConfirmDialog({
  confirmation,
  userId,
  onConfirm,
  onCancel,
}: {
  confirmation: WorkspaceConfirmation | null;
  userId: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  // 취소·시스템 뒤로는 명령을 보내지 않고 확인 화면만 닫는다.
  return (
    <ActionSheet
      visible={Boolean(confirmation)}
      title={confirmation?.title || '여행 내용 확인'}
      onClose={onCancel}
    >
      {confirmation && (
        <>
          <Text style={styles.subtitle}>{confirmation.message}</Text>
          {confirmation.command.operation === 'media.delete' && (
            <ServerPhoto
              userId={userId}
              tripId={confirmation.tripId}
              mediaId={confirmation.command.input.id}
            />
          )}
          <Action label="취소" onPress={onCancel} />
          <Action
            label={confirmation.label}
            variant="danger"
            onPress={onConfirm}
          />
        </>
      )}
    </ActionSheet>
  );
}
