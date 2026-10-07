import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import type { OsPlatform } from '@wherego/domain';

import { useTripStore } from '@/stores/useTripStore';
import { authenticatedDestination } from '@/features/auth/destination';
import SocialButtons from '@/features/auth/SocialButtons';
import EmailAuth from '@/features/auth/EmailAuth';
import { homeDestination } from '@/features/workspace/homeDestinations';

// 로그인 화면 전용 디자인 토큰 규격을 정의한다.
const loginTheme = {
  bg: '#FFF9F3',
  cardBg: '#FFFFFF',
  textPrimary: '#203247',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  primary: '#C84432',
  border: '#E5E7EB',
  googleBg: '#FFFFFF',
  googleBorder: '#D1D5DB',
  googleText: '#374151',
};

// 현재 실행 기기의 OS 플랫폼을 판별한다.
export function resolveCurrentOsPlatform(): OsPlatform {
  // iOS 플랫폼 여부를 확인하여 반환한다.
  if (Platform.OS === 'ios') return 'ios';
  // Android 플랫폼 여부를 확인하여 반환한다.
  if (Platform.OS === 'android') return 'android';
  // 그 외의 경우 web 플랫폼으로 반환한다.
  return 'web';
}

// 실제 제공하는 이메일 인증과 여행 둘러보기를 안내한다.
export default function LoginScreen() {
  const router = useRouter();
  // 홈에서 시작한 여행 생성 의도만 고정 경로로 복원한다.
  const { next, destination: selectedDestination } = useLocalSearchParams<{
    next?: string;
    destination?: string;
  }>();
  const { currentUser, loginAsGuest, logout } = useTripStore();

  const [isLoading, setIsLoading] = useState<boolean>(false);
  // 웹과 모바일에서 인증 실패를 동일하게 보여준다.
  const [authError, setAuthError] = useState('');
  const [emailOpen, setEmailOpen] = useState(false);
  const currentOs = resolveCurrentOsPlatform();

  // 메인 여행 대시보드 화면으로 라우팅한다.
  const navigateToTabs = () => {
    // 탭 네비게이션 화면으로 교체 이동한다.
    void authenticatedDestination(next, selectedDestination)
      .then((destination) => {
        // 인증 전에 받은 초대 링크로 복귀한다.
        router.replace(destination);
      })
      .catch(() => {
        // 저장소 오류가 있어도 여행 허브에 진입할 수 있다.
        setAuthError(
          '계정을 확인하지 못했어요. 이어서 시작하기를 눌러 다시 시도해 주세요.',
        );
      });
  };

  // 게스트 둘러보기 로그인을 처리하고 기기 저장소에 영구 보존한다.
  const handleGuestAuth = async () => {
    // 이전 인증 오류를 새 둘러보기 요청과 구분한다.
    setAuthError('');
    // 로딩 인디케이터 상태를 활성화한다.
    setIsLoading(true);
    // 실제 로그인 중인 사용자는 계정 전환 동작을 먼저 수행한다.
    try {
      if (currentUser && currentUser.authProvider !== 'guest') await logout();
      await loginAsGuest(currentOs);
      navigateToTabs();
    } catch {
      // 기기 저장 실패는 웹에서도 확인할 수 있다.
      setAuthError('둘러보기를 시작하지 못했어요. 잠시 후 다시 시도해 주세요.');
      // 저장 실패 후 성공 화면으로 이동하지 않는다.
      Alert.alert(
        '둘러보기 실패',
        '둘러보기를 시작하지 못했어요. 잠시 후 다시 시도해 주세요.',
      );
    } finally {
      // 실패한 뒤에도 다시 시도할 수 있다.
      setIsLoading(false);
    }
  };

  // 기존 로그인 세션을 유지하며 메인 화면으로 이동한다.
  const handleContinueExistingSession = () => {
    // 메인 대시보드로 이동하는 단일 명령을 수행한다.
    navigateToTabs();
  };

  // 현재 세션을 종료하고 새로 로그인한다.
  const handleSwitchAccount = () => {
    // 현재 로그인된 세션을 초기화하는 단일 명령을 수행한다.
    logout().catch(() => {
      // 세션 종료 실패를 화면에서도 안내한다.
      setAuthError('로그아웃에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      // 세션 종료가 실패하면 기존 계정을 유지한다.
      Alert.alert('로그아웃 실패', '잠시 후 다시 시도해 주세요.');
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {emailOpen && (
        <EmailAuth
          onClose={() => {
            // 인증 입력 모달을 닫고 로그인 안내 화면으로 돌아간다.
            return setEmailOpen(false);
          }}
          onAuthenticated={navigateToTabs}
        />
      )}
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { flexGrow: 1, flex: undefined },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* 상단 브랜드 및 슬로건 히어로 섹션 */}
        <View style={styles.heroSection}>
          <Image
            source={require('../../assets/brand/tripprint-v1/TripPrint_logo-stacked_768x768.png')}
            style={styles.brandLogo}
            resizeMode="contain"
            accessibilityLabel="TripPrint 트립프린트"
          />

          <Text style={styles.brandSubtitle}>여행의 발자취를 남기다.</Text>

          <Text style={styles.serviceTitle}>
            함께 세운 계획이,{'\n'}나만의 발자국으로.
          </Text>
          <Text style={styles.serviceDescription}>
            날짜별로 여행을 계획하고 친구를 초대하세요.{'\n'}사진과 비용을
            남기면 여행의 이야기가 쌓여요.
          </Text>
          {next === 'new-trip' && (
            <Text style={styles.serviceDescription}>
              {homeDestination(selectedDestination)?.city || '새 여행'} 계획을
              저장하려면 로그인해 주세요. 로그인 후 날짜 선택으로 이어집니다.
            </Text>
          )}
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
                    ? '둘러보던 여행을 이어서 살펴보세요.'
                    : '나의 여행을 이어서 기록해 보세요.'}
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

        {/* 인증 실패는 현재 입력과 버튼을 유지하며 표시한다. */}
        {authError ? (
          <Text
            accessibilityRole="alert"
            style={{ color: '#B42318', textAlign: 'center' }}
          >
            {authError}
          </Text>
        ) : null}

        {/* 로딩 인디케이터 */}
        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={loginTheme.primary} />
            <Text style={styles.loadingText}>여행을 열고 있어요…</Text>
          </View>
        ) : (
          /* 플랫폼별 인증 버튼 영역 */
          <View style={styles.buttonGroup}>
            <SocialButtons onAuthenticated={navigateToTabs} />
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="이메일로 계속하기"
              style={[
                styles.googleBtn,
                {
                  backgroundColor: loginTheme.primary,
                  borderColor: loginTheme.primary,
                },
              ]}
              onPress={() => {
                // 실제 이메일 로그인·회원가입 입력을 연다.
                return setEmailOpen(true);
              }}
            >
              <Ionicons
                name="mail-outline"
                size={18}
                color={loginTheme.primary}
              />
              <Text style={[styles.googleBtnText, { color: '#FFFFFF' }]}>
                이메일로 계속하기
              </Text>
            </TouchableOpacity>
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>또는</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* 서버 게스트 계정으로 시작하고 인증 정보를 기기에 보관한다. */}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="게스트로 시작하기"
              style={styles.guestBtn}
              onPress={handleGuestAuth}
              activeOpacity={0.8}
            >
              <Ionicons
                name="compass-outline"
                size={18}
                color={loginTheme.textSecondary}
              />
              <Text style={styles.guestBtnText}>게스트로 시작하기</Text>
            </TouchableOpacity>
            <Text style={styles.guestNoticeText}>
              게스트도 여행을 저장할 수 있어요. 마이에서 계정을 연결하면 다른
              기기에서도 여행을 이어갈 수 있어요. 연결 전에는 앱 삭제나 로그아웃
              시 계정을 다시 찾을 수 없어요.
            </Text>
          </View>
        )}

        {/* 기록의 비공개 기본값과 사용자 공개 선택을 안내한다. */}
        <View style={styles.footerWrap}>
          <Text style={styles.footerText}>
            여행 기록은 기본적으로 비공개입니다. 커뮤니티에 공개할 내용은 직접
            선택할 수 있어요.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// 화면 스타일 규격
const styles = StyleSheet.create({
  serviceTitle: {
    fontSize: 25,
    lineHeight: 35,
    fontWeight: '800',
    color: '#203247',
    textAlign: 'center',
    marginTop: 20,
  },
  serviceDescription: {
    fontSize: 14,
    lineHeight: 23,
    color: '#59677A',
    textAlign: 'center',
    marginTop: 12,
  },
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
  brandLogo: { width: 250, height: 210 },
  brandSubtitle: {
    fontSize: 14,
    color: loginTheme.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 4,
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
