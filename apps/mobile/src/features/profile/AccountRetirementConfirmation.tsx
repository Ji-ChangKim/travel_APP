import ActionSheet from '@/components/ActionSheet';
import Text from '@/components/AppText';
import { t } from '@/features/localization/translate';
import { Action } from '@/features/workspace/ui';
import type { AccountRetirementController } from './useAccountRetirement';
// 보존 범위를 확인한 계정의 탈퇴 유예 시작만 확정한다.
export default function AccountRetirementConfirmation({
  confirming,
  userId,
  setConfirming,
  retire,
}: Pick<
  AccountRetirementController,
  'confirming' | 'userId' | 'setConfirming' | 'retire'
>) {
  return (
    <ActionSheet
      variant="confirm"
      title={t('탈퇴 유예를 시작할까요?')}
      visible={Boolean(confirming && confirming === userId)}
      onClose={() => {
        // 취소는 서버 상태와 계정 연결을 유지한다.
        return setConfirming('');
      }}
    >
      <Text>
        {t(
          '지금 로그아웃돼요. 90일 안에 다시 로그인하면 취소할 수 있어요. 여행·사진·영수증과 공개본은 계정과 분리해 보관해요.',
        )}
      </Text>
      <Action
        label={t('계속 이용하기')}
        onPress={() => {
          // 안전한 선택은 원래 계정 화면으로 돌아간다.
          return setConfirming('');
        }}
      />
      <Action
        label={t('탈퇴 유예 시작')}
        variant="destructive"
        onPress={retire}
      />
    </ActionSheet>
  );
}
