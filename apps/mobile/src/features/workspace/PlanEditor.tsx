import Text from '@/components/AppText';
import ScreenHeader from '@/components/ScreenHeader';
import Modal from '@/components/AppModal';
import ReceiptReview from './ReceiptReview';
import ReceiptConfirmation from './ReceiptConfirmation';
import PublishSelection from './PublishSelection';
import { publicationIssue } from './publication';
import { receiptCanSave } from './receiptFlow';
import { ScrollView, View } from 'react-native';
import { useRef, type RefObject } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { WorkspaceSnapshot } from '@wherego/domain';
import { Action, Field, ServerPhoto, styles } from './ui';
import type { PlanForm } from './forms';
import TripPeriodSummary from './TripPeriodSummary';
import { tripPeriodImpact } from './tripPeriod';
import { DateField, DestinationFields } from './TravelInputs';
import TripPlanningFlow from './TripPlanningFlow';
import PlaceSearch from './PlaceSearch';
import GooglePlace from './GooglePlace';
import ScheduleLocation from './ScheduleLocation';
import ScheduleFlightFields from './FlightEntryFields';
import ScheduleEditor from './ScheduleEditor';
import { FormFeedback } from './InputFeedback';
import { type FieldErrors, type FormFeedbackState } from './formFeedback';

const labels: Record<string, string> = {
  title: '제목',
  country: '국가',
  city: '도시·지역',
  startDate: '시작일',
  endDate: '종료일',
  timezone: '현지 시간대',
  defaultCurrency: '기본 통화',
  timeSlot: '일정 시간 (HH:mm)',
  sortOrder: '일정 순서',
  address: '지역명·주소',
  memo: '일정 메모',
  amount: '금액',
  merchant: '영수증 상호',
  transactionDate: '실제 결제 날짜',
  details: '구매 내역',
  body: '커뮤니티 본문',
};
// 폼이 닫혀도 전환이 끝날 때까지 마지막 작성 내용을 보존한다.
export default function PlanEditor(props: EditorProps) {
  // 입력 참조는 폼이 바뀌어도 현재 스크롤에 연결한다.
  const scroll = useRef<ScrollView>(null);
  const content = (
    <EditorScope key={props.form?.id || 'closed'} {...props} scroll={scroll} />
  );
  // 여행 생성은 페이지 전환을 사용하고 편집은 공통 모달 수명을 사용한다.
  return props.form?.kind === 'trip' ? (
    content
  ) : (
    <Modal
      visible={Boolean(props.form)}
      accessibilityLabel={editorLabel(props.form)}
      animationType="slide"
      onRequestClose={props.onClose}
    >
      {content}
    </Modal>
  );
}

// 폼 종류가 바뀌면 화면 읽기 이름도 현재 작성 내용으로 갱신한다.
function editorLabel(form: PlanForm | null): string {
  // 로그인·출처 창과 편집 내용을 읽기 이름으로 구분한다.
  return (
    (
      {
        schedule: '일정 작성',
        receipt: '영수증 확인',
        publish: '커뮤니티 공개',
        metadata: '여행 정보 수정',
        period: '여행 기간 변경',
        expense: '비용 작성',
      } as Record<string, string>
    )[form?.kind || ''] || '여행 내용 작성'
  );
}

// 폼 전체에 오류 이동과 저장 중 입력 잠금을 적용한다.
function EditorScope(
  props: EditorProps & { scroll: RefObject<ScrollView | null> },
) {
  // 일정 전용 모달도 같은 저장 상태와 검증 결과를 사용한다.
  return (
    <FormFeedback
      locked={props.locked}
      feedback={props.feedback}
      scroll={props.scroll}
    >
      {props.form?.kind === 'trip' ? (
        <TripPlanningFlow {...props} form={props.form} />
      ) : (
        <PlanEditorContent {...props} />
      )}
    </FormFeedback>
  );
}

type EditorProps = {
  userId: string;
  form: PlanForm | null;
  snapshot?: WorkspaceSnapshot;
  busy: boolean;
  locked: boolean;
  feedback: FormFeedbackState;
  onInvalid: (fields: FieldErrors) => void;
  error: string;
  onChange: (key: string, value: string) => void;
  onSave: () => void;
  onReload: () => void;
  onClose: () => void;
  onReceipt: (camera: boolean) => void;
  onRescan: () => void;
};

// 명령 종류별 작성 화면을 같은 입력 계약으로 연결한다.
function PlanEditorContent({
  userId,
  form,
  snapshot,
  busy,
  error,
  onChange,
  onSave,
  onReload,
  onClose,
  onReceipt,
  onRescan,
  locked,
  scroll,
}: EditorProps & { scroll: RefObject<ScrollView | null> }) {
  // 아니요 선택 시 수정할 정보를 화면 위에서 바로 확인할 수 있게 한다.
  const receiptScroll = scroll;
  const periodImpact =
    form?.kind === 'period' && snapshot
      ? tripPeriodImpact(snapshot, form.values)
      : null;
  // 선택값을 반영한 다음 수정 화면의 시작으로 이동한다.
  function chooseReceiptValue(key: string, value: string) {
    // 사진 선택은 위치를 유지하고 정보 수정 선택만 위로 이동한다.
    return Promise.resolve(onChange(key, value)).then(() => {
      // 새 입력 필드가 배치된 프레임에서 이동한다.
      return key === 'receiptConfirmed' && value === 'false'
        ? requestAnimationFrame(() => {
            // 잘못 인식된 항목의 확인·수정 영역으로 돌아간다.
            return receiptScroll.current?.scrollTo({ y: 0, animated: true });
          })
        : undefined;
    });
  }
  // 실패해도 같은 폼 입력값과 원본을 유지한다.
  if (form?.kind === 'schedule' && snapshot)
    return (
      <ScheduleEditor
        userId={userId}
        form={form}
        snapshot={snapshot}
        busy={busy}
        locked={locked}
        scroll={scroll}
        error={error}
        onChange={onChange}
        onSave={onSave}
        onReload={onReload}
        onClose={onClose}
        onReceipt={onReceipt}
      />
    );
  return (
    <>
      <SafeAreaView style={styles.modal}>
        <ScreenHeader
          title={
            form?.kind === 'publish'
              ? '커뮤니티 공개'
              : form?.kind === 'receipt'
                ? '영수증 확인'
                : form?.kind === 'expense'
                  ? '비용 기록'
                  : form?.kind === 'metadata'
                    ? '여행 정보 수정'
                    : form?.kind === 'period'
                      ? '여행 기간 변경'
                      : '여행 내용 작성'
          }
          backLabel="닫기"
          onBack={onClose}
          disabled={busy || locked}
        />
        <ScrollView
          ref={receiptScroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {form && (
            <>
              {form.kind === 'receipt' && snapshot && (
                <ServerPhoto
                  userId={userId}
                  tripId={snapshot.trip.id}
                  mediaId={form.values.mediaId!}
                />
              )}
              {form.kind === 'receipt' && snapshot && (
                <ReceiptReview
                  form={form}
                  snapshot={snapshot}
                  busy={busy}
                  onChange={onChange}
                  onRetry={onRescan}
                  onPhoto={() => {
                    // 촬영이 잘못되었을 때 다른 원본을 선택한다.
                    return onReceipt(false);
                  }}
                />
              )}
              {form.kind === 'schedule' && (
                <>
                  <ScheduleFlightFields
                    userId={userId}
                    date={
                      snapshot?.days.find((day) => {
                        // 선택 DAY의 출발 날짜만 조회에 사용한다.
                        return day.id === form.values.dayId;
                      })?.tripDate || ''
                    }
                    disabled={busy}
                    values={form.values}
                    onChange={onChange}
                  />
                  <View style={styles.card}>
                    <Text style={styles.title}>장소를 어떻게 추가할까요?</Text>
                    <View style={styles.row}>
                      <Action
                        label="영수증 촬영으로 추가"
                        disabled={busy}
                        onPress={() => {
                          // 등록된 영수증 인식 흐름으로 연결한다.
                          onReceipt(true);
                        }}
                      />
                      <Action
                        label="영수증 사진으로 추가"
                        disabled={busy}
                        onPress={() => {
                          // 저장된 영수증 사진을 선택한다.
                          onReceipt(false);
                        }}
                      />
                    </View>
                  </View>
                  <PlaceSearch
                    key={form.id}
                    userId={userId}
                    city={snapshot?.trip.city || ''}
                    disabled={busy}
                    initialShare={form.values.sharedMapsText}
                    onSelect={(placeId, authoredTitle) => {
                      // 사용자 제목과 구글 장소 ID만 영구 기록에 포함한다.
                      onChange('googlePlaceId', placeId);
                      onChange('title', authoredTitle);
                      // 다른 공유 장소를 고르면 이전 위치 핀을 재사용하지 않는다.
                      onChange('mapLocation', '');
                    }}
                  />
                  {form.values.googlePlaceId && (
                    <>
                      <GooglePlace
                        userId={userId}
                        placeId={form.values.googlePlaceId}
                        label={form.values.title || ''}
                      />
                      <Action
                        label="선택한 구글 장소 연결 해제"
                        disabled={busy}
                        onPress={() => {
                          // 사용자 작성 내용은 유지하고 장소 참조만 해제한다.
                          onChange('googlePlaceId', '');
                        }}
                      />
                    </>
                  )}
                  <ScheduleLocation
                    form={form}
                    snapshot={snapshot}
                    disabled={busy}
                    onChange={onChange}
                  />
                </>
              )}
              {Object.entries(form.values)
                .filter(([key]) => {
                  // 식별자와 선택 필드는 자유 입력으로 노출하지 않는다.
                  return (
                    form.kind !== 'receipt' &&
                    Boolean(labels[key]) &&
                    !(
                      form.kind === 'trip' &&
                      [
                        'country',
                        'city',
                        'title',
                        'startDate',
                        'endDate',
                        'timezone',
                        'defaultCurrency',
                      ].includes(key)
                    ) &&
                    !(
                      form.kind === 'metadata' &&
                      ['country', 'city'].includes(key)
                    ) &&
                    key !== 'sortOrder'
                  );
                })
                .map(([key, value]) =>
                  [
                    'startDate',
                    'endDate',
                    'transactionDate',
                    'timeSlot',
                  ].includes(key) ? (
                    <DateField
                      key={key}
                      label={labels[key]!}
                      value={value}
                      mode={key === 'timeSlot' ? 'time' : 'date'}
                      minimumDate={
                        key === 'endDate' ? form.values.startDate : undefined
                      }
                      maximumDate={
                        key === 'startDate' ? form.values.endDate : undefined
                      }
                      onChange={(next) => {
                        // 달력에서 선택한 날짜만 폼에 반영한다.
                        onChange(key, next);
                      }}
                    />
                  ) : (
                    <Field
                      key={key}
                      label={labels[key]!}
                      value={value}
                      multiline={['memo', 'body', 'details'].includes(key)}
                      onChange={(next) => {
                        // 해당 필드 하나만 변경한다.
                        onChange(key, next);
                      }}
                    />
                  ),
                )}
              {form.kind === 'schedule' && (
                <View style={styles.card}>
                  <Text style={styles.title}>여행 날짜 선택</Text>
                  {snapshot?.days.map((day) => (
                    <Action
                      key={day.id}
                      label={`${form.values.dayId === day.id ? '✓ ' : ''}DAY ${day.dayNumber} · ${day.tripDate}`}
                      disabled={busy}
                      onPress={() => {
                        // 수동 날짜 선택에서 기존 일정 연결은 해제한다.
                        onChange('dayId', day.id);
                      }}
                    />
                  ))}
                </View>
              )}
              {form.kind === 'schedule' && (
                <View style={styles.row}>
                  {[
                    'PLACE',
                    'TRANSPORT',
                    'STAY',
                    'RESERVATION',
                    'TODO',
                    'MEMO',
                  ].map((type) => (
                    <Action
                      key={type}
                      label={`${form.values.type === type ? '✓ ' : ''}${{ PLACE: '장소', TRANSPORT: '이동', STAY: '숙소', RESERVATION: '예약', TODO: '할 일', MEMO: '메모' }[type]}`}
                      disabled={busy}
                      onPress={() => {
                        // 일정 유형을 하나 선택한다.
                        onChange('type', type);
                      }}
                    />
                  ))}
                </View>
              )}
              {(form.kind === 'expense' ||
                (form.kind === 'receipt' &&
                  ['ready', 'manual'].includes(
                    form.values.receiptStatus || '',
                  ) &&
                  (form.values.receiptEditing === 'true' ||
                    form.values.receiptStatus === 'manual'))) && (
                <View style={styles.row}>
                  {['KRW', 'JPY', 'USD'].map((currency) => (
                    <Action
                      key={currency}
                      label={currency}
                      selected={
                        (form.values.currency ||
                          form.values.defaultCurrency) === currency
                      }
                      size="chip"
                      disabled={
                        busy ||
                        (form.kind === 'receipt' &&
                          Boolean(form.values.currency) &&
                          !['KRW', 'JPY', 'USD'].includes(
                            form.values.currency!,
                          ))
                      }
                      onPress={() => {
                        // 금액은 선택 통화의 정밀도로 검사한다.
                        onChange(
                          form.kind === 'trip' ? 'defaultCurrency' : 'currency',
                          currency,
                        );
                      }}
                    />
                  ))}
                </View>
              )}
              {(form.kind === 'expense' ||
                (form.kind === 'receipt' &&
                  ['ready', 'manual'].includes(
                    form.values.receiptStatus || '',
                  ))) && (
                <View style={styles.card}>
                  <Text style={styles.title}>연결할 일정</Text>
                  <Action
                    label={
                      form.kind === 'receipt'
                        ? '새 장소 기록 만들기'
                        : '새 기록 / 일정 연결 없이'
                    }
                    selected={
                      form.kind === 'expense'
                        ? !form.values.scheduleId
                        : undefined
                    }
                    disabled={busy}
                    onPress={() => {
                      // 영수증은 새 일정을 생성하고 수동 비용은 여행 전체에 연결한다.
                      onChange('scheduleId', '');
                    }}
                  />
                  {snapshot?.itinerary
                    .filter((item) => {
                      // 영수증은 실제 결제 날짜에 속한 일정만 연결한다.
                      return (
                        form.kind !== 'receipt' ||
                        item.dayId === form.values.dayId
                      );
                    })
                    .map((item) => (
                      <Action
                        key={item.id}
                        label={item.title}
                        selected={form.values.scheduleId === item.id}
                        disabled={busy}
                        onPress={() => {
                          // 일정의 실제 DAY도 함께 연결한다.
                          onChange('scheduleId', item.id);
                        }}
                      />
                    ))}
                </View>
              )}
              {form.kind === 'expense' && (
                <View style={styles.row}>
                  <Action
                    label="실제 지출"
                    selected={form.values.isActual === 'true'}
                    onPress={() => {
                      // 실제 지출로 명시한다.
                      onChange('isActual', 'true');
                    }}
                  />
                  <Action
                    label="예상 비용"
                    selected={form.values.isActual === 'false'}
                    onPress={() => {
                      // 예상 비용과 실제 지출은 합계를 분리한다.
                      onChange('isActual', 'false');
                    }}
                  />
                </View>
              )}
              {form.kind === 'metadata' && (
                <DestinationFields values={form.values} onChange={onChange} />
              )}
              {form.kind === 'metadata' && (
                <View>
                  <Text>
                    여행 단계는 날짜에 맞춰 바뀌어요. 공개할 기록의 정리 여부를
                    선택해 주세요.
                  </Text>
                  <View style={styles.row}>
                    {['PLANNED', 'COMPLETED'].map((status) => (
                      <Action
                        key={status}
                        label={`${(status === 'COMPLETED' ? form.values.status === status : form.values.status !== 'COMPLETED') ? '✓ ' : ''}${{ PLANNED: '기록 정리 중', COMPLETED: '기록 정리 완료' }[status]}`}
                        onPress={() => {
                          // 종료 여부는 소유자가 명시적으로 확인한다.
                          onChange('status', status);
                        }}
                      />
                    ))}
                  </View>
                </View>
              )}
              {form.kind === 'publish' && snapshot && (
                <PublishSelection
                  userId={userId}
                  form={form}
                  snapshot={snapshot}
                  busy={busy}
                  onChange={onChange}
                />
              )}
              {form.kind === 'receipt' &&
                ['ready', 'manual'].includes(
                  form.values.receiptStatus || '',
                ) && (
                  <ReceiptConfirmation
                    form={form}
                    busy={busy}
                    onChange={chooseReceiptValue}
                  />
                )}
              {form.kind === 'period' && (
                <TripPeriodSummary impact={periodImpact} />
              )}
            </>
          )}
          {error && (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          )}
          <View style={styles.row}>
            <Action
              allowWhileLocked
              variant="primary"
              label={
                busy
                  ? '저장 중…'
                  : form?.kind === 'publish'
                    ? '확인하고 게시'
                    : form?.kind === 'receipt'
                      ? '일정에 추가하기'
                      : '확인하고 저장'
              }
              disabled={
                (form?.kind === 'period' &&
                  !locked &&
                  Boolean(periodImpact?.blocked)) ||
                (form?.kind === 'receipt' && !receiptCanSave(form)) ||
                (form?.kind === 'publish' &&
                  !locked &&
                  Boolean(snapshot && publicationIssue(snapshot, form.values)))
              }
              loading={busy}
              onPress={onSave}
            />
            {error.includes('동행') && (
              <Action
                allowWhileLocked
                label="최신 내용 불러오기"
                disabled={busy}
                onPress={onReload}
              />
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
