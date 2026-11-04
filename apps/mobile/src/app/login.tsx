import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';
import ScreenHeader from '@/components/ScreenHeader';
import { returnToScreen } from '@/components/navigationModel';
import Text from '@/components/AppText';
import { colors } from '@/constants/theme';
import { Image, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import GoogleLogin from '@/features/auth/GoogleLogin';
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
  useLocale();
  // 여행을 시작하기 전에 선택한 목적지는 로그인 이후에도 이어진다.
  return (
    <View style={styles.hero}>
      <View style={styles.portrait}>
        <Image
          source={require('../../assets/brand/tripprint-v1/TripPrint_login-hero.png')}
          style={styles.portraitImage}
          resizeMode="cover"
          accessibilityLabel={t('여행 노트 위에서 캐리어와 함께 떠나는 여행자')}
        />
        <View style={styles.flightBadge} accessible={false}>
          <Ionicons name="airplane" size={20} color={colors.textLight} />
        </View>
      </View>
      <Text style={styles.eyebrow}>{t('트립프린트 · TRIPPRINT')}</Text>
      <Text style={styles.title}>
        {t('여행의')} <Text style={styles.highlight}>{t('발자취')}</Text>
        {t('를 남기다')}
      </Text>
      <Text style={styles.description}>
        {t('장소를 잇고 순간을 기록하는')}
        {'\n'}
        {t('나만의 여행 아카이브')}
      </Text>
      {next === 'new-trip' ? (
        <Text style={styles.context}>
          {homeDestination(destination)?.city || t('새 여행')}{' '}
          {t('여행 계획을 이어가요.')}
        </Text>
      ) : null}
    </View>
  );
}

// 게스트 선택에 필요한 저장 범위와 시작 버튼만 하나의 카드에 모은다.
function GuestStart({
  controller,
}: {
  controller: ReturnType<typeof useLoginController>;
}) {
  useLocale();
  // 계정을 만들지 않은 여행도 이 기기에서 바로 시작할 수 있다.
  return (
    <View style={styles.guestCard}>
      <View style={styles.guestHeading}>
        <View style={styles.guestIcon} accessible={false}>
          <Ionicons name="compass-outline" size={23} color={colors.secondary} />
        </View>
        <View style={styles.guestCopy}>
          <Text style={styles.guestTitle}>{t('가볍게 여행을 시작해요')}</Text>
          <Text style={styles.guestDescription}>
            {t('가입 없이 시작해요. 기록은 이 기기에만 저장돼요.')}
          </Text>
        </View>
      </View>
      <LoginButton
        label={
          controller.operation === 'guest'
            ? t('게스트를 시작하고 있어요…')
            : t('게스트로 시작하기')
        }
        variant="primary"
        busy={controller.operation === 'guest'}
        disabled={controller.busy}
        onPress={controller.startGuest}
        trailing={
          <Ionicons name="arrow-forward" size={18} color={colors.textLight} />
        }
      />
    </View>
  );
}

// 현재 로그인된 계정의 이어하기와 명시적인 계정 전환을 표시한다.
function ExistingSession({
  controller,
}: {
  controller: ReturnType<typeof useLoginController>;
}) {
  useLocale();
  // 기존 게스트도 계정 연결 전 자신의 여행을 계속 볼 수 있다.
  return controller.currentUser ? (
    <View style={styles.session}>
      <Text style={styles.sessionTitle}>
        {controller.currentUser.nickname}
        {t('님, 반가워요')}
      </Text>
      <Text style={styles.status}>
        {controller.currentUser.authProvider === 'guest'
          ? t(
              '이 기기의 여행을 이어가세요. Google 계정으로 연결하면 새 여행을 계정에 보관할 수 있어요.',
            )
          : t('나의 여행을 이어서 기록해 보세요.')}
      </Text>
      <LoginButton
        label={
          controller.operation === 'continue'
            ? t('여행을 열고 있어요…')
            : t('이어서 시작하기')
        }
        variant="primary"
        disabled={controller.busy}
        onPress={controller.continueSession}
      />
      <LoginButton
        label={
          controller.operation === 'logout'
            ? t('로그아웃하고 있어요…')
            : t('다른 계정으로 로그인')
        }
        disabled={controller.busy}
        onPress={controller.switchAccount}
      />
    </View>
  ) : null;
}

// Google 로그인과 게스트 시작만 깔끔하게 표시한다.
export default function LoginScreen() {
  useLocale();
  // 인증 전에 고른 여행의 고정 복귀 경로만 전달한다.
  const { next, destination, tripId, reauth } = useLocalSearchParams<{
    next?: string;
    destination?: string;
    tripId?: string;
    reauth?: string;
  }>();
  const router = useRouter();
  const controller = useLoginController(next, destination, tripId);
  const signedInMember = Boolean(
    controller.currentUser &&
    controller.currentUser.authProvider !== 'guest' &&
    reauth !== '1',
  );
  // 인증 화면은 하단 메뉴 없이 Google 로그인과 게스트 시작 선택에 집중한다.
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <ScreenHeader
        title={t('로그인')}
        inlineTitle
        disabled={controller.busy}
        onBack={
          controller.currentUser
            ? () => {
                // 이미 로그인된 게스트·회원이 계정 연결을 위해 들어온 경우에만 복귀를 제공한다.
                return controller.busy
                  ? undefined
                  : returnToScreen(router, '/(tabs)');
              }
            : undefined
        }
      />
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <LoginHero next={next} destination={destination} />
        {reauth === '1' ? (
          <Text style={styles.context}>
            {t('다시 로그인하고 여행을 이어가요.')}
          </Text>
        ) : (
          <ExistingSession controller={controller} />
        )}
        <View style={styles.actions}>
          <GoogleLogin
            busy={controller.operation === 'google'}
            disabled={controller.busy || signedInMember}
            onPress={controller.startGoogle}
          />
          {!controller.currentUser && (
            <>
              <View style={styles.guestDivider} accessible={false} />
              <GuestStart controller={controller} />
            </>
          )}
          {controller.error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {t(controller.error)}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
