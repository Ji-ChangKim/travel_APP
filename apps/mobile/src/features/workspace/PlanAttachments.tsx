import { View } from 'react-native';
import type { CommunityPost } from '@wherego/domain';
import Text from '@/components/AppText';
import CommunityPhoto from './CommunityPhoto';
import ServerPhoto from './ServerPhoto';
import { ledgerStyles } from './ledgerTheme';

// 미리보기와 실제 공개본에서 같은 선택 사진·통화별 합계를 표시한다.
export default function PlanAttachments({
  snapshot,
  photoPaths = [],
  preview,
}: {
  snapshot: CommunityPost['snapshot'];
  photoPaths?: string[];
  preview?: { tripId: string; userId: string; mediaIds: string[] };
}) {
  // 공개 전 사진은 회원 권한으로, 공개 후 사진은 공개 사본의 경로로만 읽는다.
  return (
    <View style={ledgerStyles.content}>
      {(preview ? preview.mediaIds.length : photoPaths.length) > 0 && (
        <Text style={ledgerStyles.section}>여행 사진</Text>
      )}
      {preview
        ? preview.mediaIds.map((id) => {
            // 영수증 사진은 공개 선택 단계에서 이미 제외한 ID만 사용한다.
            return (
              <ServerPhoto
                key={id}
                userId={preview.userId}
                tripId={preview.tripId}
                mediaId={id}
              />
            );
          })
        : photoPaths.map((path) => {
            // 공개 API가 반환한 사진 이외의 원본을 대신 조회하지 않는다.
            return <CommunityPhoto key={path} path={path} />;
          })}
      {Object.entries(snapshot.costs).map(([currency, amount]) => {
        // 환율을 가정하지 않고 공개하기로 한 통화별 합계만 표시한다.
        return (
          <Text key={currency} style={ledgerStyles.body}>
            실제 지출 · {amount} {currency}
          </Text>
        );
      })}
    </View>
  );
}
