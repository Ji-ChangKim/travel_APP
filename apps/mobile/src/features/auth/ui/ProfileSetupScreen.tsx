import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '@/components/navigation/ScreenHeader';
import Text from '@/components/ui/AppText';
import DesignInput from '@/components/ui/DesignInput';
import DesignButton from '@/components/ui/DesignButton';
import CenteredNoticeModal from '@/components/ui/CenteredNoticeModal';
import { useLocale } from '@/features/localization/localeState';
import { t } from '@/features/localization/translate';
import { colors } from '@/constants/theme';
import {
  avatarImage,
  defaultProfileImage,
} from '@/services/profilePhotoService';
import { useProfileSetup } from '../manager/useProfileSetup';
import { profileSetupStyles as s } from '../styles/profileSetupStyles';
import { useTripStore } from '@/stores/useTripStore';

export default function ProfileSetupScreen() {
  const account = useTripStore(
    (state) => state.currentUser?.id || 'signed-out',
  );
  return <ProfileSetupForm key={account} />;
}

function ProfileSetupForm() {
  useLocale();
  const c = useProfileSetup();
  const locked = c.busy || c.uploading || c.checking || !c.ready;
  const image =
    c.image.type === 'photo'
      ? { uri: c.image.uri, headers: c.photoHeaders }
      : c.image.type === 'avatar'
        ? avatarImage(c.image.id)
        : defaultProfileImage;
  return (
    <SafeAreaView style={s.screen}>
      <ScreenHeader
        title={t('프로필 설정')}
        onBack={c.back}
        disabled={c.busy || c.checking || c.uploading}
      />
      <KeyboardAvoidingView
        style={s.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.introduction}>
            <Text style={s.title}>
              {t('여행에서 사용할 프로필을 만들어요')}
            </Text>
            <Text style={s.body}>
              {t(
                '닉네임은 여행 기록에 표시돼요. 사진은 나중에 바꿀 수 있어요.',
              )}
            </Text>
          </View>
          <View style={s.portraitGroup}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('프로필 이미지 선택')}
              accessibilityState={{ disabled: locked }}
              disabled={locked}
              style={s.portraitButton}
              onPress={() => c.setPicker(true)}
            >
              <Image source={image} style={s.portrait} resizeMode="contain" />
              <View style={s.camera}>
                <Ionicons name="camera-outline" size={24} color={colors.text} />
              </View>
            </Pressable>
            <Text style={s.body}>
              {t(
                c.uploading
                  ? '사진을 불러오고 있어요…'
                  : '기본 이미지로도 시작할 수 있어요.',
              )}
            </Text>
          </View>
          <View style={s.field}>
            <Text style={s.label}>{t('닉네임')}</Text>
            <DesignInput
              accessibilityLabel={t('닉네임')}
              value={c.nickname}
              onChangeText={c.setNickname}
              onBlur={c.blur}
              onFocus={c.focus}
              editable={!locked}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="nickname"
              placeholder={t('닉네임을 입력해 주세요')}
            />
            <Text
              style={s.counter}
              accessibilityLabel={t('닉네임 {count}/10자', {
                count: c.input.length,
              })}
            >
              {c.input.length}/10
            </Text>
            {c.touched && !c.focused && c.input.error ? (
              <Text style={s.error} accessibilityRole="alert">
                {t(c.input.error)}
              </Text>
            ) : (
              <Text style={s.body}>
                {t('한글, 영문, 숫자로 2~10자까지 사용할 수 있어요.')}
              </Text>
            )}
          </View>
          {c.error ? (
            <View style={s.field}>
              <Text style={s.error} accessibilityRole="alert">
                {t(c.error)}
              </Text>
              {!c.ready && (
                <DesignButton label={t('다시 시도')} onPress={c.retry} />
              )}
            </View>
          ) : null}
          <View style={s.footer}>
            <DesignButton
              label={t(
                c.checking
                  ? '저장 결과를 확인하고 있어요.'
                  : c.busy
                    ? '저장 중…'
                    : '시작하기',
              )}
              variant="primary"
              disabled={locked || Boolean(c.input.error)}
              loading={c.busy || c.checking}
              onPress={() => void c.save()}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <CenteredNoticeModal
        visible={c.picker}
        title={t('프로필 이미지 선택')}
        paragraphs={[
          t('기본 이미지, 여행자 아바타 또는 내 사진을 선택해 주세요.'),
        ]}
        onClose={() => c.setPicker(false)}
      >
        <View style={s.choices}>
          <DesignButton
            label={t('기본 이미지 사용')}
            onPress={() => c.setImage({ type: 'default' })}
          />
          {c.avatars.map((avatar) => (
            <Pressable
              key={avatar.id}
              accessibilityRole="button"
              accessibilityLabel={t(
                avatar.id === 'haru-traveler' ? '하루 아바타' : '여행자 아바타',
              )}
              style={s.avatar}
              onPress={() => c.setImage({ type: 'avatar', id: avatar.id })}
            >
              <Image source={avatarImage(avatar.id)} style={s.avatarImage} />
              <Text style={s.body}>
                {t(
                  avatar.id === 'haru-traveler'
                    ? '하루 아바타'
                    : '여행자 아바타',
                )}
              </Text>
            </Pressable>
          ))}
          <DesignButton
            label={t('사진 선택')}
            onPress={() => void c.photo(false)}
          />
          {Platform.OS !== 'web' && (
            <DesignButton
              label={t('사진 촬영')}
              onPress={() => void c.photo(true)}
            />
          )}
          <DesignButton label={t('닫기')} onPress={() => c.setPicker(false)} />
        </View>
      </CenteredNoticeModal>
    </SafeAreaView>
  );
}
