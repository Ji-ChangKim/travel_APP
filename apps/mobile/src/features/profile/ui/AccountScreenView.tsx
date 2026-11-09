import ScreenHeader from '@/components/navigation/ScreenHeader';
import { t } from '@/features/localization/translate';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AccountConnectionCard from './AccountConnectionCard';
import AccountRetirementConfirmation from './AccountRetirementConfirmation';
import AccountRetirementSection from './AccountRetirementSections';
import { styles } from '../styles/myAccountStyles';
import type { AccountRetirementController } from '../manager/useAccountRetirement';

// 공통 헤더 아래에 현재 이용 방식과 삭제 전 확인을 배치한다.
export default function AccountScreenView(props: AccountRetirementController) {
  const { user, router, busy, completed } = props;
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <ScreenHeader
        title={t('계정 관리')}
        backLabel={t(
          user && !completed ? '설정으로 돌아가기' : '로그인으로 돌아가기',
        )}
        disabled={busy}
        onBack={() => {
          if (!busy)
            router.replace(user && !completed ? '/settings' : '/login');
        }}
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {!completed ? (
          <AccountConnectionCard user={user} management={props.management} />
        ) : null}
        <AccountRetirementSection {...props} />
      </ScrollView>
      <AccountRetirementConfirmation {...props} />
    </SafeAreaView>
  );
}
