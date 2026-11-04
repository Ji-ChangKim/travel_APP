import ActionSheet from '@/components/ui/ActionSheet';
import Text from '@/components/ui/AppText';
import { colors } from '@/constants/theme';
import { useLocale } from '@/features/localization/localeState';
import { t } from '@/features/localization/translate';
import { Action } from '@/features/workspace/shared/ui/ui';

type Props = {
  visible: boolean;
  busy: boolean;
  error: string;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
};

// 로그아웃 확인의 표시만 맡고 실제 세션 종료와 요청 잠금은 호출자가 소유한다.
export default function LogoutConfirmation({
  visible,
  busy,
  error,
  description,
  onCancel,
  onConfirm,
}: Props) {
  useLocale();
  return (
    <ActionSheet
      variant="confirm"
      visible={visible}
      title={t('로그아웃할까요?')}
      dismissDisabled={busy}
      onClose={onCancel}
    >
      <Text>{description}</Text>
      {error ? (
        <Text accessibilityRole="alert" style={{ color: colors.danger }}>
          {t(error)}
        </Text>
      ) : null}
      <Action label={t('계속 이용하기')} disabled={busy} onPress={onCancel} />
      <Action
        label={busy ? t('로그아웃 중…') : t('로그아웃')}
        variant="primary"
        loading={busy}
        onPress={onConfirm}
      />
    </ActionSheet>
  );
}
