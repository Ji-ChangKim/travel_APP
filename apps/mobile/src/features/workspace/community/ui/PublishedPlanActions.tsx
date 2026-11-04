import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';
import { View } from 'react-native';
import Text from '@/components/ui/AppText';
import { usePublishedPlanShare } from '../manager/usePublishedPlanShare';
import { Action } from '../../shared/ui/ui';
import { styles } from '../../hub/styles/workspaceStyles';

// 공개본을 보는 행동과 외부로 전달하는 행동을 구분한다.
export default function PublishedPlanActions({
  title,
  postId,
  disabled,
}: {
  title: string;
  postId: string;
  disabled: boolean;
}) {
  useLocale();
  // 동작과 비동기 상태는 기능 훅이 맡고 화면은 공통 버튼·문구를 표시한다.
  const { busy, message, send, copy } = usePublishedPlanShare(
    title,
    postId,
    disabled,
  );
  return (
    <View style={{ gap: 8 }}>
      <Action
        label={t('공유 링크 보내기')}
        disabled={disabled || busy}
        loading={busy}
        onPress={send}
      />
      <Action
        label={t('공유 링크 복사')}
        variant="quiet"
        disabled={disabled || busy}
        onPress={copy}
      />
      <Text style={styles.subtitle}>
        {t(
          '링크를 받은 사람은 공개한 내용만 볼 수 있어요. 함께 편집하려면 동행 메뉴에서 초대해 주세요.',
        )}
      </Text>
      {message ? <Text accessibilityRole="alert">{message}</Text> : null}
    </View>
  );
}
