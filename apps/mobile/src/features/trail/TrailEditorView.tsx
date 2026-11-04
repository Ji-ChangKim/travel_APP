import { TextInput, View } from 'react-native';
import Text from '@/components/AppText';
import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';
import type { TrailEditor, TrailModel } from './trailTypes';
import {
  closeEditor,
  pickAttachment,
  searchFlight,
  submitEditor,
  updateField,
} from './trailActions';
import { TrailAction } from './TrailControls';
import { trailStyles as styles } from './trailStyles';

const fields: Record<Exclude<TrailEditor, null>, [string, string, string][]> = {
  journey: [
    ['title', '여행 제목', '예: 와카야마에서 남기는 발자취'],
    ['city', '도시', '예: 와카야마'],
    ['startDate', '출발일', 'YYYY-MM-DD'],
    ['endDate', '귀국일', 'YYYY-MM-DD'],
  ],
  flight: [
    ['flightNumber', '항공편명', '예: KE123'],
    ['searchDate', '검색할 운항일', 'YYYY-MM-DD'],
    ['departureAirport', '출발 공항 코드', '예: ICN'],
    ['arrivalAirport', '도착 공항 코드', '예: KIX'],
    ['departureDate', '출발 공항 현지 날짜', 'YYYY-MM-DD'],
    ['departureTime', '출발 공항 현지 시각', 'HH:mm'],
    ['departureOffset', '출발 공항 시간대 (한국·일본 +09:00)', '+09:00'],
    ['arrivalDate', '도착 공항 현지 날짜', 'YYYY-MM-DD'],
    ['arrivalTime', '도착 공항 현지 시각', 'HH:mm'],
    ['arrivalOffset', '도착 공항 시간대 (한국·일본 +09:00)', '+09:00'],
  ],
  plan: [
    ['date', '계획 날짜', 'YYYY-MM-DD'],
    ['time', '계획 시각', 'HH:mm'],
    ['title', '장소·일정 이름', '방문할 식당·숙소·장소'],
    ['address', '주소', '확인한 주소'],
    ['memo', '계획·메모', '예약·하고 싶은 일·예상 메뉴'],
  ],
  receipt: [
    ['merchant', '영수증 상호', '영수증에 표시된 상호'],
    ['date', '실제 결제 날짜', 'YYYY-MM-DD'],
    ['time', '실제 결제 시각', 'HH:mm'],
    ['amount', '영수증 총액', '예: 2500'],
    ['details', '구매·방문 상세', '메뉴, 수량, 단가, 이용한 서비스'],
    ['note', '실제 경험·다음 방문 팁', '계획과 달랐던 점, 예약·결제 팁'],
  ],
};

// 각 단계의 입력과 파일 선택을 제공한다.
export default function TrailEditorView({ model }: { model: TrailModel }) {
  useLocale();
  // 편명 검색은 외부 조회, 등록은 확인한 시각 입력으로 구분한다.
  return (
    <View style={styles.card}>
      {model.editor[0] === 'flight' ? (
        <View>
          <View style={styles.row}>
            <TrailAction
              label={t('가는 편')}
              secondary={model.form[0].direction !== 'outbound'}
              onPress={updateField.bind(null, model, 'direction', 'outbound')}
            />
            <TrailAction
              label={t('오는 편')}
              secondary={model.form[0].direction !== 'return'}
              onPress={updateField.bind(null, model, 'direction', 'return')}
            />
          </View>
          <Text style={styles.small}>
            {t(
              '편명+날짜 웹 검색으로 항공사 정보를 확인한 뒤 시각을 입력하세요. 검색 결과는 항공권 구매·예약 확정이 아닙니다.',
            )}
          </Text>
        </View>
      ) : null}
      {fields[model.editor[0] ?? 'journey'].map(([key, label, placeholder]) => {
        return (
          <View key={key} style={styles.field}>
            <Text style={styles.label}>{label}</Text>
            <TextInput
              editable={!model.state.saving}
              accessibilityLabel={label}
              style={[
                styles.input,
                ['details', 'note', 'memo'].includes(key) && styles.multiline,
              ]}
              placeholder={placeholder}
              value={model.form[0][key] ?? ''}
              onChangeText={updateField.bind(null, model, key)}
              multiline={['details', 'note', 'memo'].includes(key)}
              autoCapitalize="none"
            />
          </View>
        );
      })}
      {model.editor[0] === 'flight' ? (
        <TrailAction
          label={t('편명·운항일 검색 열기 ↗')}
          secondary
          onPress={searchFlight.bind(null, model)}
        />
      ) : null}
      {model.editor[0] === 'receipt' ? (
        <View style={styles.section}>
          <Text style={styles.small}>
            {t('영수증 사진과 결제 내역을 남겨 지난 여행을 정리해 보세요.')}
          </Text>
          <View style={styles.row}>
            {(['KRW', 'JPY', 'USD'] as const).map((currency) => {
              // 통화가 다른 기록을 합산하지 않는다.
              return (
                <TrailAction
                  key={currency}
                  label={currency}
                  secondary={model.form[0].currency !== currency}
                  onPress={updateField.bind(null, model, 'currency', currency)}
                />
              );
            })}
          </View>
          <TrailAction
            label={
              model.attachment[0]
                ? t('영수증 원본 다시 선택')
                : t('영수증 사진·PDF 선택 (2MB 이하)')
            }
            secondary
            disabled={model.state.saving || model.attachmentPending[0]}
            onPress={pickAttachment.bind(null, model)}
          />
          {model.attachment[0] ? (
            <Text style={styles.small}>{model.attachment[0].name}</Text>
          ) : null}
        </View>
      ) : null}
      <View style={styles.row}>
        <TrailAction
          label={model.state.saving ? t('기기에 저장 중…') : t('저장하기')}
          disabled={
            model.state.loading ||
            model.state.saving ||
            model.attachmentPending[0]
          }
          onPress={submitEditor.bind(null, model)}
        />
        <TrailAction
          label={t('닫기')}
          secondary
          disabled={model.state.saving}
          onPress={closeEditor.bind(null, model)}
        />
      </View>
    </View>
  );
}
