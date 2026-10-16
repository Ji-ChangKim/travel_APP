import { useState } from 'react';
import { View } from 'react-native';
import Text from '@/components/AppText';
import ActionSheet from '@/components/ActionSheet';
import { Action, styles } from './ui';

// 개인 기록의 정리 완료와 커뮤니티 게시를 별도 행동으로 연결한다.
export default function PublishReadiness({
  disabled,
  onComplete,
}: {
  disabled: boolean;
  onComplete: () => void;
}) {
  // 완료 확인을 취소하거나 화면을 닫으면 원본 상태를 바꾸지 않는다.
  const [confirm, setConfirm] = useState(false);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>기록을 정리한 뒤 공개할 내용을 골라요</Text>
      <Text style={styles.subtitle}>
        여행 날짜가 지났어도 공개는 직접 선택해요. 기록 정리를 마치면
        일정·사진·비용 중 공개할 내용을 고를 수 있어요.
      </Text>
      <Action
        label="기록 정리 마치기"
        variant="primary"
        disabled={disabled}
        onPress={() => {
          // 날짜 경과만으로 저장 상태나 공개 여부를 바꾸지 않는다.
          return setConfirm(true);
        }}
      />
      <ActionSheet
        visible={confirm}
        title="기록 정리를 마칠까요?"
        onClose={() => {
          // 시스템 뒤로도 개인 기록을 그대로 유지한다.
          return setConfirm(false);
        }}
      >
        <Text style={styles.subtitle}>
          개인 기록은 계속 수정할 수 있어요. 이 단계에서는 게시하지 않아요. 완료
          후 ‘공개 내용 작성’에서 공개할 내용을 선택해 주세요.
        </Text>
        <Action
          label="계속 정리하기"
          onPress={() => {
            // 확인하지 않은 정리 완료는 저장하지 않는다.
            return setConfirm(false);
          }}
        />
        <Action
          label="기록 정리 완료"
          variant="primary"
          disabled={disabled}
          onPress={() => {
            // 사용자가 확인한 경우에만 기존 여행 상태 저장을 실행한다.
            return void (setConfirm(false), onComplete());
          }}
        />
      </ActionSheet>
    </View>
  );
}
