import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { AuthProvider, OsPlatform } from '@wherego/domain';

import { useTripStore } from '@/stores/useTripStore';

// 로그인 화면 전용 디자인 토큰 규격을 정의한다.
const loginTheme = {
  bg: '#FAFBFC',
  cardBg: '#FFFFFF',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  primary: '#E84025',
  border: '#E5E7EB',
  kakao: '#FEE500',
  kakaoText: '#191919',
  apple: '#000000',
  googleBg: '#FFFFFF',
  googleBorder: '#D1D5DB',
  googleText: '#374151',
};

// 현재 실행 기기의 OS 플랫폼을 판별한다.
export function resolveCurrentOsPlatform(): OsPlatform {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return 'web';
}

// 비밀번호 없이 OS 맞춤 소셜 및 게스트 원클릭 인증 화면을 렌더링한다.
export default function SocialAuthScreen() {
  const router = useRouter();
  const {
    currentUser,
    loginWithSocial,
    loginAsGuest,
    initGuestSession,
    logout,
  } = useTripStore();

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const currentOs = resolveCurrentOsPlatform();

  // 컴포넌트 마운트 시 기기 SecureStore에 저장된 게스트 세션을 복원한다.
  useEffect(() => {
    initGuestSession().catch(() => {});
  }, [initGuestSession]);

  // 메인 여행 화면으로 라우팅한다.
  const navigateToTabs = () => {
    router.replace('/(tabs)');
  };

  // 소셜 로그인(구글/카톡/애플)을 처리하고 OS 및 제공자 정보를 기록한다.
  const handleSocialAuth = async (provider: AuthProvider) => {
    setIsLoading(true);
    const providerNameMap: Record<AuthProvider, string> = {
      kakao: '카카오',
      google: 'Google',
      apple: 'Apple',
      guest: '게스트',
    };

    const defaultNickname = `${providerNameMap[provider]} 여행자`;
    await loginWithSocial(provider, defaultNickname, currentOs);
    setIsLoading(false);
    navigateToTabs();
  };

  // 게스트 둘러보기 로그인을 처리하고 기기 저장소에 영구 보존한다.
  const handleGuestAuth = async () => {
    setIsLoading(true);
    await loginAsGuest(currentOs);
    setIsLoading(false);
    navigateToTabs();
  };

  // 기존 로그인 세션을 유지하며 메인 화면으로 이동한다.
  const handleContinueExistingSession = () => {
    navigateToTabs();
  };

  // 현재 세션을 종료하고 새로 로그인한다.
  const handleSwitchAccount = () => {
    logout();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* 상단 브랜드 및 슬로건 히어로 섹션 */}
        <View style={styles.heroSection}>
          <View style={styles.logoBox}>
            <Ionicons name="location-sharp" size={32} color="#FF5436" />
            <View style={styles.logoBadge}>
              <Ionicons name="airplane" size={11} color="#FFFFFF" />
            </View>
          </View>

          <View style={styles.brandTitleRow}>
            <Text style={styles.brandTitle}>Odigo</Text>
            <View style={styles.koreanBadge}>
              <Text style={styles.koreanBadgeText}>오디고</Text>
            </View>
          </View>

          <Text style={styles.brandSubtitle}>
            간편한 소셜 연동으로 시작하는 스마트 여행 일정
          </Text>

          {/* OS 플랫폼 표시 배지 */}
          <View style={styles.osBadgeWrap}>
            <Ionicons
              name={
                currentOs === 'ios'
                  ? 'logo-apple'
                  : currentOs === 'android'
                    ? 'logo-android'
                    : 'globe-outline'
              }
              size={12}
              color={loginTheme.textSecondary}
            />
            <Text style={styles.osBadgeText}>
              {currentOs === 'ios'
                ? 'iOS 맞춤 로그인'
                : currentOs === 'android'
                  ? 'Android 맞춤 로그인'
                  : '웹 환경'}
            </Text>
          </View>
        </View>

        {/* 기존 세션이 유지되어 있는 경우 빠른 이어하기 카드 */}
        {currentUser && (
          <View style={styles.sessionCard}>
            <View style={styles.sessionInfoRow}>
              <Ionicons
                name="person-circle"
                size={24}
                color={loginTheme.primary}
              />
              <View style={styles.sessionTextGroup}>
                <Text style={styles.sessionUserText}>
                  <Text style={styles.sessionBold}>{currentUser.nickname}</Text>
                  님
                </Text>
                <Text style={styles.sessionDescText}>
                  {currentUser.authProvider === 'guest'
                    ? '기기에 저장된 게스트 세션 활성 중'
                    : `${currentUser.authProvider?.toUpperCase()} 연동 세션 유지 중`}
                </Text>
              </View>
            </View>

            <View style={styles.sessionBtnRow}>
              <TouchableOpacity
                style={styles.continueBtn}
                onPress={handleContinueExistingSession}
                activeOpacity={0.85}
              >
                <Text style={styles.continueBtnText}>이어서 시작하기</Text>
                <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.switchBtn}
                onPress={handleSwitchAccount}
                activeOpacity={0.7}
              >
                <Text style={styles.switchBtnText}>다른 계정</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 로딩 인디케이터 */}
        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={loginTheme.primary} />
            <Text style={styles.loadingText}>로그인 처리 중입니다...</Text>
          </View>
        ) : (
          /* 플랫폼별 인증 버튼 영역 */
          <View style={styles.buttonGroup}>
            {/* 1. 공통: 카카오톡 로그인 (AOS & iOS 공통 1순위) */}
            <TouchableOpacity
              style={styles.kakaoBtn}
              onPress={() => handleSocialAuth('kakao')}
              activeOpacity={0.88}
            >
              <Ionicons
                name="chatbubble"
                size={18}
                color={loginTheme.kakaoText}
              />
              <Text style={styles.kakaoBtnText}>
                카카오톡으로 3초 만에 시작하기
              </Text>
            </TouchableOpacity>

            {/* 2. AOS(Android): Google 로그인 */}
            {(currentOs === 'android' || currentOs === 'web') && (
              <TouchableOpacity
                style={styles.googleBtn}
                onPress={() => handleSocialAuth('google')}
                activeOpacity={0.88}
              >
                <Ionicons name="logo-google" size={18} color="#EA4335" />
                <Text style={styles.googleBtnText}>
                  Google 계정으로 계속하기
                </Text>
              </TouchableOpacity>
            )}

            {/* 3. iOS: Apple 로그인 */}
            {(currentOs === 'ios' || currentOs === 'web') && (
              <TouchableOpacity
                style={styles.appleBtn}
                onPress={() => handleSocialAuth('apple')}
                activeOpacity={0.88}
              >
                <Ionicons name="logo-apple" size={20} color="#FFFFFF" />
                <Text style={styles.appleBtnText}>Apple로 계속하기</Text>
              </TouchableOpacity>
            )}

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>또는</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* 4. 공통: 게스트 로그인 (클라이언트 기기 SecureStore 영구 저장) */}
            <TouchableOpacity
              style={styles.guestBtn}
              onPress={handleGuestAuth}
              activeOpacity={0.8}
            >
              <Ionicons
                name="compass-outline"
                size={18}
                color={loginTheme.textSecondary}
              />
              <Text style={styles.guestBtnText}>
                로그인 없이 게스트로 둘러보기
              </Text>
            </TouchableOpacity>
            <Text style={styles.guestNoticeText}>
              * 게스트 데이터는 앱을 삭제하기 전까지 기기에 안전하게 보존됩니다.
            </Text>
          </View>
        )}

        {/* 하단 약관 안내 문구 */}
        <View style={styles.footerWrap}>
          <Text style={styles.footerText}>
            시작 시 Odigo의 이용약관 및 개인정보 처리방침에 동의하게 됩니다.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

// 화면 스타일 규격
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: loginTheme.bg,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 20,
    justifyContent: 'space-between',
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  heroSection: {
    alignItems: 'center',
    marginTop: 36,
  },
  logoBox: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: '#1E2430',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
    position: 'relative',
  },
  logoBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: loginTheme.primary,
    borderWidth: 2,
    borderColor: loginTheme.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: loginTheme.textPrimary,
    letterSpacing: -0.5,
  },
  koreanBadge: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  koreanBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: loginTheme.textSecondary,
  },
  brandSubtitle: {
    fontSize: 14,
    color: loginTheme.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 4,
  },
  osBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EEF2F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 12,
  },
  osBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: loginTheme.textSecondary,
  },
  sessionCard: {
    backgroundColor: loginTheme.cardBg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    gap: 12,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  sessionInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sessionTextGroup: {
    flex: 1,
  },
  sessionUserText: {
    fontSize: 14,
    color: loginTheme.textPrimary,
  },
  sessionBold: {
    fontWeight: '800',
    color: '#1D4ED8',
  },
  sessionDescText: {
    fontSize: 11,
    color: loginTheme.textSecondary,
    marginTop: 1,
  },
  sessionBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  continueBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    height: 42,
    borderRadius: 10,
    gap: 6,
  },
  continueBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  switchBtn: {
    paddingHorizontal: 14,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: loginTheme.textSecondary,
    fontWeight: '600',
  },
  buttonGroup: {
    gap: 12,
    marginVertical: 20,
  },
  kakaoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: loginTheme.kakao,
    height: 52,
    borderRadius: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  kakaoBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: loginTheme.kakaoText,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: loginTheme.googleBg,
    borderWidth: 1,
    borderColor: loginTheme.googleBorder,
    height: 50,
    borderRadius: 14,
    gap: 10,
  },
  googleBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: loginTheme.googleText,
  },
  appleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: loginTheme.apple,
    height: 50,
    borderRadius: 14,
    gap: 10,
  },
  appleBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    fontSize: 12,
    color: loginTheme.textMuted,
    fontWeight: '500',
  },
  guestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    height: 48,
    borderRadius: 14,
    gap: 8,
  },
  guestBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: loginTheme.textSecondary,
  },
  guestNoticeText: {
    fontSize: 11,
    color: loginTheme.textMuted,
    textAlign: 'center',
    marginTop: -4,
  },
  footerWrap: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  footerText: {
    fontSize: 11,
    color: loginTheme.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
});
