import Text from '@/components/AppText';
import { useContext, useLayoutEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { DiscoveryDestination } from '@wherego/domain';
import type { DiscoveryCity } from '@wherego/validation';
import { Action, styles } from './ui';
import { discoveryStyles as s } from './discoveryStyles';
import {
  informationAttributions,
  photoAttribution,
  storyAttribution,
  type GuideAttribution,
} from './cityGuideSources';
import { ModalActive } from '../accessibility/modalLayers';
import { openGuideSource } from './openGuideSource';

// 8개 도시가 같은 모달에서 실제 표시한 자료의 출처를 읽는다.
export default function CitySourcesModal({
  city,
  sources,
  story,
  onClose,
}: {
  city: DiscoveryDestination;
  sources: { label: string; url: string }[];
  story?: DiscoveryCity;
  onClose: () => void;
}) {
  // 모달을 다시 열면 이전 오류·요청 잠금을 재사용하지 않는다.
  const [error, setError] = useState('');
  // 외부 열기 한 건이 끝날 때까지 다른 출처 열기를 잠근다.
  const [busy, setBusy] = useState(false);
  // 닫힌 모달에 늦게 도착한 실패를 표시하지 않는다.
  const request = useRef({ active: true, busy: false });
  // StrictMode 재구독에서도 현재 모달의 수명만 추적한다.
  const active = useContext(ModalActive);
  useLayoutEffect(() => {
    // 렌더 중에는 참조를 읽지 않고 요청·정리에서만 사용한다.
    const current = request.current;
    current.active = active;
    return () => {
      // 닫기·도시 변경·화면 종료 후 이전 오류를 폐기한다.
      current.active = false;
    };
  }, [active]);
  // 실제 추가 소개가 있을 때만 발췌 출처를 붙인다.
  const storySource = storyAttribution(city, story);
  // 사용자 클릭에서 직접 원문을 열어 브라우저의 명시적 동작을 유지한다.
  function open(url: string): void {
    // 연속 탭과 닫힌 모달의 요청은 시작하지 않는다.
    if (request.current.busy || !request.current.active) return;
    request.current.busy = true;
    setBusy(true);
    setError('');
    try {
      // 동기 URL/창 오류와 비동기 OS 실패를 같은 복구 안내로 연결한다.
      void Promise.resolve(openGuideSource(url))
        .catch(failed)
        .finally(finished);
    } catch {
      // 동기 실패도 잠금을 풀어 같은 버튼으로 재시도하게 한다.
      failed();
      finished();
    }
  }
  // 원문 열기 실패만 안내하고 가이드 상태는 바꾸지 않는다.
  function failed(): void {
    // 외부 오류 원문이나 다른 도시의 실패를 사용자에게 전달하지 않는다.
    if (request.current.active)
      setError(
        '링크를 열지 못했어요. 연결이나 팝업 허용을 확인하고 같은 버튼을 다시 눌러 주세요. 가이드는 계속 볼 수 있어요.',
      );
  }
  // 현재 모달의 외부 열기 잠금만 해제한다.
  function finished(): void {
    // 닫힌 화면에는 상태 갱신을 보내지 않는다.
    request.current.busy = false;
    if (request.current.active) setBusy(false);
  }
  // 읽기·닫기만으로 외부 페이지를 열거나 로그인하지 않는다.
  return (
    <>
      <SafeAreaView style={[s.backdrop, { backgroundColor: 'transparent' }]}>
        <View accessibilityViewIsModal style={s.sheet}>
          <View style={{ padding: 20, gap: 10 }}>
            <Text accessibilityRole="header" style={s.title}>
              {city.city} 정보·사진 출처
            </Text>
            <Action label="출처 닫기" onPress={onClose} />
          </View>
          <ScrollView contentContainerStyle={s.detail}>
            <Text style={s.caption}>
              원문 열기나 이용 조건 열기를 누르면 선택한 사이트가 열려요.
            </Text>
            {error && (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            )}
            <Text accessibilityRole="header" style={s.title}>
              대표 사진
            </Text>
            <Attribution
              source={photoAttribution(city.key)}
              busy={busy}
              onOpen={open}
            />
            <Text accessibilityRole="header" style={s.title}>
              여행 정보 참고 자료
            </Text>
            <Text>
              소개·볼거리·먹거리·계절 안내는 TripPrint가 편집했어요. 참고한
              원문은 아래에서 확인할 수 있어요.
            </Text>
            {informationAttributions(sources).map((source) => (
              <Attribution
                key={source.id}
                source={source}
                busy={busy}
                onOpen={open}
              />
            ))}
            {storySource && (
              <>
                <Text accessibilityRole="header" style={s.title}>
                  도시 이야기 발췌
                </Text>
                <Attribution source={storySource} busy={busy} onOpen={open} />
              </>
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
    </>
  );
}

// 한 자료의 저작자·원문·이용 조건·변경 내용을 같은 영역에 표시한다.
function Attribution({
  source,
  busy,
  onOpen,
}: {
  source: GuideAttribution;
  busy: boolean;
  onOpen: (url: string) => void;
}) {
  // 사진 CC 라이선스를 관광청 원문에 일괄 적용하지 않는다.
  return (
    <View
      testID={`guide-source-${source.id === 'photo' || source.id === 'story' ? source.id : 'information'}`}
      style={styles.card}
    >
      <Text accessibilityRole="header" style={styles.label}>
        {source.title}
      </Text>
      <Text>저작자·제공자: {source.author}</Text>
      <Text selectable>원문: {source.sourceUrl}</Text>
      <Text>이용 조건: {source.license}</Text>
      <Text>변경·편집: {source.changes}</Text>
      {source.checkedAt && (
        <Text style={s.caption}>출처 확인일: {source.checkedAt}</Text>
      )}
      <Action
        label={`원문 열기 · ${source.title}`}
        disabled={busy}
        onPress={() => {
          // 선택한 자료 한 건의 원문만 연다.
          return onOpen(source.sourceUrl);
        }}
      />
      {source.licenseUrl && (
        <Action
          label={`이용 조건 열기 · ${source.license}`}
          disabled={busy}
          onPress={() => {
            // 해당 자료에 기록된 라이선스 주소만 연다.
            return onOpen(source.licenseUrl!);
          }}
        />
      )}
    </View>
  );
}
