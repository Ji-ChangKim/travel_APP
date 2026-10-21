import { View } from 'react-native';
import Text from '@/components/AppText';
import { usePublishedPlanShare } from './usePublishedPlanShare';
import { Action } from './ui';
import { styles } from './workspaceStyles';

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
  // 동작과 비동기 상태는 기능 훅이 맡고 화면은 공통 버튼·문구를 표시한다.
  const { busy, message, send } = usePublishedPlanShare(
    title,
    postId,
    disabled,
  );
  return (
    <View style={{ gap: 8 }}>
      <Action
        label="공유 링크 보내기"
        disabled={disabled || busy}
        loading={busy}
        onPress={send}
      />
      <Text style={styles.subtitle}>
        링크를 받은 사람은 공개한 내용만 볼 수 있어요. 함께 편집하려면 동행
        메뉴에서 초대해 주세요.
      </Text>
      {message ? <Text accessibilityRole="alert">{message}</Text> : null}
    </View>
  );
}
