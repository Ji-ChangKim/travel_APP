import { useRef, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { z } from 'zod';
import { GoogleAttribution, googlePlaceSchema } from './GooglePlace';
import { requestFoundation } from '@wherego/api-client';
import { serverOptions } from './service';
import { Action, Field, styles } from './ui';

const resultSchema = z.array(googlePlaceSchema);
type Place = z.infer<typeof resultSchema>[number];

// 장소를 검색한 뒤 선택한 결과만 편집 중 일정에 반영한다.
export default function PlaceSearch({
  userId,
  city,
  disabled,
  onSelect,
}: {
  userId: string;
  city: string;
  disabled: boolean;
  onSelect: (placeId: string, authoredTitle: string) => void;
}) {
  // 검색 결과는 현재 팝업에만 보관한다.
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(0);
  // 검색어 수정은 이전 검색 응답을 무효화한다.
  function change(value: string): void {
    // 이전 요청 결과를 새 검색어에 섞지 않는다.
    request.current += 1;
    setQuery(value);
    setResults([]);
    setBusy(false);
    setError('');
  }
  // 서버 인증과 실제 지도 공급자 검색을 연결한다.
  function search(): void {
    // 현재 요청만 결과를 적용할 수 있다.
    const current = ++request.current;
    setBusy(true);
    setError('');
    serverOptions(userId)
      .then((options) => {
        // 여행 도시를 검색 문맥에 포함한다.
        return requestFoundation(
          options,
          `/places/search?q=${encodeURIComponent(`${city} ${query.trim()}`.trim())}`,
        );
      })
      .then((response) => {
        // 늦게 도착한 이전 검색 결과는 버린다.
        if (current === request.current)
          setResults(resultSchema.parse(response.data));
      })
      .catch(() => {
        // 실패에서도 검색어와 작성 내용은 유지한다.
        if (current === request.current)
          setError(
            '지도 검색을 사용할 수 없습니다. 연결을 확인하거나 외부 지도에서 확인해 주세요.',
          );
      })
      .finally(() => {
        // 현재 검색의 로딩 상태만 해제한다.
        if (current === request.current) setBusy(false);
      });
  }
  // 검색과 원본 지도 확인을 입력 폼보다 먼저 제공한다.
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Google Maps에서 장소 검색</Text>
      <Field label="장소 검색어" value={query} onChange={change} />
      <View style={styles.row}>
        <Action
          label={busy ? '검색 중…' : '지도 검색'}
          disabled={disabled || busy || query.trim().length < 2}
          onPress={search}
        />
        <Action
          label="Google Maps 열기"
          disabled={disabled || !query.trim()}
          onPress={() => {
            // 공급자 실패에도 공식 지도에서 직접 확인할 수 있다.
            void Linking.openURL(
              `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${city} ${query}`)}`,
            ).catch(() => {
              // 외부 앱 실행 실패를 알려 준다.
              setError('지도를 열지 못했습니다. 다시 시도해 주세요.');
            });
          }}
        />
      </View>
      {error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      {results.length > 0 && (
        <View>
          <Text>검색 결과 · 선택 후 내용을 확인해 주세요.</Text>
          <GoogleAttribution />
        </View>
      )}
      {results.map((place) => (
        <View key={place.id}>
          <Text>{place.address}</Text>
          {place.attributions.length > 0 && (
            <GoogleAttribution attributions={place.attributions} />
          )}
          <Action
            label={`선택: ${place.title}`}
            disabled={disabled}
            onPress={() => {
              // 공급자 이름·주소는 저장하지 않고 장소 ID와 사용자가 입력한 제목만 전달한다.
              onSelect(place.id, query.trim().slice(0, 100));
            }}
          />
        </View>
      ))}
    </View>
  );
}
