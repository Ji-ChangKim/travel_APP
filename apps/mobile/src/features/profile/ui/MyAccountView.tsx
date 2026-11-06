import Text from '@/components/ui/AppText';
import { onGnbScroll } from '@/components/navigation/navigationScroll';
import ScreenHeader from '@/components/navigation/ScreenHeader';
import { colors } from '@/constants/theme';
import ModalBackground from '@/features/accessibility/ModalBackground';
import { t } from '@/features/localization/translate';
import { Action } from '@/features/workspace/shared/ui/ui';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { renderAccountProfile } from './AccountProfileCard';
import {
  MyAccountArchiveMenu,
  MyAccountGuestNotice,
  MyAccountSettingsMenu,
} from './MyAccountMenus';
import { renderAccountStatistics } from './MyAccountStatistics';
import { styles } from '../styles/myAccountStyles';
import type { MyAccountViewProps } from '../model/myAccountTypes';
import { renderProfileEditor } from './ProfileEditor';
// 개인 프로필·통계·설정 진입과 편집 창을 조립한다.
export function renderAccountContent({
  profileNotice,
  largeText,
  currentUser,
  userId,
  isSavingProfile,
  openProfileEditModal,
  router,
  serverTrips,
  isProfileEditModalOpen,
  closeProfileEditModal,
  editNickname,
  setEditNickname,
  editBio,
  setEditBio,
  editTravelStyles,
  handleToggleTravelStyle,
  profileError,
  handleSaveProfile,
}: MyAccountViewProps) {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <ModalBackground>
        <ScreenHeader
          title="MY"
          actions={[
            {
              label: t('설정'),
              disabled: isSavingProfile,
              onPress: () => {
                // 프로필과 분리된 전용 설정 화면으로 이동한다.
                return router.push('/settings');
              },
            },
          ]}
        />
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          onScroll={onGnbScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={
                Boolean(userId) &&
                !serverTrips.isPending &&
                serverTrips.isRefetching
              }
              onRefresh={() => {
                if (userId) void serverTrips.refetch();
              }}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          {profileNotice ? (
            <Text accessibilityRole="alert" style={{ color: colors.text }}>
              {t(profileNotice)}
            </Text>
          ) : null}
          {/* 사용자 프로필 카드 */}
          {renderAccountProfile({
            largeText,
            currentUser,
            userId,
            isSavingProfile,
            openProfileEditModal,
          })}

          <MyAccountGuestNotice currentUser={currentUser} router={router} />

          {/* 여행 활동 통계 요약 (클릭 시 각 보관함으로 이동) */}
          {renderAccountStatistics({ userId, serverTrips, router })}
          {userId && serverTrips.isError && (
            <View style={styles.card}>
              <Text accessibilityRole="alert" style={styles.settingDesc}>
                {t('여행 통계를 불러오지 못했어요. 다시 시도해 주세요.')}
              </Text>
              <Action
                label={t('여행 통계 다시 불러오기')}
                onPress={() => {
                  // 실패한 계정 통계 요청만 다시 실행한다.
                  return void serverTrips.refetch();
                }}
              />
            </View>
          )}
          {userId && serverTrips.isPending && (
            <Text style={styles.settingDesc}>
              {t('나의 여행을 불러오고 있어요.')}
            </Text>
          )}

          {/* 나의 여행 보관함 바로가기 (네이티브 리스트 행 UI) */}
          <MyAccountArchiveMenu router={router} />

          {/* 앱 설정 및 계정 관리 진입 메뉴 (네이티브 리스트 행 UI) */}
          <MyAccountSettingsMenu
            router={router}
            isSavingProfile={isSavingProfile}
          />
        </ScrollView>
      </ModalBackground>
      {/* 개인 프로필 수정 모달 */}
      {renderProfileEditor({
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
      })}
    </SafeAreaView>
  );
}
export { renderAccountProfile } from './AccountProfileCard';
export { styles } from '../styles/myAccountStyles';
export { renderProfileEditor } from './ProfileEditor';
export { TRAVEL_STYLE_OPTIONS } from './ProfileFields';
