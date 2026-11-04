import Text from '@/components/AppText';
import { colors } from '@/constants/theme';
import LanguagePicker from '@/features/localization/LanguagePicker';
import { t } from '@/features/localization/translate';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { styles } from './myAccountStyles';
import type { SettingsController } from './useSettingsController';

// 현재 계정과 게스트의 계정 연결 진입을 표시한다.
export function SettingsAccountSection({
  isGuest,
  currentUser,
  router,
}: Pick<SettingsController, 'isGuest' | 'currentUser' | 'router'>) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('계정 정보')}</Text>
      <View style={styles.listCard}>
        <View style={styles.listRow}>
          <View style={styles.listIconBox}>
            <Ionicons name="person-outline" size={20} color={colors.primary} />
          </View>
          <View style={styles.listTextGroup}>
            <Text style={styles.listTitle}>{t('현재 닉네임')}</Text>
            <Text style={styles.listSubtitle}>
              {isGuest ? t('게스트 (이 기기에만 저장)') : t('Google 계정')}
            </Text>
          </View>
          <Text style={styles.listValue}>
            {currentUser?.nickname || t('여행자')}
          </Text>
        </View>
        {isGuest ? (
          <>
            <View style={styles.listDivider} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('Google 계정 연결 / 전환하기')}
              onPress={() => router.push('/login')}
              style={({ pressed }) => [
                styles.listRow,
                pressed && styles.listRowPressed,
              ]}
            >
              <View style={styles.listIconBox}>
                <Ionicons name="logo-google" size={18} color={colors.primary} />
              </View>
              <View style={styles.listTextGroup}>
                <Text style={styles.listTitle}>
                  {t('Google 계정 연결 / 전환하기')}
                </Text>
                <Text style={styles.listSubtitle}>
                  {t('클라우드에 여행을 안전하게 보관해요')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          </>
        ) : null}
      </View>
    </View>
  );
}

// 언어 선택과 이 기기의 이전 기록 진입을 표시한다.
export function SettingsPreferencesSection({
  trips,
  visits,
  router,
}: Pick<SettingsController, 'trips' | 'visits' | 'router'>) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('앱 환경설정')}</Text>
      <LanguagePicker />
      {(trips.length > 0 || visits.length > 0) && (
        <View style={[styles.listCard, { marginTop: 10 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('이 기기에 저장한 이전 기록 보기')}
            onPress={() => router.push('/local-records')}
            style={({ pressed }) => [
              styles.listRow,
              pressed && styles.listRowPressed,
            ]}
          >
            <View style={styles.listIconBoxNeutral}>
              <Ionicons
                name="phone-portrait-outline"
                size={20}
                color={colors.text}
              />
            </View>
            <View style={styles.listTextGroup}>
              <Text style={styles.listTitle}>
                {t('이 기기에 저장한 이전 기록 보기')}
              </Text>
              <Text style={styles.listSubtitle}>
                {t('로컬에 남아 있는 여행과 방문 기록 확인')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

// 앱 정보 카드를 기존 표시 규격으로 구성한다.
export function SettingsAppInfo() {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('앱 정보')}</Text>
      <View style={styles.listCard}>
        <View style={styles.listRow}>
          <View style={styles.listIconBoxNeutral}>
            <Ionicons
              name="information-circle-outline"
              size={20}
              color={colors.text}
            />
          </View>
          <View style={styles.listTextGroup}>
            <Text style={styles.listTitle}>{t('앱 버전')}</Text>
            <Text style={styles.listSubtitle}>TripPrint Native App</Text>
          </View>
          <Text style={styles.listValue}>v0.0.1 (Build 14)</Text>
        </View>
      </View>
    </View>
  );
}

// 계정 관리와 로그아웃 확인 진입을 표시한다.
export function SettingsManagementSection({
  isGuest,
  logoutBusy,
  router,
  handleLogout,
}: Pick<
  SettingsController,
  'isGuest' | 'logoutBusy' | 'router' | 'handleLogout'
>) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('계정 관리')}</Text>
      <View style={styles.listCard}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('회원 탈퇴 및 데이터 보관 안내')}
          disabled={logoutBusy}
          onPress={() => router.push('/account')}
          style={({ pressed }) => [
            styles.listRow,
            pressed && styles.listRowPressed,
            logoutBusy && styles.listRowDisabled,
          ]}
        >
          <View style={styles.listIconBoxNeutral}>
            <Ionicons
              name="shield-checkmark-outline"
              size={20}
              color={colors.text}
            />
          </View>
          <View style={styles.listTextGroup}>
            <Text style={styles.listTitle}>
              {t('회원 탈퇴 및 데이터 보관 안내')}
            </Text>
            <Text style={styles.listSubtitle}>
              {t('90일 유예 정책 및 여행 데이터 보존 안내')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>
        <View style={styles.listDivider} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('로그아웃')}
          disabled={logoutBusy}
          onPress={handleLogout}
          style={({ pressed }) => [
            styles.listRow,
            pressed && styles.listRowPressed,
            logoutBusy && styles.listRowDisabled,
          ]}
        >
          <View style={styles.listIconBoxDanger}>
            <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          </View>
          <View style={styles.listTextGroup}>
            <Text style={styles.listTitleDanger}>{t('로그아웃')}</Text>
            <Text style={styles.listSubtitle}>
              {isGuest
                ? t('현재 기기의 게스트 세션을 종료해요')
                : t('현재 연결된 Google 계정에서 로그아웃해요')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.danger} />
        </Pressable>
      </View>
    </View>
  );
}
