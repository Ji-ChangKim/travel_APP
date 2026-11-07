import Modal from '@/components/ui/AppModal';
import Text from '@/components/ui/AppText';
import DesignButton from '@/components/ui/DesignButton';
import ScreenHeader from '@/components/navigation/ScreenHeader';
import { colors } from '@/constants/theme';
import { t } from '@/features/localization/translate';
import { Ionicons } from '@expo/vector-icons';
import { validProfileNickname } from '@wherego/validation';
import { ScrollView, View } from 'react-native';
import {
  ProfileBioField,
  ProfileNicknameField,
  ProfileTravelStylesField,
} from './ProfileFields';
import { styles } from '../styles/myAccountStyles';
import type { ProfileEditorProps } from '../model/myAccountTypes';
// 프로필 수정 창의 제목·입력 영역·오류·저장 행동을 같은 모달 수명으로 배치한다.
export function renderProfileEditor({
  isProfileEditModalOpen,
  closeProfileEditModal,
  isSavingProfile,
  editNickname,
  setEditNickname,
  currentUser,
  editBio,
  setEditBio,
  editTravelStyles,
  handleToggleTravelStyle,
  profileError,
  handleSaveProfile,
}: ProfileEditorProps) {
  return (
    <Modal
      visible={isProfileEditModalOpen}
      accessibilityLabel={t('개인 프로필 수정')}
      blockNavigation={false}
      animationType="slide"
      transparent
      onRequestClose={closeProfileEditModal}
    >
      <View style={styles.modalOverlay}>
        <ScrollView
          style={styles.modalCard}
          contentContainerStyle={{ padding: 20, gap: 12 }}
          keyboardShouldPersistTaps="handled"
        >
          <ScreenHeader
            inset={false}
            title={t('개인 프로필 수정')}
            backLabel={t('프로필 수정 닫기')}
            onBack={closeProfileEditModal}
            disabled={isSavingProfile}
          />
          <Text style={styles.modalDesc}>
            {t('닉네임과 소개, 좋아하는 여행 스타일을 적어보세요.')}
          </Text>

          <ProfileNicknameField
            editNickname={editNickname}
            isSavingProfile={isSavingProfile}
            setEditNickname={setEditNickname}
            currentUser={currentUser}
            showError={Boolean(profileError)}
          />

          <ProfileBioField
            editBio={editBio}
            isSavingProfile={isSavingProfile}
            setEditBio={setEditBio}
          />

          <ProfileTravelStylesField
            editTravelStyles={editTravelStyles}
            isSavingProfile={isSavingProfile}
            handleToggleTravelStyle={handleToggleTravelStyle}
          />

          {profileError &&
          validProfileNickname(editNickname, currentUser?.nickname) ? (
            <Text accessibilityRole="alert" style={{ color: colors.danger }}>
              {t(profileError)}
            </Text>
          ) : null}
          {/* 저장 CTA 버튼 */}
          <DesignButton
            label={isSavingProfile ? t('저장 중...') : t('프로필 저장하기')}
            variant="primary"
            loading={isSavingProfile}
            disabled={!currentUser}
            onPress={handleSaveProfile}
            icon={(color) => {
              /* 저장 완료 행동에 공통 전경색을 적용한다. */ return (
                <Ionicons
                  name="checkmark-circle-outline"
                  size={18}
                  color={color}
                />
              );
            }}
          />
        </ScrollView>
      </View>
    </Modal>
  );
}
