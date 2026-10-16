import Text from '@/components/AppText';
import { colors } from '@/constants/theme';
import { Image, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { loginStyles as styles, loginTheme } from './loginStyles';

// 인증 입력 화면의 제목과 뒤로가기·닫기 버튼을 표시한다.
export function AuthNavigation({
  title,
  disabled = false,
  onBack,
  onClose,
}: {
  title: string;
  disabled?: boolean;
  onBack: () => void;
  onClose?: () => void;
}) {
  // 처리 중에는 화면을 닫아 인증 요청을 중복으로 시작하지 못하게 한다.
  return (
    <View style={styles.formNavigation}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="로그인 화면으로 돌아가기"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onBack}
        style={[styles.navigationButton, disabled && styles.disabled]}
      >
        <Ionicons name="arrow-back" size={21} color={loginTheme.secondary} />
      </Pressable>
      <Text style={styles.navigationTitle}>{title}</Text>
      {onClose ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="이메일 인증 닫기"
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={onClose}
          style={[styles.navigationButton, disabled && styles.disabled]}
        >
          <Ionicons name="close" size={22} color={loginTheme.secondary} />
        </Pressable>
      ) : (
        <View style={styles.navigationButton} />
      )}
    </View>
  );
}

// 실제 가입 흐름의 계정 생성과 프로필 설정 두 단계를 안내한다.
export function SignupProgress({ step }: { step: 1 | 2 }) {
  // 완료 전에는 계정 생성 단계를 전체 가입 완료로 표현하지 않는다.
  return (
    <View style={styles.progressSection}>
      <View style={styles.progressHeading}>
        <Text style={styles.progressTitle}>
          {step === 1 ? '계정 만들기' : '프로필 설정'}
        </Text>
        <Text style={styles.progressCount}>{step} / 2</Text>
      </View>
      <View
        style={styles.progressTrack}
        accessibilityRole="progressbar"
        accessibilityLabel="회원가입 진행"
        accessibilityValue={{ min: 0, max: 2, now: step }}
      >
        <View
          style={[styles.progressFill, { width: step === 1 ? '50%' : '100%' }]}
        />
      </View>
    </View>
  );
}

// 개인정보 입력 전에 필요한 공개 범위만 짧게 알려준다.
export function ProfilePrivacy() {
  // 닉네임을 제외한 성별과 생일은 공개하지 않는 현재 동작을 안내한다.
  return (
    <View style={styles.privacyCard}>
      <View style={styles.privacyIcon} accessible={false}>
        <Ionicons name="lock-closed" size={18} color={loginTheme.coral} />
      </View>
      <View style={styles.guestCopy}>
        <Text style={styles.privacyTitle}>나를 소개하는 여행 프로필</Text>
        <Text style={styles.privacyDescription}>
          닉네임만 보여요. 성별과 생일은 공개하지 않아요.
        </Text>
      </View>
    </View>
  );
}

// 프로필 설정 시안의 여행자 이미지를 편집 버튼 없이 표시한다.
export function TravelerPortrait() {
  // 프로필 사진 저장 기능으로 오해하지 않도록 장식 이미지만 렌더링한다.
  return (
    <View style={styles.profilePortrait} accessible={false}>
      <Image
        source={require('../../../assets/brand/tripprint-v1/TripPrint_login-hero.png')}
        style={styles.profileImage}
        resizeMode="cover"
      />
      <View style={styles.profileBadge}>
        <Ionicons name="airplane" size={13} color={colors.textLight} />
      </View>
    </View>
  );
}
