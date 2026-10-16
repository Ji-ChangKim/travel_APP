import { Platform } from 'react-native';
import PermissionModal from '../permissions/PermissionModal';
import ReminderBridge from './ReminderBridge';

// 네이티브 앱에서 선택 권한 안내와 실제 여행 알림을 연결한다.
export default function NotificationPermission() {
  // 웹에는 운영체제 권한 안내를 표시하지 않는다.
  return Platform.OS === 'web' ? null : (
    <>
      <ReminderBridge />
      <PermissionModal />
    </>
  );
}
