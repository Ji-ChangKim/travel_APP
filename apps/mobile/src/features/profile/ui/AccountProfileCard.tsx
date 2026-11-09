import Text from '@/components/ui/AppText';
import { t } from '@/features/localization/translate';
import { Image, View, type ImageSourcePropType } from 'react-native';
import type { ReactNode } from 'react';
import { styles } from '../styles/myAccountStyles';
import type { AccountProfileProps } from '../model/myAccountTypes';

// 기본 프로필은 읽기 전용이며 회원 종류를 확인한 범위에서만 표시한다.
export function renderAccountProfile({
  largeText,
  currentUser,
  userId,
  imageSource,
  children,
}: AccountProfileProps & {
  imageSource?: ImageSourcePropType;
  children?: ReactNode;
}) {
  const guest = currentUser?.authProvider === 'guest';
  return (
    <View style={styles.profileCard} testID="account-default-profile">
      <View
        style={[
          styles.profileCardHeader,
          largeText && styles.profileCardHeaderLarge,
        ]}
      >
        <Image
          source={
            imageSource ||
            require('../../../../assets/brand/haru-v1/TripPrint_Haru_loading_1233x1275.png')
          }
          style={styles.profileAvatarImage}
          accessibilityLabel={t(
            imageSource ? '내 프로필 사진' : '기본 프로필 이미지',
          )}
        />
        <View style={styles.profileInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.userName}>
              {currentUser?.nickname?.trim() || t('여행자')}
            </Text>
            <View style={styles.authBadge}>
              <Text style={styles.authBadgeText}>
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
          <Text style={styles.userEmail}>
            {t(
              guest
                ? '게스트 여행은 이 기기에만 보관합니다'
                : userId
                  ? '계정에 저장한 여행과 기록을 확인해요.'
                  : '로그인 후 이용해 주세요',
            )}
          </Text>
        </View>
      </View>
      {children}
    </View>
  );
}
