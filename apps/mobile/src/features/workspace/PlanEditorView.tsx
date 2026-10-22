import Text from '@/components/AppText';
import ScreenHeader from '@/components/ScreenHeader';
import type { WorkspaceSnapshot } from '@wherego/domain';
import { type JSX, type RefObject } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScheduleFlightFields from './FlightEntryFields';
import GooglePlace from './GooglePlace';
import PlaceSearch from './PlaceSearch';
import ReceiptConfirmation from './ReceiptConfirmation';
import ReceiptReview from './ReceiptReview';
import ScheduleLocation from './ScheduleLocation';
import ServerPhoto from './ServerPhoto';
import { DateField, DestinationFields } from './TravelInputs';
import TripPeriodSummary from './TripPeriodSummary';
import type { PlanForm } from './forms';
import { ledgerStyles as l, ledgerColors } from './ledgerTheme';
import { publicationIssue } from './publication';
import { receiptCanSave } from './receiptFlow';
import { type TripPeriodImpact } from './tripPeriod';
import { Action, Field } from './ui';
import { styles } from './workspaceStyles';

export const labels: Record<string, string> = {
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
  body: '공유 소개 · 선택',
  planTitle: '이날 제목 · 선택',
  planConcept: '이날 소개 · 선택',
};
// renderPlanEditor이 읽는 값과 실행 가능한 행동의 계약이다.
type RenderPlanEditorProps = {
  form: PlanForm | null;
  onClose: () => void;
  busy: boolean;
  locked: boolean;
  receiptScroll: RefObject<ScrollView | null>;
  wide: boolean;
  snapshot: WorkspaceSnapshot | undefined;
  userId: string;
  onChange: (key: string, value: string) => void;
  onRescan: () => void;
  onReceipt: (camera: boolean) => void;
  chooseReceiptValue: (
    key: string,
    value: string,
  ) => Promise<number | undefined>;
  periodImpact: TripPeriodImpact | null;
  error: string;
  conflicted: boolean;
  SaveAction:
    | (({
        label,
        accessibilityLabel,
        onPress,
        primary,
        quiet,
        selected,
        checked,
        disabled,
        loading,
        variant,
        allowWhileLocked,
      }: {
        label: string;
        accessibilityLabel?: string;
        onPress: () => void;
        primary?: boolean;
        quiet?: boolean;
        selected?: boolean;
        checked?: boolean;
        disabled?: boolean;
        loading?: boolean;
        variant?: 'primary' | 'secondary' | 'quiet' | 'danger' | 'destructive';
        allowWhileLocked?: boolean;
      }) => JSX.Element)
    | (({
        label,
        accessibilityLabel,
        onPress,
        disabled,
        variant,
        selected,
        selectionStyle,
        checked,
        allowWhileLocked,
        loading,
        size,
      }: {
        label: string;
        accessibilityLabel?: string;
        onPress: () => void;
        disabled?: boolean;
        variant?: 'primary' | 'secondary' | 'danger' | 'destructive' | 'quiet';
        selected?: boolean;
        selectionStyle?: 'check' | 'fill';
        checked?: boolean;
        allowWhileLocked?: boolean;
        loading?: boolean;
        size?: 'default' | 'chip' | 'icon' | 'day' | 'header';
      }) => JSX.Element);
  onSave: () => void;
  onReload: () => void;
};

// 폼 종류별 입력과 저장·닫기 행동을 배치한다.
export function renderPlanEditor({
  form,
  onClose,
  busy,
  locked,
  receiptScroll,
  wide,
  snapshot,
  userId,
  onChange,
  onRescan,
  onReceipt,
  chooseReceiptValue,
  periodImpact,
  error,
  conflicted,
  SaveAction,
  onSave,
  onReload,
}: RenderPlanEditorProps) {
  // 전달받은 값과 행동을 기존 화면 규격으로 표시한다.

  return (
    <>
      <SafeAreaView
        style={[
          styles.modal,
          form?.kind === 'receipt' && { backgroundColor: ledgerColors.canvas },
        ]}
      >
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
                      : form?.kind === 'dayPlan'
                        ? '이날 소개'
                        : '여행 내용 작성'
          }
          backLabel="닫기"
          onBack={onClose}
          disabled={busy || locked}
        />
        <ScrollView
          ref={receiptScroll}
          contentContainerStyle={
            form?.kind === 'receipt'
              ? [l.content, wide && l.wideContent]
              : styles.content
          }
          keyboardShouldPersistTaps="handled"
        >
          {form && (
            <>
              {renderReceiptOriginal({
                form,
                snapshot,
                wide,
                userId,
                busy,
                onChange,
                onRescan,
                onReceipt,
              })}
              {renderScheduleContext({
                form,
                userId,
                snapshot,
                busy,
                onChange,
                onReceipt,
              })}
              {renderPlanFields({ form, onChange })}
              {form.kind === 'schedule' && (
                <View style={styles.card}>
                  <Text style={styles.title}>여행 날짜 선택</Text>
                  {snapshot?.days.map((day) => (
                    <Action
                      key={day.id}
                      label={`DAY ${day.dayNumber} · ${day.tripDate}`}
                      selected={form.values.dayId === day.id}
                      selectionStyle="fill"
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
              {renderExpenseCurrency({ form, busy, onChange })}
              {renderExpenseLink({ form, busy, onChange, snapshot })}
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
                        label={
                          status === 'COMPLETED'
                            ? '기록 정리 완료'
                            : '기록 정리 중'
                        }
                        selected={
                          status === 'COMPLETED'
                            ? form.values.status === status
                            : form.values.status !== 'COMPLETED'
                        }
                        selectionStyle="fill"
                        onPress={() => {
                          // 종료 여부는 소유자가 명시적으로 확인한다.
                          onChange('status', status);
                        }}
                      />
                    ))}
                  </View>
                </View>
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
          {renderPlanSaveActions({
            SaveAction,
            busy,
            form,
            locked,
            periodImpact,
            snapshot,
            onSave,
            conflicted,
            onReload,
          })}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
// renderExpenseLink이 읽는 값과 실행 가능한 행동의 계약이다.
type RenderExpenseLinkProps = {
  form: PlanForm;
  busy: boolean;
  onChange: (key: string, value: string) => void;
  snapshot: WorkspaceSnapshot | undefined;
};

// 폼의 저장 가능 상태와 저장·충돌 복구 행동을 표시한다.
function renderPlanSaveActions({
  SaveAction,
  busy,
  form,
  locked,
  periodImpact,
  snapshot,
  onSave,
  conflicted,
  onReload,
}: {
  SaveAction:
    | (({
        label,
        accessibilityLabel,
        onPress,
        primary,
        quiet,
        selected,
        checked,
        disabled,
        loading,
        variant,
        allowWhileLocked,
      }: {
        label: string;
        accessibilityLabel?: string;
        onPress: () => void;
        primary?: boolean;
        quiet?: boolean;
        selected?: boolean;
        checked?: boolean;
        disabled?: boolean;
        loading?: boolean;
        variant?: 'primary' | 'secondary' | 'quiet' | 'danger' | 'destructive';
        allowWhileLocked?: boolean;
      }) => JSX.Element)
    | (({
        label,
        accessibilityLabel,
        onPress,
        disabled,
        variant,
        selected,
        selectionStyle,
        checked,
        allowWhileLocked,
        loading,
        size,
      }: {
        label: string;
        accessibilityLabel?: string;
        onPress: () => void;
        disabled?: boolean;
        variant?: 'primary' | 'secondary' | 'danger' | 'destructive' | 'quiet';
        selected?: boolean;
        selectionStyle?: 'check' | 'fill';
        checked?: boolean;
        allowWhileLocked?: boolean;
        loading?: boolean;
        size?: 'default' | 'chip' | 'icon' | 'day' | 'header';
      }) => JSX.Element);
  busy: boolean;
  form: PlanForm | null;
  locked: boolean;
  periodImpact: TripPeriodImpact | null;
  snapshot: WorkspaceSnapshot | undefined;
  onSave: () => void;
  conflicted: boolean;
  onReload: () => void;
}) {
  // 전달받은 값과 행동을 기존 화면 규격으로 표시한다.

  return (
    <View style={styles.row}>
      <SaveAction
        allowWhileLocked
        variant="primary"
        label={
          busy
            ? '저장 중…'
            : form?.kind === 'publish'
              ? '확인하고 게시'
              : form?.kind === 'receipt'
                ? form.values.receiptOperation === 'update'
                  ? '영수증 수정 저장'
                  : '일정에 추가하기'
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
      {conflicted && (
        <Action
          allowWhileLocked
          label="최신 내용 불러오기"
          disabled={busy}
          onPress={onReload}
        />
      )}
    </View>
  );
}

// 비용에 연결할 일정 선택을 표시한다.
export function renderExpenseLink({
  form,
  busy,
  onChange,
  snapshot,
}: RenderExpenseLinkProps) {
  // 전달받은 값과 행동을 기존 화면 규격으로 표시한다.

  return (
    (form.kind === 'expense' ||
      (form.kind === 'receipt' &&
        ['ready', 'manual'].includes(form.values.receiptStatus || ''))) && (
      <View style={styles.card}>
        <Text style={styles.title}>연결할 일정</Text>
        {form.values.receiptOperation !== 'update' && (
          <Action
            label={
              form.kind === 'receipt'
                ? '새 장소 기록 만들기'
                : '새 기록 / 일정 연결 없이'
            }
            selected={
              form.kind === 'expense' ? !form.values.scheduleId : undefined
            }
            disabled={busy}
            onPress={() => {
              // 영수증은 새 일정을 생성하고 수동 비용은 여행 전체에 연결한다.
              onChange('scheduleId', '');
            }}
          />
        )}
        {form.values.receiptOperation === 'update' && (
          <Text style={styles.subtitle}>
            수정할 영수증을 연결할 기존 일정을 선택해 주세요. 새 장소를
            추가하려면 일정 추가를 이용해 주세요.
          </Text>
        )}
        {snapshot?.itinerary
          .filter((item) => {
            // 영수증은 실제 결제 날짜에 속한 일정만 연결한다.
            return form.kind !== 'receipt' || item.dayId === form.values.dayId;
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
    )
  );
}
// renderExpenseCurrency이 읽는 값과 실행 가능한 행동의 계약이다.
type RenderExpenseCurrencyProps = {
  form: PlanForm;
  busy: boolean;
  onChange: (key: string, value: string) => void;
};

// 비용과 지원 통화 선택을 표시한다.
export function renderExpenseCurrency({
  form,
  busy,
  onChange,
}: RenderExpenseCurrencyProps) {
  // 전달받은 값과 행동을 기존 화면 규격으로 표시한다.

  return (
    (form.kind === 'expense' ||
      (form.kind === 'receipt' &&
        ['ready', 'manual'].includes(form.values.receiptStatus || '') &&
        (form.values.receiptEditing === 'true' ||
          form.values.receiptStatus === 'manual'))) && (
      <View style={styles.row}>
        {['KRW', 'JPY', 'USD'].map((currency) => (
          <Action
            key={currency}
            label={currency}
            selected={
              (form.values.currency || form.values.defaultCurrency) === currency
            }
            size="chip"
            disabled={
              busy ||
              (form.kind === 'receipt' &&
                Boolean(form.values.currency) &&
                !['KRW', 'JPY', 'USD'].includes(form.values.currency!))
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
    )
  );
}
// renderPlanFields이 읽는 값과 실행 가능한 행동의 계약이다.
type RenderPlanFieldsProps = {
  form: PlanForm;
  onChange: (key: string, value: string) => void;
};

// 폼 종류에 맞는 입력 필드와 라벨을 표시한다.
export function renderPlanFields({ form, onChange }: RenderPlanFieldsProps) {
  // 전달받은 값과 행동을 기존 화면 규격으로 표시한다.

  return Object.entries(form.values)
    .filter(([key]) => {
      // 식별자와 선택 필드는 자유 입력으로 노출하지 않는다.
      return (
        form.kind !== 'receipt' &&
        Boolean(labels[key]) &&
        !(
          form.kind === 'publish' &&
          form.values.kind === 'plan' &&
          key === 'title'
        ) &&
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
        !(form.kind === 'metadata' && ['country', 'city'].includes(key)) &&
        key !== 'sortOrder'
      );
    })
    .map(([key, value]) =>
      ['startDate', 'endDate', 'transactionDate', 'timeSlot'].includes(key) ? (
        <DateField
          key={key}
          label={labels[key]!}
          value={value}
          mode={key === 'timeSlot' ? 'time' : 'date'}
          minimumDate={key === 'endDate' ? form.values.startDate : undefined}
          maximumDate={key === 'startDate' ? form.values.endDate : undefined}
          onChange={(next) => {
            // 달력에서 선택한 날짜만 폼에 반영한다.
            onChange(key, next);
          }}
        />
      ) : (
        <Field
          key={key}
          label={
            key === 'body' && form.values.kind === 'plan'
              ? '계획 소개'
              : labels[key]!
          }
          value={value}
          multiline={['memo', 'body', 'details', 'planConcept'].includes(key)}
          onChange={(next) => {
            // 해당 필드 하나만 변경한다.
            onChange(key, next);
          }}
        />
      ),
    );
}
// renderScheduleContext이 읽는 값과 실행 가능한 행동의 계약이다.
type RenderScheduleContextProps = {
  form: PlanForm;
  userId: string;
  snapshot: WorkspaceSnapshot | undefined;
  busy: boolean;
  onChange: (key: string, value: string) => void;
  onReceipt: (camera: boolean) => void;
};

// 일정의 항공·날짜·장소 선택을 표시한다.
export function renderScheduleContext({
  form,
  userId,
  snapshot,
  busy,
  onChange,
  onReceipt,
}: RenderScheduleContextProps) {
  // 전달받은 값과 행동을 기존 화면 규격으로 표시한다.

  return (
    form.kind === 'schedule' && (
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
          key={`${form.id}:${form.values.dayId}:${form.values.type}`}
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
    )
  );
}
// renderReceiptOriginal이 읽는 값과 실행 가능한 행동의 계약이다.
type RenderReceiptOriginalProps = {
  form: PlanForm;
  snapshot: WorkspaceSnapshot | undefined;
  wide: boolean;
  userId: string;
  busy: boolean;
  onChange: (key: string, value: string) => void;
  onRescan: () => void;
  onReceipt: (camera: boolean) => void;
};

// 영수증 원본과 확인 항목을 나란히 배치한다.
export function renderReceiptOriginal({
  form,
  snapshot,
  wide,
  userId,
  busy,
  onChange,
  onRescan,
  onReceipt,
}: RenderReceiptOriginalProps) {
  // 전달받은 값과 행동을 기존 화면 규격으로 표시한다.

  return (
    form.kind === 'receipt' &&
    snapshot && (
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: 24 }}>
        <View style={wide ? { width: 360, gap: 12 } : { gap: 12 }}>
          <Text style={l.eyebrow}>영수증 원본</Text>
          <ServerPhoto
            fit="contain"
            userId={userId}
            tripId={snapshot.trip.id}
            mediaId={form.values.mediaId!}
          />
          <Text style={l.meta}>
            사진과 읽은 내용을 비교해 주세요. 등록 전에는 지출이 추가되지
            않아요.
          </Text>
        </View>
        <View style={{ flex: 1, gap: 16 }}>
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
        </View>
      </View>
    )
  );
}
