import ScreenHeader from '@/components/ScreenHeader';
import ModalBackground from '@/features/accessibility/ModalBackground';
import { t } from '@/features/localization/translate';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LogoutConfirmation from './LogoutConfirmation';
import { styles } from './myAccountStyles';
import {
  SettingsAccountSection,
  SettingsAppInfo,
  SettingsManagementSection,
  SettingsPreferencesSection,
} from './SettingsSections';
import type { SettingsController } from './useSettingsController';
// 설정의 공통 헤더와 기능별 섹션, 로그아웃 확인을 배치한다.
export default function SettingsScreenView(props: SettingsController) {
  const {
    router,
    logoutOpen,
    logoutBusy,
    logoutError,
    isGuest,
    closeLogout,
    confirmLogout,
  } = props;
  return (
    <SafeAreaView style={styles.screen}>
      <ModalBackground>
        <ScreenHeader
          title={t('설정')}
          backLabel={t('MY로 돌아가기')}
          disabled={logoutBusy}
          onBack={() => {
            // 프로필(MY) 탭으로 안전하게 복귀한다.
            return logoutBusy ? undefined : router.replace('/(tabs)/my');
          }}
        />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <SettingsAccountSection {...props} />

          <SettingsPreferencesSection {...props} />

          <SettingsAppInfo />

          <SettingsManagementSection {...props} />
        </ScrollView>
      </ModalBackground>

      <LogoutConfirmation
        visible={logoutOpen}
        busy={logoutBusy}
        error={logoutError}
        description={
          isGuest
            ? t(
                '게스트 계정을 로그아웃해도 이 기기에 저장된 여행 기록은 유지돼요.',
              )
            : t(
                '계정에 저장한 여행은 같은 Google 계정으로 다시 로그인하면 언제든 볼 수 있어요.',
              )
        }
        onCancel={closeLogout}
        onConfirm={confirmLogout}
      />
    </SafeAreaView>
  );
}
