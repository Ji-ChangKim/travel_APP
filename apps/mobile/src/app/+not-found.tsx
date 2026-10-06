import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import HaruState from '@/components/HaruState';
import { Action, styles } from '@/features/workspace/ui';

// 존재하지 않는 주소에서도 서비스의 시작점으로 돌아가도록 안내한다.
export default function NotFoundScreen() {
  // 잘못된 주소를 노출하지 않고 고정된 홈 복귀 행동을 제공한다.
  return <NotFoundContent router={useRouter()} />;
}

// 작은 화면에서도 오류 설명과 홈 버튼을 스크롤할 수 있게 배치한다.
function NotFoundContent({ router }: { router: ReturnType<typeof useRouter> }) {
  // 하루의 길 찾기 안내와 안전한 복귀 버튼을 보여준다.
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { flexGrow: 1, justifyContent: 'center' },
        ]}
      >
        <HaruState
          kind="error"
          title="길을 조금 벗어났어요"
          description="찾는 페이지가 없거나 주소가 바뀌었어요. 홈에서 여행을 이어가 주세요."
        >
          <Action
            label="홈으로 돌아가기"
            variant="primary"
            onPress={() => {
              // 입력을 만들지 않고 여행 홈으로 복귀한다.
              return router.replace('/(tabs)');
            }}
          />
        </HaruState>
      </ScrollView>
    </SafeAreaView>
  );
}
