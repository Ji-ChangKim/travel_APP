import Constants from 'expo-constants';
import { Platform } from 'react-native';
import CenteredNoticeModal from '@/components/CenteredNoticeModal';
import DesignButton from '@/components/DesignButton';
import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';
import type { useStartupController } from '../manager/useStartupController';
import { logPlayStoreClick } from '../manager/playStoreAction';
import StartupUpdateNotice from './StartupUpdateNotice';

// 시작을 막는 실패만 팝업으로 표시하고 처리 중 안내는 원래 화면에서 유지한다.
export default function StartupFailureNotice({ visible, controller }: { visible: boolean; controller: ReturnType<typeof useStartupController> }) {
  useLocale();
  const blockedUpdate = controller.updateAvailable;
  const local = controller.failure === 'local';
  const auth = controller.failure === 'auth';
  const update = controller.failure === 'incompatible' || local;
  return blockedUpdate ? (
    <StartupUpdateNotice visible={visible} decision={controller.decision} currentVersion={controller.installedVersion || Constants.expoConfig?.version} busy={controller.pending} onRetry={controller.retryUpdate} onContinue={controller.acceptUpdate} />
  ) : (
    <CenteredNoticeModal
      visible={visible && Boolean(controller.error)}
      title={t(auth ? '로그인 정보 확인 안내' : update ? '앱 업데이트 안내' : '여행 시작 안내')}
      paragraphs={local
        ? [t('이 기기의 여행 기록을 열지 못했어요.'), t('기록을 지우지 말고 앱을 업데이트한 뒤 다시 시도해 주세요.')]
        : auth
          ? [t('로그인 정보를 확인하지 못했어요.'), t('연결을 확인하고 다시 시도해 주세요.')]
          : update
            ? [t('새로운 여행을 이어가려면 업데이트가 필요해요.'), t('새 버전으로 업데이트한 뒤 다시 시도해 주세요.')]
            : [t('여행을 준비하지 못했어요.'), t('연결을 확인하고 다시 시도해 주세요.')]}
    >
      <DesignButton label={t('다시 시도')} variant="primary" disabled={controller.pending} loading={controller.pending} onPress={controller.retry} />
      {controller.canLogin && <DesignButton label={t('로그인으로 이동')} onPress={controller.login} disabled={controller.pending} />}
      {update && Platform.OS === 'android' && <DesignButton label={t('Google Play 스토어로 이동')} onPress={logPlayStoreClick} disabled={controller.pending} />}
    </CenteredNoticeModal>
  );
}
