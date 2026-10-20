import Text from '@/components/AppText';
import HaruState from '@/components/HaruState';
import { colors } from '@/constants/theme';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ModalBackground from '../accessibility/ModalBackground';
import { authReturn } from '../auth/authReturn';
import HomeScreen from './HomeScreen';
import PlanEditor from './PlanEditor';
import TripAccessFeedback from './TripAccessFeedback';
import { TripSectionNavigation } from './TripSectionNavigation';
import WorkspaceConfirmDialog from './WorkspaceConfirmDialog';
import {
  renderWorkspaceAddSchedule,
  renderWorkspaceEditDialog,
  renderWorkspaceMoreMenu,
  renderWorkspaceReceiptCapture,
} from './WorkspaceDialogs';
import {
  renderWorkspaceCapture,
  renderWorkspaceChecklist,
  renderWorkspaceCourse,
  renderWorkspaceExpenses,
  renderWorkspaceHeader,
  renderWorkspaceItinerary,
  renderWorkspaceMap,
  renderWorkspaceMembers,
  renderWorkspacePhotos,
  renderWorkspaceSharing,
  renderWorkspaceSummary,
} from './WorkspaceSections';
import { tripDetailStyles as detail } from './tripDetailStyles';
import { tripHubStyles as hub } from './tripHubStyles';
import { Action } from './ui';
import { workspaceError } from './workspaceFailure';
import { styles } from './workspaceStyles';

import type { useWorkspaceController } from './useWorkspaceController';

// 준비된 상태·행동을 배치하며 서버 요청과 멱등·충돌 정책은 컨트롤러가 처리한다.
export default function WorkspaceView(
  props: ReturnType<typeof useWorkspaceController>,
) {
  // 같은 화면 수명의 상태를 영역별 표현 함수에 전달한다.
  const {
    id,
    userId,
    form,
    busy,
    scanning,
    confirmation,
    hasPending,
    error,
    feedback,
    trips,
    reload,
    save,
    invalidForm,
    change,
    closeCreation,
    creating,
  } = props;

  // 새 여행 작성 폼을 독립된 페이지로 표시한다.
  if (!id && !creating)
    return (
      <HomeScreen
        userId={userId}
        trips={trips.data}
        loading={trips.isLoading}
        error={trips.error ? workspaceError(trips.error, 'read') : ''}
        onReload={reload}
      />
    );
  // 홈에서 고른 목적지로 인증된 계정의 여행 생성을 시작한다.
  if (creating && userId)
    return (
      <PlanEditor
        userId={userId}
        form={form}
        busy={busy}
        locked={busy || scanning || hasPending || Boolean(confirmation)}
        feedback={feedback}
        onInvalid={invalidForm}
        error={error}
        onChange={change}
        onSave={save}
        onReload={reload}
        onClose={closeCreation}
        onRescan={() => {
          // 여행 생성 화면에는 재스캔할 원본이 없다.
          return undefined;
        }}
        onReceipt={() => {
          // 여행 생성 페이지에서는 영수증을 등록하지 않는다.
          return;
        }}
      />
    );
  // 저장된 실제 자료만 화면에 표시한다.
  return renderWorkspaceLayout(props);
}

// 여행 상세의 표시 틀과 영역별 표현을 배치한다.
function renderWorkspaceLayout(
  props: ReturnType<typeof useWorkspaceController>,
) {
  // 조회·저장 상태는 같은 컨트롤러의 값으로만 표시한다.
  const {
    user,
    id,
    destination,
    router,
    userId,
    form,
    busy,
    confirmation,
    hasPending,
    error,
    activeSection,
    setActiveSection,
    trips,
    workspace,
    snapshot,
    writable,
    reload,
    cancelConfirmation,
    confirmCommand,
    retrySave,
    reloadLabel,
    creating,
    importing,
  } = props;
  return (
    <SafeAreaView style={hub.screen}>
      <ModalBackground>
        {renderWorkspaceHeader({ ...props, snapshot })}
        <ScrollView
          testID="trip-content"
          contentContainerStyle={hub.content}
          keyboardShouldPersistTaps="handled"
        >
          {user?.authProvider === 'guest' && (
            <View style={styles.card}>
              <Text>
                게스트 여행은 이 기기에만 저장돼요. 다른 기기에서는 볼 수 없으며
                앱이나 저장 데이터를 삭제하면 복구할 수 없어요.
              </Text>
              <Action
                label="로그인 / 회원가입"
                onPress={() => {
                  // 기기 여행을 자동 업로드하지 않고 회원 인증을 선택하게 한다.
                  return router.push('/login');
                }}
              />
            </View>
          )}
          {!userId ? (
            <View style={styles.card}>
              <Text style={styles.title}>로그인하고 여행을 시작하세요</Text>
              <Text>
                로그인하면 여행을 저장하고 친구와 함께 계획할 수 있어요.
              </Text>
              <Action
                label="로그인 / 회원가입"
                onPress={() => {
                  // 실제 인증 화면으로 이동한다.
                  return router.push(
                    creating
                      ? {
                          pathname: '/login',
                          params: {
                            next: 'new-trip',
                            destination: destination || '',
                          },
                        }
                      : {
                          pathname: '/login',
                          params: authReturn('trip', undefined, id),
                        },
                  );
                }}
              />
            </View>
          ) : (
            <>
              {(trips.isLoading || workspace.isLoading) && (
                <HaruState
                  kind="loading"
                  title="여행을 불러오는 중입니다."
                  compact
                />
              )}
              {(trips.error || workspace.error) && (
                <TripAccessFeedback
                  error={trips.error || workspace.error}
                  target={authReturn('trip', undefined, id)}
                  onRetry={reload}
                  busy={trips.isFetching || workspace.isFetching}
                />
              )}
              {snapshot && !workspace.isError && (
                <>
                  {importing && !writable && (
                    <Text accessibilityRole="alert" style={styles.error}>
                      읽기 전용 또는 보관된 여행에는 장소를 추가할 수 없습니다.
                      편집 가능한 여행을 선택해 주세요.
                    </Text>
                  )}
                  {renderWorkspaceSummary({ ...props, snapshot })}
                  <TripSectionNavigation
                    selected={activeSection}
                    onSelect={setActiveSection}
                  />
                  {busy && !form && (
                    <View
                      style={[detail.card, detail.heading]}
                      accessibilityLiveRegion="polite"
                    >
                      <ActivityIndicator color={colors.text} size="small" />
                      <Text style={detail.meta}>여행에 반영하고 있어요…</Text>
                    </View>
                  )}
                  {renderWorkspaceMap({ ...props, snapshot })}
                  {renderWorkspaceItinerary({ ...props, snapshot })}
                  {renderWorkspaceCapture(props)}
                  {activeSection === 'itinerary' && (
                    <Action
                      label="Google Maps 장소 가져오기"
                      variant="quiet"
                      onPress={() => {
                        // 장소의 공유 링크를 가져오는 실제 도구를 연다.
                        return router.push('/import-place');
                      }}
                    />
                  )}
                  {renderWorkspaceExpenses({ ...props, snapshot })}
                  {renderWorkspacePhotos({ ...props, snapshot })}
                  {renderWorkspaceChecklist({ ...props, snapshot })}
                  {renderWorkspaceMembers({ ...props, snapshot })}
                  {renderWorkspaceSharing({ ...props, snapshot })}
                </>
              )}
            </>
          )}
          {error && !form && (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          )}
          {hasPending && !busy && (
            <Action
              label="다시 저장하기"
              onPress={() => {
                // 저장 여부가 불확실한 요청을 중복 생성하지 않는다.
                return retrySave();
              }}
            />
          )}
          {error && !form && (
            <Action label={reloadLabel} disabled={busy} onPress={reload} />
          )}
          {busy && form && (
            <Text style={detail.meta} accessibilityLiveRegion="polite">
              여행에 반영하고 있어요…
            </Text>
          )}
        </ScrollView>
        {snapshot &&
          !workspace.isError &&
          activeSection === 'itinerary' &&
          writable &&
          !form &&
          renderWorkspaceAddSchedule(props)}
      </ModalBackground>
      {renderWorkspaceMoreMenu(props)}
      {renderWorkspaceCourse({ ...props, snapshot })}
      {renderWorkspaceReceiptCapture(props)}
      <WorkspaceConfirmDialog
        userId={userId}
        confirmation={confirmation}
        onConfirm={confirmCommand}
        onCancel={cancelConfirmation}
      />
      {renderWorkspaceEditDialog(props)}
    </SafeAreaView>
  );
}
