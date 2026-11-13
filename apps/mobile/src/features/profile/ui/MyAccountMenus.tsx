import { useState } from 'react';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import Text from '@/components/ui/AppText';
import ActionSheet from '@/components/ui/ActionSheet';
import { colors } from '@/constants/theme';
import { t } from '@/features/localization/translate';
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

// 환경설정 및 계정(앱 버전 정보) 리스트 카드를 표시한다.
export function MyAccountSettingsMenu(
  _props: Pick<MyAccountViewProps, 'router'>,
) {
  const [versionOpen, setVersionOpen] = useState(false);
  const appVersion = Constants.expoConfig?.version || '0.0.2';

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('환경설정 및 계정')}</Text>
      <View style={styles.listCard}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('앱 버전 정보')}
          onPress={() => setVersionOpen(true)}
          style={({ pressed }) => [
            styles.listRow,
            pressed && styles.listRowPressed,
          ]}
        >
          <View style={styles.softBlueIconBox}>
            <Ionicons
              name="information-circle-outline"
              size={20}
              color="#0F172A"
            />
          </View>
          <View style={styles.listTextGroup}>
            <Text style={styles.listTitle}>{t('앱 버전 정보')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>
      </View>

      <ActionSheet
        visible={versionOpen}
        title={t('앱 버전 정보')}
        onClose={() => setVersionOpen(false)}
      >
        <View style={styles.accountActions}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('현재 버전')}</Text>
            <Text style={styles.infoValue}>{`v${appVersion}`}</Text>
          </View>
          <Text style={styles.settingDesc}>
            TripPrint Native App · {`v${appVersion}`}
          </Text>
        </View>
      </ActionSheet>
    </View>
  );
}

// 3. 계정 연동 카드(게스트일 경우 Google 계정 연결 버튼 / Google 회원일 경우 연동 상태)를 표시한다.
export function MyAccountGuestNotice({
  currentUser,
  router,
}: Pick<MyAccountViewProps, 'currentUser' | 'router'>) {
  if (currentUser?.authProvider === 'guest') {
    return (
      <View style={styles.guestConnectCard}>
        <View style={styles.guestConnectTopRow}>
          <View style={styles.googleLogoBox} aria-hidden>
            <Ionicons name="logo-google" size={22} color="#EA4335" />
          </View>
          <View style={styles.listTextGroup}>
            <Text style={styles.guestConnectTitle}>
              {t('게스트 여행을 Google 계정에 연결하기')}
            </Text>
            <Text style={styles.listSubtitle}>
              {t(
                '지금 만든 여행은 이 기기에 저장돼요. Google 계정을 연결하면 기기를 바꿔도 이어보고, 동행자 초대·커뮤니티 공개를 바로 쓸 수 있어요.',
              )}
            </Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Google 계정 연결')}
          onPress={() => {
            // 로그인 화면으로 이동해 Google 계정 연결을 시작한다.
            return router.push('/login');
          }}
          style={({ pressed }) => [
            styles.googleConnectBtn,
            pressed && styles.listRowPressed,
          ]}
        >
          <Text style={styles.googleConnectBtnText}>
            {t('Google 계정 연결')}
          </Text>
        </Pressable>
      </View>
    );
  }

  if (currentUser?.authProvider === 'google') {
    return (
      <View style={styles.guestConnectCard}>
        <View style={styles.guestConnectTopRow}>
          <View style={styles.googleLogoBox} aria-hidden>
            <Ionicons name="logo-google" size={22} color="#EA4335" />
          </View>
          <View style={styles.listTextGroup}>
            <Text style={styles.listTitle}>{t('Google 계정 연결됨')}</Text>
            <Text style={styles.listSubtitle}>
              {t('계정에 저장한 여행과 기록을 확인해요.')}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return null;
}
