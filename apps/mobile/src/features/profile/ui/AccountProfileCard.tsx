import { Ionicons } from '@expo/vector-icons';
import Text from '@/components/ui/AppText';
import { t } from '@/features/localization/translate';
import { Image, View, type ImageSourcePropType } from 'react-native';
import type { ReactNode } from 'react';
import { styles } from '../styles/myAccountStyles';
import type { AccountProfileProps } from '../model/myAccountTypes';

// 기본 프로필(프로필 이미지/이니셜 + 닉네임 + 회원 종류 배지)을 간결한 카드 형태로 표시한다.
export function renderAccountProfile({
  largeText,
  currentUser,
  imageSource,
  children,
}: AccountProfileProps & {
  imageSource?: ImageSourcePropType;
  children?: ReactNode;
}) {
  const guest = currentUser?.authProvider === 'guest';
  const displayName = currentUser?.nickname?.trim() || t('여행자');
  const initialChar = (
    guest ? 'G' : displayName.slice(0, 1) || 'G'
  ).toUpperCase();

  return (
    <View style={styles.profileCard} testID="account-default-profile">
      <View
        style={[
          styles.profileCardHeader,
          largeText && styles.profileCardHeaderLarge,
        ]}
      >
        {imageSource ? (
          <Image
            source={imageSource}
            style={[styles.profileAvatarImage, { borderRadius: 28 }]}
            accessibilityLabel={t('내 프로필 사진')}
          />
        ) : (
          <View
            style={styles.guestInitialCircle}
            accessibilityLabel={t('기본 프로필 이미지')}
          >
            {guest ? (
              <Ionicons name="person" size={26} color="#FFFFFF" aria-hidden />
            ) : (
              <Text style={styles.guestInitialText}>{initialChar}</Text>
            )}
          </View>
        )}
        <View style={styles.profileInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.userName}>{displayName}</Text>
            <View style={styles.guestPillBadge}>
              <Text style={styles.guestPillBadgeText}>
                {t(
                  guest
                    ? '게스트'
                    : currentUser?.authProvider === 'google'
                      ? 'Google 계정'
                      : '회원 계정',
                )}
              </Text>
            </View>
          </View>
        </View>
      </View>
      {children}
    </View>
  );
}
