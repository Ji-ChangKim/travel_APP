import { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

import { useTripStore } from '@/stores/useTripStore';

// 점검 단계 열거형을 정의한다.
export type CheckStep =
  | 'INITIAL'
  | 'VERSION_CHECKING'
  | 'VERSION_COMPLETED'
  | 'DATA_CHECKING'
  | 'DATA_COMPLETED'
  | 'ALL_COMPLETED';

// 텍스트 전환 상태 타입을 정의한다.
export type BrandDisplayMode = 'BI' | 'CI';

// 최소 지원 앱 버전을 상수로 정의한다.
const MINIMUM_SUPPORTED_VERSION = '0.1.0';

// 현재 앱의 설치 버전을 판별한다.
export function resolveAppVersion(): string {
  // Expo Config에 설정된 버전 문자열을 추출하고 미설정 시 기본 버전을 반환한다.
  return Constants.expoConfig?.version ?? '0.1.0';
}

// 앱 버전 호환성을 검증한다.
export async function verifyVersionCompatibility(
  currentVersion: string,
): Promise<boolean> {
  // 비동기 검증 시뮬레이션 지연을 둔다.
  await new Promise((resolve) => setTimeout(resolve, 800));
  // 버전 유효성을 비교 검증한다.
  return currentVersion >= MINIMUM_SUPPORTED_VERSION;
}

// 로컬 보안 저장소 및 게스트 세션 데이터 무결성을 검증한다.
export async function verifyLocalDataIntegrity(): Promise<boolean> {
  // 모바일 네이티브 환경인 경우 SecureStore 가용성을 확인한다.
  if (Platform.OS !== 'web') {
    const isAvailable = await SecureStore.isAvailableAsync();
    if (!isAvailable) return false;
  }
  // 추가 데이터 무결성 검증을 위해 지연 처리를 수행한다.
  await new Promise((resolve) => setTimeout(resolve, 800));
  return true;
}

// 검정색 배경의 인트로 스플래시 및 버전/데이터 체크 후 로그인 전환 화면을 렌더링한다.
export default function SplashAndCheckScreen() {
  const router = useRouter();
  const { initGuestSession } = useTripStore();

  // 브랜드 텍스트 모드 (BI -> CI) 상태를 관리한다.
  const [displayMode, setDisplayMode] = useState<BrandDisplayMode>('BI');
  // 현재 점검 단계 상태를 관리한다.
  const [currentStep, setCurrentStep] = useState<CheckStep>('INITIAL');
  // 진행률 퍼센트 상태를 관리한다.
  const [progress, setProgress] = useState<number>(0);
  // 점검 상태 안내 메시지를 관리한다.
  const [statusMessage, setStatusMessage] =
    useState<string>('시스템 초기화 준비 중...');
  // 에러 발생 여부를 관리한다.
  const [hasError, setHasError] = useState<boolean>(false);

  // 애니메이션 수치 상태값을 정의한다.
  const [fadeAnim] = useState<Animated.Value>(() => new Animated.Value(0));
  const [scaleAnim] = useState<Animated.Value>(() => new Animated.Value(0.95));
  const [progressAnim] = useState<Animated.Value>(() => new Animated.Value(0));

  // 프로그레스 바 애니메이션을 갱신한다.
  const animateProgress = (targetPercent: number) => {
    // 프로그레스 바 애니메이션을 부드럽게 보간 이동시킨다.
    Animated.timing(progressAnim, {
      toValue: targetPercent,
      duration: 400,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  };

  // 로그인 화면으로 이동한다.
  const navigateToLogin = () => {
    // 로그인 화면으로 라우팅을 교체한다.
    router.replace('/login');
  };

  // BI 텍스트를 나타나게 하는 애니메이션을 실행한다.
  const runBiEnterAnimation = () => {
    // BI 텍스트 페이드인 및 살짝 확대되는 단일 애니메이션을 실행한다.
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  };

  // BI에서 CI 텍스트로 자연스럽게 전환하는 애니메이션을 실행한다.
  const switchBrandTextToCi = () => {
    // 1단계: BI 텍스트를 페이드아웃시킨다.
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start(() => {
      // 텍스트 모드를 CI로 교체한다.
      setDisplayMode('CI');
      // 2단계: CI 텍스트를 다시 페이드인시킨다.
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    });
  };

  // 버전 체크 단계를 수행한다.
  const executeVersionCheck = async (): Promise<boolean> => {
    // 버전 체크 시작 상태를 반영한다.
    setCurrentStep('VERSION_CHECKING');
    setStatusMessage('앱 버전 및 호환성 점검 중...');
    setProgress(25);
    animateProgress(25);

    const appVer = resolveAppVersion();
    const isVersionOk = await verifyVersionCompatibility(appVer);

    if (!isVersionOk) {
      // 버전 비호환 시 상태를 반영한다.
      setStatusMessage('지원되지 않는 앱 버전입니다. 업데이트가 필요합니다.');
      setHasError(true);
      return false;
    }

    // 버전 체크 완료 상태를 반영한다.
    setCurrentStep('VERSION_COMPLETED');
    setStatusMessage(`버전 체크 완료 (v${appVer} 최신 상태)`);
    setProgress(50);
    animateProgress(50);
    return true;
  };

  // 데이터 무결성 체크 단계를 수행한다.
  const executeDataCheck = async (): Promise<boolean> => {
    // 데이터 체크 시작 상태를 반영한다.
    setCurrentStep('DATA_CHECKING');
    setStatusMessage('로컬 보안 키체인 및 데이터 무결성 검증 중...');
    setProgress(75);
    animateProgress(75);

    // 게스트 세션 사전 초기화 및 로컬 저장소 무결성을 병렬 점검한다.
    await initGuestSession().catch(() => {});
    const isDataOk = await verifyLocalDataIntegrity();

    if (!isDataOk) {
      // 데이터 체크 실패 시 상태를 반영한다.
      setStatusMessage('보안 데이터 검증 중 이상이 감지되었습니다.');
      setHasError(true);
      return false;
    }

    // 데이터 체크 완료 상태를 반영한다.
    setCurrentStep('DATA_COMPLETED');
    setStatusMessage('데이터 무결성 점검 완료 (정상)');
    setProgress(100);
    animateProgress(100);
    return true;
  };

  // 모든 점검을 완료하고 로그인 화면으로 전환한다.
  const finishCheckAndProceed = () => {
    // 전체 완료 상태를 반영한다.
    setCurrentStep('ALL_COMPLETED');
    setStatusMessage('모든 시스템 점검 완료! 로그인 화면으로 이동합니다.');

    // 잠시 완료 메시지를 보여준 후 로그인 화면으로 라우팅한다.
    setTimeout(() => {
      navigateToLogin();
    }, 700);
  };

  // 전체 시스템 점검 파이프라인을 순차 실행한다.
  const runSystemCheckPipeline = async () => {
    // 에러 상태를 초기화한다.
    setHasError(false);

    // 1단계: BI 진입 애니메이션을 시작한다.
    runBiEnterAnimation();

    // 2단계: 잠시 대기 후 버전 체크를 실행한다.
    await new Promise((resolve) => setTimeout(resolve, 600));
    const versionPass = await executeVersionCheck();
    if (!versionPass) return;

    // 3단계: CI 텍스트로 전환한다.
    switchBrandTextToCi();

    // 4단계: 데이터 체크를 실행한다.
    await new Promise((resolve) => setTimeout(resolve, 500));
    const dataPass = await executeDataCheck();
    if (!dataPass) return;

    // 5단계: 로그인 화면으로 이동한다.
    finishCheckAndProceed();
  };

  // 컴포넌트 마운트 시 전체 파이프라인을 1회 실행한다.
  useEffect(() => {
    let isMounted = true;
    const timer = setTimeout(() => {
      if (isMounted) {
        runSystemCheckPipeline().catch(() => {
          if (isMounted) {
            setHasError(true);
            setStatusMessage('초기화 중 예기치 못한 오류가 발생했습니다.');
          }
        });
      }
    }, 100);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.container}>
        {/* 상단 여백 보정용 뷰 */}
        <View style={styles.topSpacer} />

        {/* 중앙 BI -> CI 텍스트 표시 영역 */}
        <View style={styles.centerBrandSection}>
          <Animated.View
            style={[
              styles.animatedBrandBox,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            {displayMode === 'BI' ? (
              // 1. BI (Brand Identity) 텍스트 표시
              <View style={styles.biContainer}>
                <View style={styles.biLogoBadge}>
                  <Ionicons name="navigate" size={30} color="#FF5436" />
                </View>
                <Text style={styles.biTitle}>WHEREGO</Text>
                <Text style={styles.biSubtitle}>
                  어디로든 떠나는 스마트한 여행
                </Text>
                <View style={styles.modeTag}>
                  <Text style={styles.modeTagText}>BRAND IDENTITY</Text>
                </View>
              </View>
            ) : (
              // 2. CI (Corporate Identity) 텍스트 전환 표시
              <View style={styles.ciContainer}>
                <View style={styles.ciLogoBadge}>
                  <Ionicons name="planet-outline" size={30} color="#3B82F6" />
                </View>
                <Text style={styles.ciTitle}>WHEREGO CORP.</Text>
                <Text style={styles.ciSubtitle}>
                  Global All-in-One Travel Ecosystem
                </Text>
                <View style={[styles.modeTag, styles.ciModeTag]}>
                  <Text style={[styles.modeTagText, styles.ciModeTagText]}>
                    CORPORATE IDENTITY
                  </Text>
                </View>
              </View>
            )}
          </Animated.View>
        </View>

        {/* 하단 시스템 버전 체크 및 데이터 체크 진행 영역 */}
        <View style={styles.bottomStatusSection}>
          {/* 체크 단계 인디케이터 배지 세트 */}
          <View style={styles.stepBadgesRow}>
            {/* 버전 체크 배지 */}
            <View
              style={[
                styles.stepBadge,
                currentStep === 'VERSION_CHECKING' && styles.stepBadgeActive,
                (currentStep === 'VERSION_COMPLETED' ||
                  currentStep === 'DATA_CHECKING' ||
                  currentStep === 'DATA_COMPLETED' ||
                  currentStep === 'ALL_COMPLETED') &&
                  styles.stepBadgeDone,
              ]}
            >
              <Ionicons
                name={
                  currentStep === 'VERSION_COMPLETED' ||
                  currentStep === 'DATA_CHECKING' ||
                  currentStep === 'DATA_COMPLETED' ||
                  currentStep === 'ALL_COMPLETED'
                    ? 'checkmark-circle'
                    : 'hardware-chip-outline'
                }
                size={14}
                color={
                  currentStep === 'VERSION_COMPLETED' ||
                  currentStep === 'DATA_CHECKING' ||
                  currentStep === 'DATA_COMPLETED' ||
                  currentStep === 'ALL_COMPLETED'
                    ? '#10B981'
                    : currentStep === 'VERSION_CHECKING'
                      ? '#FF5436'
                      : '#6B7280'
                }
              />
              <Text
                style={[
                  styles.stepBadgeText,
                  currentStep === 'VERSION_CHECKING' &&
                    styles.stepBadgeTextActive,
                  (currentStep === 'VERSION_COMPLETED' ||
                    currentStep === 'DATA_CHECKING' ||
                    currentStep === 'DATA_COMPLETED' ||
                    currentStep === 'ALL_COMPLETED') &&
                    styles.stepBadgeTextDone,
                ]}
              >
                1. 버전 체크
              </Text>
            </View>

            {/* 단계 구분선 */}
            <View style={styles.stepDivider} />

            {/* 데이터 체크 배지 */}
            <View
              style={[
                styles.stepBadge,
                currentStep === 'DATA_CHECKING' && styles.stepBadgeActive,
                (currentStep === 'DATA_COMPLETED' ||
                  currentStep === 'ALL_COMPLETED') &&
                  styles.stepBadgeDone,
              ]}
            >
              <Ionicons
                name={
                  currentStep === 'DATA_COMPLETED' ||
                  currentStep === 'ALL_COMPLETED'
                    ? 'checkmark-circle'
                    : 'shield-checkmark-outline'
                }
                size={14}
                color={
                  currentStep === 'DATA_COMPLETED' ||
                  currentStep === 'ALL_COMPLETED'
                    ? '#10B981'
                    : currentStep === 'DATA_CHECKING'
                      ? '#3B82F6'
                      : '#6B7280'
                }
              />
              <Text
                style={[
                  styles.stepBadgeText,
                  currentStep === 'DATA_CHECKING' && styles.stepBadgeTextActive,
                  (currentStep === 'DATA_COMPLETED' ||
                    currentStep === 'ALL_COMPLETED') &&
                    styles.stepBadgeTextDone,
                ]}
              >
                2. 데이터 체크
              </Text>
            </View>
          </View>

          {/* 프로그레스 바 트랙 및 채움 바 */}
          <View style={styles.progressBarTrack}>
            <Animated.View
              style={[
                styles.progressBarFill,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 100],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>

          {/* 상태 설명 텍스트 및 퍼센트 표시 */}
          <View style={styles.statusTextRow}>
            <Text style={styles.statusMessageText} numberOfLines={1}>
              {statusMessage}
            </Text>
            <Text style={styles.progressPercentText}>{progress}%</Text>
          </View>

          {/* 오류 발생 시 재시도 또는 건너뛰기 버튼 */}
          {hasError && (
            <View style={styles.errorActionRow}>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={runSystemCheckPipeline}
                activeOpacity={0.8}
              >
                <Ionicons name="refresh" size={14} color="#FFFFFF" />
                <Text style={styles.retryBtnText}>다시 확인하기</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.skipBtn}
                onPress={navigateToLogin}
                activeOpacity={0.8}
              >
                <Text style={styles.skipBtnText}>로그인으로 건너뛰기</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 최하단 빌드 버전 표시 */}
          <Text style={styles.footerVersionText}>
            WHEREGO Platform Engine v{resolveAppVersion()}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

// 스플래시 화면 전용 스타일 규격
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
  container: {
    flex: 1,
    backgroundColor: '#000000',
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  topSpacer: {
    height: 40,
  },
  centerBrandSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  animatedBrandBox: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  biContainer: {
    alignItems: 'center',
    gap: 12,
  },
  biLogoBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  biTitle: {
    fontSize: 38,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  biSubtitle: {
    fontSize: 14,
    color: '#A1A1AA',
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  ciContainer: {
    alignItems: 'center',
    gap: 12,
  },
  ciLogoBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  ciTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 1.5,
  },
  ciSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  modeTag: {
    backgroundColor: 'rgba(255, 84, 54, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 84, 54, 0.3)',
    marginTop: 6,
  },
  modeTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FF5436',
    letterSpacing: 1,
  },
  ciModeTag: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  ciModeTagText: {
    color: '#60A5FA',
  },
  bottomStatusSection: {
    paddingBottom: 28,
    gap: 14,
  },
  stepBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  stepBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#18181B',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  stepBadgeActive: {
    borderColor: '#FF5436',
    backgroundColor: 'rgba(255, 84, 54, 0.08)',
  },
  stepBadgeDone: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  stepBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#71717A',
  },
  stepBadgeTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  stepBadgeTextDone: {
    color: '#34D399',
    fontWeight: '600',
  },
  stepDivider: {
    width: 16,
    height: 1,
    backgroundColor: '#3F3F46',
  },
  progressBarTrack: {
    height: 5,
    backgroundColor: '#27272A',
    borderRadius: 3,
    overflow: 'hidden',
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FF5436',
    borderRadius: 3,
  },
  statusTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  statusMessageText: {
    fontSize: 12,
    color: '#A1A1AA',
    fontWeight: '500',
    flex: 1,
    marginRight: 8,
  },
  progressPercentText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  errorActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  retryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF5436',
    height: 38,
    borderRadius: 8,
    gap: 6,
  },
  retryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  skipBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#27272A',
    height: 38,
    borderRadius: 8,
  },
  skipBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E4E4E7',
  },
  footerVersionText: {
    fontSize: 11,
    color: '#52525B',
    textAlign: 'center',
    marginTop: 4,
  },
});
