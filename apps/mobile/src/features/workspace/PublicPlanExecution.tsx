import { View } from 'react-native';
import DesignButton from '@/components/DesignButton';
import Text from '@/components/AppText';
import CommunityImportButton from './CommunityImportButton';
import { usePublishedPlanShare } from './usePublishedPlanShare';
import { timelinePlanStyles } from './timelinePlanStyles';

// 공개 계획의 담기와 외부 공유를 실제 저장·기기 기능에 연결한다.
export default function PublicPlanExecution({
  title,
  postId,
}: {
  title: string;
  postId: string;
}) {
  // 함께 편집하는 초대를 만들지 않고 선택 공개본만 전달한다.
  const share = usePublishedPlanShare(title, postId, false);
  return (
    <View style={timelinePlanStyles.publicExecutionBar}>
      <View style={timelinePlanStyles.publicAction}>
        <DesignButton
          label="링크 공유"
          accessibilityLabel="공유 링크 보내기"
          disabled={share.busy}
          loading={share.busy}
          onPress={share.send}
        />
      </View>
      <CommunityImportButton
        postId={postId}
        renderTrigger={(open, saved) => {
          // 기존 담기 시트가 가진 멱등 저장과 로그인 복귀를 그대로 사용한다.
          return (
            <View style={timelinePlanStyles.publicAction}>
              <DesignButton
                label={saved ? '담은 일정 열기' : '내 여행에 담기'}
                accessibilityLabel={
                  saved ? '담은 일정 열기' : '내 여행으로 일정 담기'
                }
                variant="primary"
                onPress={open}
              />
            </View>
          );
        }}
      />
      {share.message ? (
        <Text accessibilityRole="alert">{share.message}</Text>
      ) : null}
    </View>
  );
}
