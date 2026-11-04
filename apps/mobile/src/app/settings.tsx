import { useLocale } from '@/features/localization/localeState';
import SettingsScreenView from '@/features/profile/SettingsScreenView';
import { useSettingsController } from '@/features/profile/useSettingsController';

// 설정 경로를 계정별 상태와 표현 모듈에 연결한다.
export default function SettingsScreen() {
  useLocale();
  return <SettingsScreenView {...useSettingsController()} />;
}
