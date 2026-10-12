import { Image, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import GoogleLogin from '@/features/auth/GoogleLogin';
import EmailAuth from '@/features/auth/EmailAuth';
import LoginButton from '@/features/auth/LoginButton';
import useLoginController from '@/features/auth/useLoginController';
import { loginStyles as styles } from '@/features/auth/loginStyles';
import { homeDestination } from '@/features/workspace/homeDestinations';

// 제공한 여행 이미지와 문구로 앱의 첫 인증 화면을 표시한다.
function LoginHero({
  next,
  destination,
}: {
  next?: string;
  destination?: string;
}) {
  // 여행을 시작하기 전에 선택한 목적지는 로그인 이후에도 이어진다.
  return (
    <View style={styles.hero}>
      <View style={styles.portrait}>
        <Image
          source={require('../../assets/brand/tripprint-v1/TripPrint_login-hero.png')}
          style={styles.portraitImage}
          resizeMode="cover"
          accessibilityLabel="여행 노트 위에서 캐리어와 함께 떠나는 여행자"
        />
        <View style={styles.flightBadge} accessible={false}>
          <Ionicons name="airplane" size={20} color="#FFFFFF" />
        </View>
      </View>
      <Text style={styles.eyebrow}>트립프린트 · TRIPPRINT</Text>
      <Text style={styles.title}>
        여행의 <Text style={styles.highlight}>발자취</Text>를 남기다
      </Text>
      <Text style={styles.description}>
        장소를 잇고 순간을 기록하는{'\n'}나만의 여행 아카이브
      </Text>
      {next === 'new-trip' ? (
        <Text style={styles.context}>
          {homeDestination(destination)?.city || '새 여행'} 계획을 저장하고
          여행을 시작하세요.{'\n'}로그인 또는 게스트 시작 후 날짜를 선택해요.
        </Text>
      ) : null}
    </View>
  );
}

// 현재 로그인된 계정의 이어하기와 명시적인 계정 전환을 표시한다.
function ExistingSession({
  controller,
}: {
  controller: ReturnType<typeof useLoginController>;
}) {
  // 기존 게스트도 계정 연결 전 자신의 여행을 계속 볼 수 있다.
  return controller.currentUser ? (
    <View style={styles.session}>
      <Text style={styles.sessionTitle}>
        {controller.currentUser.nickname}님, 반가워요
      </Text>
      <Text style={styles.status}>
        {controller.currentUser.authProvider === 'guest'
          ? '이 기기의 여행을 이어가세요. 회원가입 후 새 여행은 계정에 보관할 수 있어요.'
          : '나의 여행을 이어서 기록해 보세요.'}
      </Text>
      <LoginButton
        label={
          controller.operation === 'continue'
            ? '여행을 열고 있어요…'
            : '이어서 시작하기'
        }
        variant="primary"
        disabled={controller.busy}
        onPress={controller.continueSession}
      />
      <LoginButton
        label={
          controller.operation === 'logout'
            ? '로그아웃하고 있어요…'
            : '다른 계정으로 로그인'
        }
        disabled={controller.busy}
        onPress={controller.switchAccount}
      />
    </View>
  ) : null;
}

// 로그인 화면에는 Google과 이메일 인증 두 가지만 노출한다.
export default function LoginScreen() {
  // 인증 전에 고른 여행의 고정 복귀 경로만 전달한다.
  const { next, destination } = useLocalSearchParams<{
    next?: string;
    destination?: string;
  }>();
  const controller = useLoginController(next, destination);
  const signedInMember = Boolean(
    controller.currentUser && controller.currentUser.authProvider !== 'guest',
  );
  // 전체 화면 메뉴는 루트 레이아웃에 유지하고 입력 화면만 전환한다.
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        aria-hidden={controller.emailOpen}
        accessibilityElementsHidden={controller.emailOpen}
        importantForAccessibility={
          controller.emailOpen ? 'no-hide-descendants' : 'auto'
        }
      >
        <LoginHero next={next} destination={destination} />
        <ExistingSession controller={controller} />
        <View style={styles.actions}>
          <GoogleLogin
            busy={controller.operation === 'google'}
            disabled={controller.busy || signedInMember || controller.emailOpen}
            onPress={controller.startGoogle}
          />
          <LoginButton
            label="이메일 계정으로 로그인 / 회원가입"
            variant="email"
            disabled={controller.busy || signedInMember || controller.emailOpen}
            onPress={controller.openEmail}
            icon={<Ionicons name="mail-outline" size={18} color="#536B87" />}
          />
          {!controller.currentUser && (
            <>
              <LoginButton
                label={
                  controller.operation === 'guest'
                    ? '게스트를 시작하고 있어요…'
                    : '게스트로 시작하기'
                }
                disabled={controller.busy || controller.emailOpen}
                onPress={controller.startGuest}
              />
              <Text style={styles.footerText}>
                게스트 여행은 이 기기에만 저장돼요. 앱이나 저장 데이터를
                삭제하면 복구할 수 없어요.
              </Text>
              <LoginButton
                label="로그인 없이 여행 발자국 둘러보기"
                disabled={controller.busy || controller.emailOpen}
                onPress={controller.browseCommunity}
              />
            </>
          )}
          {controller.error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {controller.error}
            </Text>
          ) : null}
        </View>
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            여행 기록은 기본적으로 비공개예요.{'\n'}공유할 이야기는 직접
            선택하세요.
          </Text>
          {Constants.expoConfig?.version ? (
            <Text style={styles.footerText}>
              TripPrint v{Constants.expoConfig.version}
            </Text>
          ) : null}
        </View>
      </ScrollView>
      {controller.emailOpen ? (
        <EmailAuth
          onClose={controller.closeEmail}
          onAuthenticated={controller.onAuthenticated}
        />
      ) : null}
    </SafeAreaView>
  );
}
