import ActionSheet from '@/components/ui/ActionSheet';
import Text from '@/components/ui/AppText';
import { t } from '@/features/localization/translate';
import { Action } from '@/features/workspace/shared/ui/ui';
import type { AccountRetirementController } from '../manager/useAccountRetirement';

// 사용자가 읽은 대상과 계정에 대해서만 소유권 이전 또는 삭제를 확정한다.
export default function AccountRetirementConfirmation({
  confirming,
  busy,
  cancelConfirmation,
  confirmRequest,
}: Pick<
  AccountRetirementController,
  'confirming' | 'busy' | 'cancelConfirmation' | 'confirmRequest'
>) {
  const transfer = confirming?.kind === 'transfer' ? confirming : null;
  return (
    <ActionSheet
      variant="confirm"
      title={t(transfer ? '소유권을 이전할까요?' : '계정 삭제를 요청할까요?')}
      visible={Boolean(confirming)}
      dismissDisabled={busy}
      onClose={cancelConfirmation}
    >
      <Text>
        {transfer
          ? t(
              '‘{trip}’의 소유권을 ‘{name}’에게 넘겨요. 나는 편집자로 남고, 새 소유자가 여행을 관리해요.',
              { trip: transfer.tripTitle, name: transfer.name },
            )
          : t(
              '모든 기기에서 로그아웃하고 계정과 개인 기록을 삭제해요. 삭제를 요청하면 취소하거나 복구할 수 없어요.',
            )}
      </Text>
      <Action
        label={t('계속 이용하기')}
        disabled={busy}
        onPress={cancelConfirmation}
      />
      <Action
        label={t(
          busy ? '요청 중…' : transfer ? '소유권 이전하기' : '계정 삭제 요청',
        )}
        variant="destructive"
        disabled={busy}
        loading={busy}
        onPress={confirmRequest}
      />
    </ActionSheet>
  );
}
