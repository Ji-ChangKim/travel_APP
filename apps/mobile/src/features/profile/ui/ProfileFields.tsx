import Text from '@/components/ui/AppText';
import DesignButton from '@/components/ui/DesignButton';
import TextInput from '@/components/ui/DesignInput';
import { colors } from '@/constants/theme';
import { t } from '@/features/localization/translate';
import {
  nicknameError,
  nicknameHint,
  validProfileNickname,
} from '@wherego/validation';
import { View } from 'react-native';
import { styles } from '../styles/myAccountStyles';
import type { ProfileEditorProps } from '../model/myAccountTypes';
export const TRAVEL_STYLE_OPTIONS = [
  '휴양/힐링',
  '미식/맛집',
  '액티비티',
  '자연/풍경',
  '쇼핑',
  '문화/역사',
  '인스타감성',
  '배낭여행',
];
// 닉네임 입력과 기존 닉네임을 고려한 유효성 안내를 표시한다.
export function ProfileNicknameField({
  editNickname,
  isSavingProfile,
  setEditNickname,
  currentUser,
}: Pick<
  ProfileEditorProps,
  'editNickname' | 'isSavingProfile' | 'setEditNickname' | 'currentUser'
>) {
  return (
    <View style={styles.editInputGroup}>
      <Text style={styles.editInputLabel}>{t('닉네임')}</Text>
      <TextInput
        style={styles.modalTextInput}
        value={editNickname}
        editable={!isSavingProfile}
        onChangeText={setEditNickname}
        accessibilityLabel={t('닉네임')}
        placeholder={t('닉네임 입력')}
        placeholderTextColor={colors.mutedLight}
      />
      <Text style={styles.inputHint}>{t(nicknameHint)}</Text>
      {!validProfileNickname(editNickname, currentUser?.nickname) ? (
        <Text
          accessibilityRole="alert"
          style={[styles.editInputLabel, { color: colors.danger }]}
        >
          {t(nicknameError)}
        </Text>
      ) : null}
    </View>
  );
}
// 한 줄 소개 입력과 길이 제한을 표시한다.
export function ProfileBioField({
  editBio,
  isSavingProfile,
  setEditBio,
}: Pick<ProfileEditorProps, 'editBio' | 'isSavingProfile' | 'setEditBio'>) {
  return (
    <View style={styles.editInputGroup}>
      <Text style={styles.editInputLabel}>{t('한 줄 소개 (소개글)')}</Text>
      <TextInput
        style={[styles.modalTextInput, styles.bioInput]}
        value={editBio}
        editable={!isSavingProfile}
        onChangeText={setEditBio}
        accessibilityLabel={t('한 줄 소개')}
        placeholder={t('예: 힐링과 맛집 탐방을 사랑하는 여행자입니다 :)')}
        placeholderTextColor={colors.mutedLight}
        multiline
        numberOfLines={2}
        maxLength={80}
      />
    </View>
  );
}
// 여러 여행 스타일을 독립된 체크 상태로 선택한다.
export function ProfileTravelStylesField({
  editTravelStyles,
  isSavingProfile,
  handleToggleTravelStyle,
}: Pick<
  ProfileEditorProps,
  'editTravelStyles' | 'isSavingProfile' | 'handleToggleTravelStyle'
>) {
  return (
    <View style={styles.editInputGroup}>
      <Text style={styles.editInputLabel}>
        {t('나의 여행 스타일 (다중 선택)')}
      </Text>
      <View style={styles.tagSelectWrap}>
        {TRAVEL_STYLE_OPTIONS.map((tag) => {
          // 여러 여행 스타일을 독립된 체크 상태로 선택한다.
          const isSelected = editTravelStyles.includes(tag);
          return (
            <DesignButton
              key={tag}
              label={t(tag)}
              size="chip"
              checked={isSelected}
              disabled={isSavingProfile}
              onPress={() => {
                handleToggleTravelStyle(tag);
              }}
            />
          );
        })}
      </View>
    </View>
  );
}
