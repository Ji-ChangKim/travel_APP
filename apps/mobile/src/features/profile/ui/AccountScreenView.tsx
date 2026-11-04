import ScreenHeader from '@/components/navigation/ScreenHeader';
import { t } from '@/features/localization/translate';
import { styles } from '@/features/workspace/hub/styles/workspaceStyles';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AccountConnectionCard from './AccountConnectionCard';
import AccountRetirementConfirmation from './AccountRetirementConfirmation';
import AccountRetirementSection from './AccountRetirementSections';
import { styles as accountStyles } from '../styles/myAccountStyles';
import type { AccountRetirementController } from '../manager/useAccountRetirement';
// 계정 관리의 공통 헤더와 연결 계정·탈퇴 안내·확인 창을 배치한다.
export default function AccountScreenView(props: AccountRetirementController) {
  const { user, router, busy } = props;
  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader
        title={t('계정 관리')}
        backLabel={user ? t('설정으로 돌아가기') : t('로그인으로 돌아가기')}
        disabled={busy}
        onBack={() => {
          // 처리 중에는 계정 변경 요청을 중간에 다시 시작하지 않는다.
          return busy
            ? undefined
            : router.replace(user ? '/settings' : '/login');
        }}
      />
      <ScrollView contentContainerStyle={accountStyles.scrollContent}>
        <AccountConnectionCard user={user} />
        <AccountRetirementSection {...props} />
      </ScrollView>
      <AccountRetirementConfirmation {...props} />
    </SafeAreaView>
  );
}
