import { useLocale } from '@/features/localization/localeState';
import AccountScreenView from '@/features/profile/ui/AccountScreenView';
import { useAccountRetirement } from '@/features/profile/manager/useAccountRetirement';
// 계정 관리 경로를 탈퇴 상태와 화면 구성에 연결한다.
export default function AccountScreen() {
  useLocale();
  return <AccountScreenView {...useAccountRetirement()} />;
}
