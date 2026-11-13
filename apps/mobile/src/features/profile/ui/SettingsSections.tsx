import { useState } from 'react';
import Text from '@/components/ui/AppText';
import ActionSheet from '@/components/ui/ActionSheet';
import { colors } from '@/constants/theme';
import LanguagePicker from '@/features/localization/LanguagePicker';
import { t } from '@/features/localization/translate';
import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, View } from 'react-native';
import DesignButton from '@/components/ui/DesignButton';
import { styles } from '../styles/myAccountStyles';
import type { SettingsController } from '../manager/useSettingsController';
import Constants from 'expo-constants';
import { useAppAccessibility } from '@/features/accessibility/appAccessibility';

// 현재 계정과 게스트의 계정 연결 진입을 표시한다.
export function SettingsAccountSection({
  isGuest,
  currentUser,
  router,
}: Pick<SettingsController, 'isGuest' | 'currentUser' | 'router'>) {
  const { largeText } = useAppAccessibility();
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('계정 정보')}</Text>
      <View style={styles.listCard}>
        <View
          style={[styles.listRow, largeText && styles.profileCardHeaderLarge]}
        >
          <View style={styles.listIconBox}>
            <Ionicons name="person-outline" size={20} color={colors.primary} />
          </View>
          <View style={styles.listTextGroup}>
            <Text style={styles.listTitle}>{t('기본 프로필')}</Text>
            <Text style={styles.listSubtitle}>
              {t(
                isGuest
                  ? '게스트 (이 기기에만 저장)'
                  : currentUser?.authProvider === 'google'
                    ? 'Google 계정'
                    : '회원 계정',
              )}
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
                largeText && styles.profileCardHeaderLarge,
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

// 앱 정보 및 이용약관·개인정보 처리방침 확인 카드를 구성한다.
export function SettingsAppInfo() {
  const [policySheet, setPolicySheet] = useState<'terms' | 'privacy' | null>(
    null,
  );
  const appVersion = Constants.expoConfig?.version || '0.0.2';

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('약관 및 정책')}</Text>
      <View style={[styles.listCard, { marginBottom: 16 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('서비스 이용약관')}
          onPress={() => setPolicySheet('terms')}
          style={({ pressed }) => [
            styles.listRow,
            pressed && styles.listRowPressed,
          ]}
        >
          <View style={styles.listIconBoxNeutral}>
            <Ionicons
              name="document-text-outline"
              size={20}
              color={colors.text}
            />
          </View>
          <View style={styles.listTextGroup}>
            <Text style={styles.listTitle}>{t('서비스 이용약관')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>

        <View style={styles.listDivider} />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('개인정보 처리방침')}
          onPress={() => setPolicySheet('privacy')}
          style={({ pressed }) => [
            styles.listRow,
            pressed && styles.listRowPressed,
          ]}
        >
          <View style={styles.listIconBoxNeutral}>
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color={colors.text}
            />
          </View>
          <View style={styles.listTextGroup}>
            <Text style={styles.listTitle}>{t('개인정보 처리방침')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>
      </View>

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
          <Text style={styles.listValue}>{appVersion}</Text>
        </View>
      </View>

      <ActionSheet
        visible={policySheet !== null}
        title={
          policySheet === 'terms'
            ? t('서비스 이용약관')
            : t('개인정보 처리방침')
        }
        onClose={() => setPolicySheet(null)}
      >
        <View style={styles.accountActions}>
          <Text style={styles.modalDesc}>
            {policySheet === 'terms'
              ? t(
                  'TripPrint는 여행 계획 작성, 가계부 기록, 동행자 공유 및 공개 여행 기록 서비스를 제공합니다. 사용자가 작성한 개인 메모와 비공개 여행 기록은 본인과 초대한 동행자에게만 표시됩니다.',
                )
              : t(
                  'TripPrint는 서비스 이용에 필요한 최소한의 계정 식별 정보와 사용자가 직접 등록한 프로필 사진·여행 기록만 보관하며, 계정 삭제 요청 시 관련 데이터를 안전하게 파기합니다.',
                )}
          </Text>
          <Text style={styles.listSubtitle}>
            {policySheet === 'terms'
              ? t(
                  '• 주요 내용: 서비스 이용 범위, 게시물 공개·비공개 권한, 계정 및 데이터 관리 기준',
                )
              : t(
                  '• 주요 내용: 최소 수집 항목(계정 식별자·여행 기록), 보관 기간 및 탈퇴 시 즉시 파기 절차',
                )}
          </Text>
          {((policySheet === 'terms' && process.env.EXPO_PUBLIC_TERMS_URL) ||
            (policySheet === 'privacy' &&
              process.env.EXPO_PUBLIC_PRIVACY_URL)) && (
            <DesignButton
              label={t('전문 보기')}
              variant="secondary"
              onPress={() => {
                const url =
                  policySheet === 'terms'
                    ? process.env.EXPO_PUBLIC_TERMS_URL
                    : process.env.EXPO_PUBLIC_PRIVACY_URL;
                if (url) {
                  void Linking.openURL(url).catch(() => undefined);
                }
              }}
            />
          )}
        </View>
      </ActionSheet>
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
          accessibilityLabel={t('계정 및 데이터 관리')}
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
            <Text style={styles.listTitle}>{t('계정 및 데이터 관리')}</Text>
            <Text style={styles.listSubtitle}>
              {t('연결된 계정 확인과 계정 삭제 안내')}
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
                : t('현재 계정에서 로그아웃해요')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.danger} />
        </Pressable>
      </View>
    </View>
  );
}
