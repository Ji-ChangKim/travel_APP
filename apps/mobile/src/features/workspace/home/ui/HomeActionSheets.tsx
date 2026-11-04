import { useRef, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import type { PersistedTrip } from '@wherego/domain';
import ActionSheet from '@/components/ui/ActionSheet';
import Text from '@/components/ui/AppText';
import DesignButton from '@/components/ui/DesignButton';
import HaruState from '@/components/feedback/HaruState';
import { t } from '@/features/localization/translate';
import { openGuideSource } from '../../community/manager/openGuideSource';
import LegacyDraftImport from '../../planning/ui/LegacyDraftImport';
import { OFFICIAL_TRANSPORT_GUIDES } from '../model/homeConciergeCatalog';
import { homeTravelStyles as s } from '../styles/homeTravelStyles';
import HomeDraftResume from './HomeDraftResume';

// 영수증·체크리스트·현지 비상/교통·초안 관리 바텀시트를 한곳에서 제어한다.
export default function HomeActionSheets({
  userId,
  ready,
  loading,
  tripsError,
  tripsData,
  onRefetchTrips,
  receiptSelection,
  setReceiptSelection,
  checklistSelection,
  setChecklistSelection,
  safetySheetOpen,
  setSafetySheetOpen,
  expanded,
  setExpanded,
  onCreate,
}: {
  userId: string;
  ready: boolean;
  loading: boolean;
  tripsError: boolean;
  tripsData: PersistedTrip[];
  onRefetchTrips: () => void;
  receiptSelection: boolean;
  setReceiptSelection: (value: boolean) => void;
  checklistSelection: boolean;
  setChecklistSelection: (value: boolean) => void;
  safetySheetOpen: boolean;
  setSafetySheetOpen: (value: boolean) => void;
  expanded: boolean;
  setExpanded: (value: boolean) => void;
  onCreate: () => void;
}) {
  // 보관되지 않은 활성 여행 목록만 필터링해 하위 시트에 전달한다.
  const activeTrips = tripsData.filter((trip) => {
    // 보관 상태가 아닌 여행만 선택 대상으로 남긴다.
    return trip.status !== 'ARCHIVED';
  });
  return (
    <>
      <ReceiptSelectSheet
        visible={receiptSelection}
        userId={userId}
        ready={ready}
        loading={loading}
        tripsError={tripsError}
        activeTrips={activeTrips}
        onRefetchTrips={onRefetchTrips}
        onClose={() => {
          // 영수증 여행 선택 시트를 닫는다.
          setReceiptSelection(false);
        }}
        onCreate={onCreate}
      />
      <ChecklistSelectSheet
        visible={checklistSelection}
        activeTrips={activeTrips}
        onClose={() => {
          // 체크리스트 시트를 닫는다.
          setChecklistSelection(false);
        }}
        onCreate={onCreate}
      />
      <OfficialSafetySheet
        visible={safetySheetOpen}
        onClose={() => {
          // 공식 교통·비상 안내 시트를 닫는다.
          setSafetySheetOpen(false);
        }}
      />
      <DraftManageSheet
        visible={expanded}
        userId={userId}
        onClose={() => {
          // 작성 중인 계획 관리 시트를 닫는다.
          setExpanded(false);
        }}
      />
    </>
  );
}

// 영수증·비용을 기록할 대상 여행을 선택하는 바텀시트를 렌더링한다.
function ReceiptSelectSheet({
  visible,
  userId,
  ready,
  loading,
  tripsError,
  activeTrips,
  onRefetchTrips,
  onClose,
  onCreate,
}: {
  visible: boolean;
  userId: string;
  ready: boolean;
  loading: boolean;
  tripsError: boolean;
  activeTrips: PersistedTrip[];
  onRefetchTrips: () => void;
  onClose: () => void;
  onCreate: () => void;
}) {
  // 라우터를 통해 로그인·여행 비용 섹션·새 여행 생성으로 연결한다.
  const router = useRouter();
  return (
    <ActionSheet
      visible={visible}
      title={t('기록할 여행 선택')}
      onClose={onClose}
    >
      <Text style={s.body}>
        {t(
          '여행의 비용 화면에서 영수증을 등록하고 방문 기록을 확인할 수 있어요.',
        )}
      </Text>
      {!userId && ready ? (
        <DesignButton
          label={t('로그인하고 내 여행 찾기')}
          onPress={() => {
            // 비로그인 상태에서는 로그인 페이지로 연결한다.
            onClose();
            router.push({ pathname: '/login', params: { next: 'plans' } });
          }}
        />
      ) : loading ? (
        <HaruState kind="loading" title={t('내 여행 불러오는 중…')} compact />
      ) : tripsError ? (
        <DesignButton
          label={t('내 여행 다시 불러오기')}
          onPress={onRefetchTrips}
        />
      ) : activeTrips.length ? (
        activeTrips.map((trip) => {
          // 선택한 여행의 가계부·영수증 섹션으로 이동한다.
          return (
            <DesignButton
              key={trip.id}
              label={trip.title || t('새 여행 계획')}
              onPress={() => {
                // 시트를 닫고 선택한 여행의 비용 탭을 연다.
                onClose();
                router.push({
                  pathname: '/trips/[id]',
                  params: { id: trip.id, section: 'expenses' },
                });
              }}
            />
          );
        })
      ) : (
        <HaruState kind="empty" title={t('먼저 여행을 만들어 주세요')} compact>
          <DesignButton
            label={t('새 여행 만들기')}
            onPress={() => {
              // 여행이 없을 때는 새 여행 생성 화면으로 바로 연결한다.
              onClose();
              onCreate();
            }}
          />
        </HaruState>
      )}
    </ActionSheet>
  );
}

// 여행별 필수 준비물 체크리스트로 이동하거나 빈 상태 시 여행 생성을 안내하는 시트를 렌더링한다.
function ChecklistSelectSheet({
  visible,
  activeTrips,
  onClose,
  onCreate,
}: {
  visible: boolean;
  activeTrips: PersistedTrip[];
  onClose: () => void;
  onCreate: () => void;
}) {
  // 활성 여행이 있으면 해당 여행의 체크리스트 섹션으로 이동한다.
  const router = useRouter();
  return (
    <ActionSheet
      visible={visible}
      title={t('필수 준비물 체크리스트')}
      onClose={onClose}
    >
      <Text style={s.body}>
        {t(
          '여권·로밍(eSIM)·교통패스·돼지코 어댑터 등 출국 전 필수 준비물을 여행별로 점검할 수 있어요.',
        )}
      </Text>
      {activeTrips.length ? (
        activeTrips.map((trip) => {
          // 선택한 여행의 준비물 체크리스트 화면으로 이동한다.
          return (
            <DesignButton
              key={trip.id}
              label={`${trip.title || t('새 여행 계획')} · ${t('체크리스트 열기')}`}
              onPress={() => {
                // 시트를 닫고 해당 여행의 체크리스트 섹션으로 이동한다.
                onClose();
                router.push({
                  pathname: '/trips/[id]',
                  params: { id: trip.id, section: 'checklist' },
                });
              }}
            />
          );
        })
      ) : (
        <HaruState
          kind="empty"
          title={t('먼저 여행을 만들어 주세요')}
          description={t(
            '새 여행을 생성하면 도시·일정에 맞는 준비물 체크리스트가 함께 준비됩니다.',
          )}
          compact
        >
          <DesignButton
            label={t('새 여행 만들기')}
            onPress={() => {
              // 시트를 닫고 새 여행 생성 화면을 연다.
              onClose();
              onCreate();
            }}
          />
        </HaruState>
      )}
    </ActionSheet>
  );
}

// 공식 관광청 교통·비상 가이드를 외부 링크로 연결하는 바텀시트를 렌더링한다.
function OfficialSafetySheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  // 외부 링크 실행 중 중복 클릭을 막고 오류 문구를 관리한다.
  const [guideError, setGuideError] = useState('');
  const [guideBusy, setGuideBusy] = useState(false);
  const guideLock = useRef(false);

  // 공식 교통·안전 안내 외부 링크를 연다.
  async function handleOpenOfficialUrl(url: string) {
    // 중복 탭을 막고 실패 시 안내 문구를 표시한다.
    if (guideLock.current) return;
    guideLock.current = true;
    setGuideBusy(true);
    setGuideError('');
    try {
      await openGuideSource(url);
    } catch {
      setGuideError('링크를 열지 못했어요. 다시 시도하거나 닫아 주세요.');
    } finally {
      guideLock.current = false;
      setGuideBusy(false);
    }
  }

  return (
    <ActionSheet
      visible={visible}
      title={t('현지 비상/교통 공식 안내')}
      onClose={onClose}
      dismissDisabled={guideBusy}
    >
      <Text style={s.body}>
        {t(
          '여행지 대중교통 패스, 현지 차량 호출 앱, 관광청 안전 가이드를 공식 출처에서 바로 확인하세요.',
        )}
      </Text>
      {guideError ? (
        <Text accessibilityRole="alert" style={s.body}>
          {t(guideError)}
        </Text>
      ) : null}
      {OFFICIAL_TRANSPORT_GUIDES.map((guide) => {
        // 각 공식 안내 항목을 카드형 버튼으로 표시한다.
        return (
          <View
            key={guide.title}
            style={[
              s.receiptFeedCard,
              { flexDirection: 'column', alignItems: 'stretch' },
            ]}
          >
            <Text style={s.receiptMerchant}>{t(guide.title)}</Text>
            <Text style={s.meta}>{t(guide.region)}</Text>
            <Text style={s.body}>{t(guide.description)}</Text>
            <DesignButton
              label={t('공식 안내 보기')}
              variant="quiet"
              loading={guideBusy}
              onPress={() => {
                // 선택한 공식 관광청/서비스 안내 URL을 외부 브라우저로 연다.
                void handleOpenOfficialUrl(guide.url);
              }}
            />
          </View>
        );
      })}
    </ActionSheet>
  );
}

// 작성 중인 계획 복원 및 전체 여행 관리 진입 시트를 렌더링한다.
function DraftManageSheet({
  visible,
  userId,
  onClose,
}: {
  visible: boolean;
  userId: string;
  onClose: () => void;
}) {
  // 라우터를 통해 전체 여행 목록으로 이동할 수 있게 한다.
  const router = useRouter();
  return (
    <ActionSheet
      visible={visible}
      title={t('작성 중인 계획 관리')}
      onClose={onClose}
    >
      <LegacyDraftImport userId={userId} />
      <HomeDraftResume userId={userId} onOpen={onClose} />
      <DesignButton
        label={t('전체 여행 관리')}
        onPress={() => {
          // 시트를 닫고 전체 여행 목록으로 이동한다.
          onClose();
          router.push('/plans');
        }}
      />
    </ActionSheet>
  );
}
