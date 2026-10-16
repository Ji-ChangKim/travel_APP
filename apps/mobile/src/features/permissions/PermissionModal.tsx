import Text from '@/components/AppText';
import ActionSheet from '@/components/ActionSheet';
import { colors } from '@/constants/theme';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Action } from '../workspace/ui';
import {
  permissionAction,
  type PermissionKind,
  type PermissionStatus,
} from './permissionModel';
import { usePermissions } from './usePermissions';

// 앱 첫 진입에 알림·위치 두 선택 권한을 한 모달로 안내한다.
export default function PermissionModal() {
  // 운영체제 상태와 모달 수명을 전용 훅에 연결한다.
  const state = usePermissions();
  // 작은 화면과 큰 글자에서도 모든 선택에 접근할 수 있게 스크롤한다.
  return (
    <ActionSheet
      title="여행을 위한 권한 안내"
      visible={state.visible}
      onClose={state.close}
    >
      <Text style={s.copy}>
        필요한 기능을 선택해 주세요. 허용하지 않아도 여행을 계획하고 기록할 수
        있어요.
      </Text>
      <PermissionRow
        kind="notifications"
        status={state.permissions?.notifications}
        busy={state.busy}
        allow={state.allow}
      />
      <PermissionRow
        kind="location"
        status={state.permissions?.location}
        busy={state.busy}
        allow={state.allow}
      />
      {state.message ? (
        <Text accessibilityRole="alert" style={s.message}>
          {state.message}
        </Text>
      ) : null}
      <Action
        label="이대로 시작하기"
        variant="primary"
        disabled={state.busy}
        onPress={state.close}
      />
      <Text style={s.note}>
        나중에 홈의 여행 도구에서 다시 설정할 수 있어요.
      </Text>
    </ActionSheet>
  );
}

// 권한 하나의 사용 목적과 실제 허용 상태를 표시한다.
function PermissionRow({
  kind,
  status,
  busy,
  allow,
}: {
  kind: PermissionKind;
  status?: PermissionStatus;
  busy: boolean;
  allow: (kind: PermissionKind) => unknown;
}) {
  // 이미 허용된 권한은 선택 버튼을 비활성화한다.
  const action = permissionAction(status);
  return (
    <View style={s.row}>
      <View style={s.heading}>
        <Ionicons
          name={
            kind === 'notifications'
              ? 'notifications-outline'
              : 'location-outline'
          }
          size={24}
          color={colors.primary}
        />
        <Text style={s.rowTitle}>
          {kind === 'notifications' ? '알림 · 선택' : '위치 · 선택'}
        </Text>
      </View>
      <Text style={s.copy}>
        {kind === 'notifications'
          ? '여행 출발일 오전 9시에 알림을 받아요.'
          : '현재 위치를 지도에서 볼 때 사용해요. 앱을 사용 중일 때만 위치를 확인해요.'}
      </Text>
      <Action
        label={
          action === 'granted'
            ? '허용됨'
            : action === 'loading'
              ? '상태 확인 다시 시도'
              : action === 'settings'
                ? '기기 설정 열기'
                : '허용하기'
        }
        disabled={busy || action === 'granted'}
        onPress={() => {
          // 선택한 권한 하나만 운영체제 요청으로 전달한다.
          return void allow(kind);
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 430,
    maxHeight: '90%',
    borderRadius: 24,
    backgroundColor: colors.surface,
  },
  content: { padding: 24, gap: 16 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  copy: { fontSize: 14, lineHeight: 21, color: colors.muted },
  row: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    flexShrink: 1,
  },
  note: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.muted,
    textAlign: 'center',
  },
  message: { fontSize: 13, lineHeight: 20, color: colors.selected },
});
