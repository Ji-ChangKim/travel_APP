import Text from '@/components/ui/AppText';
import DesignButton from '@/components/ui/DesignButton';
import { colors } from '@/constants/theme';
import { t } from '@/features/localization/translate';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { styles } from '../styles/myAccountStyles';
import type { AccountProfileProps } from '../model/myAccountTypes';
// 현재 계정의 닉네임·소개·여행 스타일과 편집 진입을 표시한다.
export function renderAccountProfile({
  largeText,
  currentUser,
  userId,
  isSavingProfile,
  openProfileEditModal,
}: AccountProfileProps) {
  return (
    <View style={styles.profileCard}>
      <View
        style={[
          styles.profileCardHeader,
          largeText && styles.profileCardHeaderLarge,
        ]}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(currentUser?.nickname || '나')[0]}
          </Text>
        </View>
        <View style={styles.profileInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.userName}>
              {currentUser?.nickname || t('여행자')}
            </Text>
            <View style={styles.authBadge}>
              <Text style={styles.authBadgeText}>
                {currentUser?.authProvider === 'guest'
                  ? t('게스트')
                  : t('Google 계정')}
              </Text>
            </View>
          </View>
          <Text style={styles.userEmail}>
            {currentUser?.authProvider === 'guest'
              ? t('게스트 여행은 이 기기에만 보관합니다')
              : userId
                ? t('여행과 기록을 Google 계정에 보관합니다')
                : t('로그인 후 이용해 주세요')}
          </Text>
        </View>
        <DesignButton
          label={t('수정')}
          accessibilityLabel={t('프로필 수정')}
          size="chip"
          variant="quiet"
          disabled={isSavingProfile}
          onPress={openProfileEditModal}
          icon={(color) => {
            return <Ionicons name="pencil" size={18} color={color} />;
          }}
        />
      </View>

      {/* 한 줄 자기소개 */}
      {currentUser?.bio ? (
        <View style={styles.bioContainer}>
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={14}
            color={colors.muted}
          />
          <Text style={styles.bioText}>{currentUser.bio}</Text>
        </View>
      ) : null}

      {/* 선호 여행 스타일 태그 목록 */}
      {currentUser?.travelStyles && currentUser.travelStyles.length > 0 ? (
        <View style={styles.travelStylesWrap}>
          {currentUser.travelStyles.map((style) => (
            <View key={style} style={styles.travelStyleChip}>
              <Text style={styles.travelStyleChipText}>#{style}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
