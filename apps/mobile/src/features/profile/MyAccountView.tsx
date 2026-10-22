import ActionSheet from '@/components/ActionSheet';
import Modal from '@/components/AppModal';
import Text from '@/components/AppText';
import DesignButton from '@/components/DesignButton';
import TextInput from '@/components/DesignInput';
import ScreenHeader from '@/components/ScreenHeader';
import { colors } from '@/constants/theme';
import ModalBackground from '@/features/accessibility/ModalBackground';
import { tripPhase } from '@/features/workspace/tripLifecycle';
import { Action } from '@/features/workspace/ui';
import { Ionicons } from '@expo/vector-icons';
import { type UseQueryResult } from '@tanstack/react-query';
import type { PersistedTrip, Profile, Trip, Visit } from '@wherego/domain';
import {
  nicknameError,
  nicknameHint,
  validProfileNickname,
} from '@wherego/validation';
import { type ImperativeRouter } from 'expo-router';
import { type Dispatch, type SetStateAction } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styles } from './myAccountStyles';
import { onGnbScroll } from '@/components/navigationScroll';

// 여행 스타일 선택 옵션 목록을 정의한다.
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
// renderAccountContent이 읽는 값과 실행 가능한 행동의 계약이다.
type RenderAccountContentProps = {
  profileNotice: string;
  largeText: boolean;
  currentUser: Profile | null;
  userId: string;
  isSavingProfile: boolean;
  openProfileEditModal: () => undefined;
  router: ImperativeRouter;
  serverTrips: UseQueryResult<PersistedTrip[], Error>;
  trips: Trip[];
  visits: Visit[];
  logoutBusy: boolean;
  handleLogout: () => undefined;
  isProfileEditModalOpen: boolean;
  closeProfileEditModal: () => void;
  editNickname: string;
  setEditNickname: Dispatch<SetStateAction<string>>;
  editBio: string;
  setEditBio: Dispatch<SetStateAction<string>>;
  editTravelStyles: string[];
  handleToggleTravelStyle: (tag: string) => void;
  profileError: string;
  handleSaveProfile: () => void;
  logoutOpen: boolean;
  setLogoutOpen: Dispatch<SetStateAction<boolean>>;
  logoutError: string;
  confirmLogout: () => void;
};

// 개인 계정 화면의 통계와 설정을 배치한다.
export function renderAccountContent({
  profileNotice,
  largeText,
  currentUser,
  userId,
  isSavingProfile,
  openProfileEditModal,
  router,
  serverTrips,
  trips,
  visits,
  logoutBusy,
  handleLogout,
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
  logoutOpen,
  setLogoutOpen,
  logoutError,
  confirmLogout,
}: RenderAccountContentProps) {
  // 전달받은 값과 행동을 기존 화면 규격으로 표시한다.

  return (
    <SafeAreaView style={styles.screen}>
      <ModalBackground>
        <ScreenHeader title="MY" />
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          onScroll={onGnbScroll}
          scrollEventThrottle={16}
        >
          {profileNotice ? (
            <Text accessibilityRole="alert" style={{ color: colors.text }}>
              {profileNotice}
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

          {currentUser?.authProvider === 'guest' && (
            <View style={styles.card}>
              <Text style={styles.settingTitle}>
                게스트 여행을 내 계정에 연결하기
              </Text>
              <Text style={styles.settingDesc}>
                회원가입 후에는 새 여행을 계정에 보관할 수 있어요. 기존 게스트
                여행은 이 기기에 남으며 자동으로 다른 기기에 옮겨지지 않아요.
              </Text>
              <Action
                label="로그인 / 회원가입"
                variant="primary"
                onPress={() => {
                  // 게스트 세션을 유지한 채 실제 계정 인증을 시작한다.
                  return router.push('/login');
                }}
              />
            </View>
          )}

          {/* 여행 활동 통계 요약 */}
          {renderAccountStatistics({ userId, serverTrips, router })}
          {userId && serverTrips.isError && (
            <View style={styles.card}>
              <Text accessibilityRole="alert" style={styles.settingDesc}>
                여행 통계를 불러오지 못했어요. 다시 시도해 주세요.
              </Text>
              <Action
                label="여행 통계 다시 불러오기"
                onPress={() => {
                  // 실패한 계정 통계 요청만 다시 실행한다.
                  return void serverTrips.refetch();
                }}
              />
            </View>
          )}
          {userId && serverTrips.isPending && (
            <Text style={styles.settingDesc}>나의 여행을 불러오고 있어요.</Text>
          )}

          {/* 사용자가 확인할 앱 버전만 표시한다. */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>앱 정보</Text>
            <View style={styles.card}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>앱 버전</Text>
                <Text style={styles.infoValue}>v0.1.0</Text>
              </View>
              {(trips.length > 0 || visits.length > 0) && (
                <Action
                  label="이 기기에 저장한 이전 기록 보기"
                  onPress={() => {
                    // 기존 기기 기록이 실제로 있는 경우에만 보존 화면을 제공한다.
                    return router.push('/local-records');
                  }}
                />
              )}
            </View>
          </View>

          <View style={styles.accountActions}>
            <Action
              label="계정 관리"
              onPress={() => {
                // 탈퇴는 주 여행 화면 대신 본인 계정 관리 안에서 확인한다.
                return router.push('/account');
              }}
            />
            {/* 로그아웃 버튼 */}
            <DesignButton
              label="로그아웃"
              variant="danger"
              disabled={isSavingProfile || logoutBusy}
              onPress={handleLogout}
              icon={(color) => {
                /* 로그아웃은 위험 행동의 대비를 유지한다. */ return (
                  <Ionicons name="log-out-outline" size={18} color={color} />
                );
              }}
            />
          </View>
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
      <ActionSheet
        variant="confirm"
        visible={logoutOpen}
        title="로그아웃할까요?"
        dismissDisabled={logoutBusy}
        onClose={() => {
          // 취소는 현재 계정과 여행 접근을 유지한다.
          return setLogoutOpen(false);
        }}
      >
        <Text>
          계정에 저장한 여행은 같은 계정으로 다시 로그인하면 볼 수 있어요.
        </Text>
        {logoutError ? (
          <Text accessibilityRole="alert" style={{ color: colors.danger }}>
            {logoutError}
          </Text>
        ) : null}
        <Action
          label="계속 이용하기"
          disabled={logoutBusy}
          onPress={() => {
            // 로그아웃 요청 없이 계정 화면으로 돌아간다.
            return setLogoutOpen(false);
          }}
        />
        <Action
          label={logoutBusy ? '로그아웃 중…' : '로그아웃'}
          variant="primary"
          loading={logoutBusy}
          onPress={confirmLogout}
        />
      </ActionSheet>
    </SafeAreaView>
  );
}
// renderProfileEditor이 읽는 값과 실행 가능한 행동의 계약이다.
type RenderProfileEditorProps = {
  isProfileEditModalOpen: boolean;
  closeProfileEditModal: () => void;
  isSavingProfile: boolean;
  editNickname: string;
  setEditNickname: Dispatch<SetStateAction<string>>;
  currentUser: Profile | null;
  editBio: string;
  setEditBio: Dispatch<SetStateAction<string>>;
  editTravelStyles: string[];
  handleToggleTravelStyle: (tag: string) => void;
  profileError: string;
  handleSaveProfile: () => void;
};

// 회원의 실제 여행 건수와 조회 상태를 표시한다.
function renderAccountStatistics({
  userId,
  serverTrips,
  router,
}: {
  userId: string;
  serverTrips: UseQueryResult<PersistedTrip[], Error>;
  router: ImperativeRouter;
}): import('react').ReactNode {
  // 전달받은 값과 행동을 기존 화면 규격으로 표시한다.

  return userId ? (
    <View style={styles.summaryBox}>
      <View style={styles.summaryItem}>
        <Text style={styles.summaryNum}>
          {serverTrips.isSuccess ? serverTrips.data.length : '—'}
        </Text>
        <Text style={styles.summaryText}>총 여행</Text>
      </View>
      <View style={styles.summaryDivider} />
      <View style={styles.summaryItem}>
        <Text style={styles.summaryNum}>
          {serverTrips.isSuccess
            ? serverTrips.data.filter((trip) => {
                // 앞으로 떠날 여행만 예정 통계에 포함한다.
                return (
                  trip.status !== 'ARCHIVED' &&
                  ['PLANNED', 'DRAFT'].includes(tripPhase(trip))
                );
              }).length
            : '—'}
        </Text>
        <Text style={styles.summaryText}>예정된 여행</Text>
      </View>
      <View style={styles.summaryDivider} />
      <View style={styles.summaryItem}>
        <Text style={styles.summaryNum}>
          {serverTrips.isSuccess
            ? serverTrips.data.filter((trip) => {
                // 발자국 목록과 동일하게 완료 여행만 집계한다.
                return (
                  trip.status !== 'ARCHIVED' && tripPhase(trip) === 'COMPLETED'
                );
              }).length
            : '—'}
        </Text>
        <Text style={styles.summaryText}>완성된 발자국</Text>
      </View>
    </View>
  ) : (
    <View style={styles.card}>
      <Text style={styles.settingTitle}>나의 여행을 한곳에</Text>
      <Text style={styles.settingDesc}>
        로그인하면 여행 계획을 저장하고 친구와 함께 작성할 수 있어요.
      </Text>
      <Action
        label="로그인 / 회원가입"
        variant="primary"
        onPress={() => {
          // 실제 계정 인증 화면으로 이동한다.
          return router.push('/login');
        }}
      />
    </View>
  );
}

// 프로필 입력과 저장·닫기 행동을 표시한다.
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
}: RenderProfileEditorProps) {
  // 전달받은 값과 행동을 기존 화면 규격으로 표시한다.

  return (
    <Modal
      visible={isProfileEditModalOpen}
      accessibilityLabel="개인 프로필 수정"
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
            title="개인 프로필 수정"
            backLabel="프로필 수정 닫기"
            onBack={closeProfileEditModal}
            disabled={isSavingProfile}
          />
          <Text style={styles.modalDesc}>
            닉네임과 소개, 좋아하는 여행 스타일을 적어보세요.
          </Text>

          {/* 닉네임 입력 */}
          <View style={styles.editInputGroup}>
            <Text style={styles.editInputLabel}>닉네임</Text>
            <TextInput
              style={styles.modalTextInput}
              value={editNickname}
              editable={!isSavingProfile}
              onChangeText={setEditNickname}
              accessibilityLabel="닉네임"
              placeholder="닉네임 입력"
              placeholderTextColor={colors.mutedLight}
            />
            <Text style={styles.inputHint}>{nicknameHint}</Text>
            {!validProfileNickname(editNickname, currentUser?.nickname) ? (
              <Text
                accessibilityRole="alert"
                style={[styles.editInputLabel, { color: colors.danger }]}
              >
                {nicknameError}
              </Text>
            ) : null}
          </View>

          {/* 한 줄 소개 입력 */}
          <View style={styles.editInputGroup}>
            <Text style={styles.editInputLabel}>한 줄 소개 (소개글)</Text>
            <TextInput
              style={[styles.modalTextInput, styles.bioInput]}
              value={editBio}
              editable={!isSavingProfile}
              onChangeText={setEditBio}
              accessibilityLabel="한 줄 소개"
              placeholder="예: 힐링과 맛집 탐방을 사랑하는 여행자입니다 :)"
              placeholderTextColor={colors.mutedLight}
              multiline
              numberOfLines={2}
              maxLength={80}
            />
          </View>

          {/* 여행 스타일 태그 선택 */}
          <View style={styles.editInputGroup}>
            <Text style={styles.editInputLabel}>
              나의 여행 스타일 (다중 선택)
            </Text>
            <View style={styles.tagSelectWrap}>
              {TRAVEL_STYLE_OPTIONS.map((tag) => {
                // 여러 여행 스타일을 독립된 체크 상태로 선택한다.
                const isSelected = editTravelStyles.includes(tag);
                return (
                  <DesignButton
                    key={tag}
                    label={tag}
                    size="chip"
                    checked={isSelected}
                    disabled={isSavingProfile}
                    onPress={() => {
                      /* 선택한 여행 스타일 하나만 토글한다. */ return handleToggleTravelStyle(
                        tag,
                      );
                    }}
                  />
                );
              })}
            </View>
          </View>

          {profileError &&
          validProfileNickname(editNickname, currentUser?.nickname) ? (
            <Text accessibilityRole="alert" style={{ color: colors.danger }}>
              {profileError}
            </Text>
          ) : null}
          {/* 저장 CTA 버튼 */}
          <DesignButton
            label={isSavingProfile ? '저장 중...' : '프로필 저장하기'}
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
// renderAccountProfile이 읽는 값과 실행 가능한 행동의 계약이다.
type RenderAccountProfileProps = {
  largeText: boolean;
  currentUser: Profile | null;
  userId: string;
  isSavingProfile: boolean;
  openProfileEditModal: () => undefined;
};

// 현재 계정의 프로필과 편집 진입을 표시한다.
export function renderAccountProfile({
  largeText,
  currentUser,
  userId,
  isSavingProfile,
  openProfileEditModal,
}: RenderAccountProfileProps) {
  // 전달받은 값과 행동을 기존 화면 규격으로 표시한다.

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
              {currentUser?.nickname || '여행자'}
            </Text>
            <View style={styles.authBadge}>
              <Text style={styles.authBadgeText}>
                {currentUser?.authProvider === 'guest' ? '게스트' : '내 계정'}
              </Text>
            </View>
          </View>
          <Text style={styles.userEmail}>
            {currentUser?.authProvider === 'guest'
              ? '게스트 여행은 이 기기에만 보관합니다'
              : userId
                ? '여행과 기록을 계정에 보관합니다'
                : '로그인 전 둘러보기 중입니다'}
          </Text>
        </View>
        <DesignButton
          label="수정"
          accessibilityLabel="프로필 수정"
          size="chip"
          variant="quiet"
          disabled={isSavingProfile}
          onPress={openProfileEditModal}
          icon={(color) => {
            /* 수정 아이콘에 버튼 상태색을 적용한다. */ return (
              <Ionicons name="pencil" size={18} color={color} />
            );
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

export { styles } from './myAccountStyles';
