import Text from '@/components/ui/AppText';
import { colors } from '@/constants/theme';
import { t } from '@/features/localization/translate';
import { Action } from '@/features/workspace/shared/ui/ui';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { styles } from '../styles/myAccountStyles';
import type { MyAccountViewProps } from '../model/myAccountTypes';
// 저장한 계획과 발자국 목록으로 이동하는 메뉴를 표시한다.
export function MyAccountArchiveMenu({
  router,
}: Pick<MyAccountViewProps, 'router'>) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('나의 여행 보관함')}</Text>
      <View style={styles.listCard}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('내 여행 계획 보기')}
          onPress={() => router.push('/(tabs)/plans')}
          style={({ pressed }) => [
            styles.listRow,
            pressed && styles.listRowPressed,
          ]}
        >
          <View style={styles.listIconBox}>
            <Ionicons
              name="calendar-outline"
              size={20}
              color={colors.primary}
            />
          </View>
          <View style={styles.listTextGroup}>
            <Text style={styles.listTitle}>{t('내 여행 계획 보기')}</Text>
            <Text style={styles.listSubtitle}>
              {t('진행 중이거나 예정된 모든 여행 관리')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>
        <View style={styles.listDivider} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('나의 발자국 관리')}
          onPress={() => router.push('/my-footprints')}
          style={({ pressed }) => [
            styles.listRow,
            pressed && styles.listRowPressed,
          ]}
        >
          <View style={styles.listIconBox}>
            <Ionicons
              name="footsteps-outline"
              size={20}
              color={colors.primary}
            />
          </View>
          <View style={styles.listTextGroup}>
            <Text style={styles.listTitle}>{t('나의 발자국 관리')}</Text>
            <Text style={styles.listSubtitle}>
              {t('다녀온 여행 기록과 공유한 일정 모음')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>
      </View>
    </View>
  );
}
// 프로필 저장 중 이동을 막고 설정 화면 진입을 표시한다.
export function MyAccountSettingsMenu({
  router,
  isSavingProfile,
}: Pick<MyAccountViewProps, 'router' | 'isSavingProfile'>) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('환경설정 및 계정')}</Text>
      <View style={styles.listCard}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('설정 열기')}
          disabled={isSavingProfile}
          onPress={() => router.push('/settings')}
          style={({ pressed }) => [
            styles.listRow,
            pressed && styles.listRowPressed,
            isSavingProfile && styles.listRowDisabled,
          ]}
        >
          <View style={styles.listIconBoxNeutral}>
            <Ionicons name="settings-outline" size={20} color={colors.text} />
          </View>
          <View style={styles.listTextGroup}>
            <Text style={styles.listTitle}>{t('설정 열기')}</Text>
            <Text style={styles.listSubtitle}>
              {t('언어 · 앱 정보 (v0.0.1) · 계정 관리')}
            </Text>
          </View>
          <Text style={styles.listValue}>v0.0.1</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>
      </View>
    </View>
  );
}
// 기기 게스트에게 기존 기록의 보관 범위와 계정 연결 진입을 안내한다.
export function MyAccountGuestNotice({
  currentUser,
  router,
}: Pick<MyAccountViewProps, 'currentUser' | 'router'>) {
  return (
    currentUser?.authProvider === 'guest' && (
      <View style={styles.card}>
        <Text style={styles.settingTitle}>
          {t('게스트 여행을 Google 계정에 연결하기')}
        </Text>
        <Text style={styles.settingDesc}>
          {t(
            'Google 계정으로 로그인하면 새 여행을 계정에 안전하게 보관할 수 있어요. 기존 게스트 여행은 이 기기에 유지돼요.',
          )}
        </Text>
        <Action
          label={t('Google 계정 연결하기')}
          variant="primary"
          onPress={() => {
            // 게스트 세션을 유지한 채 실제 계정 인증을 시작한다.
            return router.push('/login');
          }}
        />
      </View>
    )
  );
}
