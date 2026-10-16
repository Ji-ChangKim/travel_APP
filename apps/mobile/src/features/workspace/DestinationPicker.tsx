import TextInput from '@/components/DesignInput';
import Text from '@/components/AppText';
import DesignButton from '@/components/DesignButton';
import { colors } from '@/constants/theme';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Action, styles } from './ui';
import { searchCountries, countryInputError } from './countries';
import { useFormScope } from './InputFeedback';
import { countryRegion, matchesDestination } from './countryRegions';

// 국가별 주요 도시를 기기에 포함해 연결 상태와 관계없이 선택할 수 있게 한다.
export const countryCities: Record<string, readonly string[]> = {
  대한민국: [
    '서울',
    '부산',
    '제주',
    '경주',
    '강릉',
    '여수',
    '전주',
    '인천',
    '대구',
    '대전',
    '속초',
  ],
  일본: [
    '도쿄',
    '오사카',
    '나고야',
    '교토',
    '후쿠오카',
    '삿포로',
    '오키나와',
    '고베',
    '나라',
    '히로시마',
    '와카야마',
    '가나자와',
    '센다이',
    '가고시마',
  ],
  미국: [
    '뉴욕',
    '로스앤젤레스',
    '샌프란시스코',
    '라스베이거스',
    '시애틀',
    '시카고',
    '보스턴',
    '워싱턴 D.C.',
    '호놀룰루',
    '마이애미',
    '올랜도',
  ],
  프랑스: ['파리', '니스', '리옹', '마르세유', '보르도', '스트라스부르'],
  영국: ['런던', '에든버러', '맨체스터', '리버풀', '옥스퍼드', '바스'],
  이탈리아: ['로마', '밀라노', '베네치아', '피렌체', '나폴리', '볼로냐'],
  스페인: ['바르셀로나', '마드리드', '세비야', '그라나다', '발렌시아'],
  독일: ['베를린', '뮌헨', '프랑크푸르트', '함부르크', '쾰른', '드레스덴'],
  중국: [
    '상하이',
    '베이징',
    '칭다오',
    '광저우',
    '청두',
    '시안',
    '항저우',
    '장자제',
  ],
  대만: ['타이베이', '가오슝', '타이중', '타이난', '화롄'],
  태국: ['방콕', '치앙마이', '푸껫', '파타야', '끄라비', '코사무이'],
  베트남: [
    '다낭',
    '하노이',
    '호찌민',
    '나트랑',
    '호이안',
    '달랏',
    '푸꾸옥',
    '후에',
  ],
  필리핀: ['마닐라', '세부', '보라카이', '보홀', '푸에르토프린세사'],
  싱가포르: ['싱가포르'],
  홍콩: ['홍콩'],
  마카오: ['마카오'],
  괌: ['괌'],
  북마리아나제도: ['사이판', '티니안'],
  말레이시아: ['쿠알라룸푸르', '코타키나발루', '페낭', '랑카위', '말라카'],
  인도네시아: ['발리', '자카르타', '욕야카르타', '롬복', '수라바야'],
  호주: [
    '시드니',
    '멜버른',
    '브리즈번',
    '골드코스트',
    '퍼스',
    '케언스',
    '애들레이드',
  ],
  뉴질랜드: ['오클랜드', '퀸스타운', '크라이스트처치', '웰링턴', '로토루아'],
  캐나다: ['밴쿠버', '토론토', '몬트리올', '퀘벡', '캘거리', '오타와'],
  스위스: ['취리히', '루체른', '인터라켄', '제네바', '베른', '체르마트'],
  오스트리아: ['빈', '잘츠부르크', '인스브루크', '할슈타트'],
  체코: ['프라하', '체스키크룸로프', '브르노'],
  헝가리: ['부다페스트', '데브레첸', '페치'],
  포르투갈: ['리스본', '포르투', '신트라', '파루'],
  그리스: ['아테네', '산토리니', '미코노스', '테살로니키'],
  네덜란드: ['암스테르담', '로테르담', '헤이그', '위트레흐트'],
  벨기에: ['브뤼셀', '브뤼허', '안트베르펜', '헨트'],
  튀르키예: ['이스탄불', '앙카라', '괴레메', '안탈리아', '이즈미르'],
  아랍에미리트: ['두바이', '아부다비', '샤르자'],
  인도: ['뉴델리', '뭄바이', '자이푸르', '아그라', '바라나시'],
  네팔: ['카트만두', '포카라'],
  캄보디아: ['시엠레아프', '프놈펜'],
  라오스: ['비엔티안', '루앙프라방', '방비엥'],
  몽골: ['울란바토르', '달란자드가드'],
  몰디브: ['말레'],
  멕시코: ['멕시코시티', '칸쿤', '과달라하라', '오아하카'],
  브라질: ['상파울루', '리우데자네이루', '브라질리아'],
  페루: ['리마', '쿠스코', '아레키파'],
  아르헨티나: ['부에노스아이레스', '우수아이아'],
  이집트: ['카이로', '룩소르', '아스완', '후르가다'],
  모로코: ['마라케시', '카사블랑카', '페스'],
  남아프리카공화국: ['케이프타운', '요하네스버그', '더반'],
  핀란드: ['헬싱키', '로바니에미'],
  노르웨이: ['오슬로', '베르겐', '트롬쇠'],
  스웨덴: ['스톡홀름', '예테보리'],
  덴마크: ['코펜하겐', '오르후스'],
  아이슬란드: ['레이캬비크', '아퀴레이리'],
  크로아티아: ['두브로브니크', '자그레브', '스플리트'],
};

// 복수 시간대 국가에서 도시별 기본 시간대를 보정한다.
export const cityTimezones: Record<string, string> = {
  로스앤젤레스: 'America/Los_Angeles',
  샌프란시스코: 'America/Los_Angeles',
  라스베이거스: 'America/Los_Angeles',
  시애틀: 'America/Los_Angeles',
  시카고: 'America/Chicago',
  호놀룰루: 'Pacific/Honolulu',
  밴쿠버: 'America/Vancouver',
  캘거리: 'America/Edmonton',
  토론토: 'America/Toronto',
  몬트리올: 'America/Toronto',
  퀘벡: 'America/Toronto',
  오타와: 'America/Toronto',
  멜버른: 'Australia/Melbourne',
  브리즈번: 'Australia/Brisbane',
  골드코스트: 'Australia/Brisbane',
  케언스: 'Australia/Brisbane',
  퍼스: 'Australia/Perth',
  애들레이드: 'Australia/Adelaide',
  발리: 'Asia/Makassar',
  롬복: 'Asia/Makassar',
  자카르타: 'Asia/Jakarta',
  욕야카르타: 'Asia/Jakarta',
  수라바야: 'Asia/Jakarta',
};

interface Props {
  kind: 'country' | 'city';
  country: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}

// 나라와 도시의 직접 입력과 목록 검색을 하나의 입력란으로 연결한다.
export default function DestinationPicker({
  kind,
  country,
  onSelect,
  onClose,
}: Props) {
  // 대륙과 지역은 목록 탐색 상태이며 선택한 여행지를 바꾸지 않는다.
  const [query, setQuery] = useState('');
  const [continent, setContinent] = useState('아시아');
  const [region, setRegion] = useState('');
  const locked = useFormScope().locked;
  const countries = searchCountries(query);
  const continents = [
    ...new Set(
      searchCountries('').map((item) => {
        // 정책을 통과한 국가만 대륙 탐색에 포함한다.
        return countryRegion(item.code).continent;
      }),
    ),
  ];
  const regions = [
    ...new Set(
      searchCountries('')
        .filter((item) => {
          // 선택 대륙에 속한 지역만 표시한다.
          return countryRegion(item.code).continent === continent;
        })
        .map((item) => {
          // 지역 이름의 중복을 제거한다.
          return countryRegion(item.code).region;
        }),
    ),
  ];
  const visible = countries.filter((item) => {
    // 직접 입력 중에는 대륙 필터를 넘어 모든 나라를 찾는다.
    return (
      Boolean(query.trim()) ||
      (countryRegion(item.code).continent === continent &&
        (!region || countryRegion(item.code).region === region))
    );
  });
  const cities = (countryCities[country] || []).filter((city) => {
    // 도시에도 같은 초성 검색을 적용한다.
    return matchesDestination(city, query);
  });
  const error = kind === 'country' ? countryInputError(query) : '';
  return (
    <>
      <SafeAreaView style={s.screen}>
        <View style={s.header}>
          <DesignButton
            label=""
            accessibilityLabel="선택 닫기"
            size="icon"
            variant="quiet"
            disabled={locked}
            onPress={onClose}
            icon={(color) => {
              /* 선택창 닫기에도 공통 상태색을 사용한다. */ return (
                <Ionicons name="arrow-back" size={24} color={color} />
              );
            }}
          />
          <Text style={[styles.title, { flex: 1, marginLeft: 8 }]}>
            {kind === 'country' ? '나라 선택' : `${country} · 도시 선택`}
          </Text>
        </View>
        <TextInput
          editable={!locked}
          accessibilityLabel={`${kind === 'country' ? '나라' : '도시'} 직접 입력`}
          placeholder="직접 입력하기"
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={query}
          maxLength={50}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
        {kind === 'country' && !query.trim() ? (
          <>
            <ScrollView
              horizontal
              style={{ flexGrow: 0 }}
              contentContainerStyle={{ gap: 8 }}
            >
              {continents.map((name) => (
                <Action
                  key={name}
                  label={name}
                  size="chip"
                  selected={continent === name}
                  onPress={() => {
                    // 대륙을 바꾸면 이전 지역 필터를 해제한다.
                    return void (setContinent(name), setRegion(''));
                  }}
                />
              ))}
            </ScrollView>
            <ScrollView
              horizontal
              style={{ flexGrow: 0 }}
              contentContainerStyle={{ gap: 8 }}
            >
              <Action
                label="전체 지역"
                selected={!region}
                onPress={() => {
                  // 선택 대륙 전체의 나라를 표시한다.
                  return setRegion('');
                }}
              />
              {regions.map((name) => (
                <Action
                  key={name}
                  label={name}
                  size="chip"
                  selected={region === name}
                  onPress={() => {
                    // 지역 필터만 변경한다.
                    return setRegion(name);
                  }}
                />
              ))}
            </ScrollView>
          </>
        ) : null}
        {kind === 'city' ? (
          <Action
            label="도시 없이 진행"
            onPress={() => {
              // 도시가 없어도 국가와 여행 기간으로 계속 진행한다.
              return onSelect('');
            }}
          />
        ) : null}
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.list}
        >
          {kind === 'country'
            ? visible.map((item) => (
                <View key={item.code} style={styles.card}>
                  <DesignButton
                    label={item.country}
                    disabled={locked}
                    onPress={() => {
                      /* 정식 국가 이름 하나만 입력에 적용한다. */ return onSelect(
                        item.country,
                      );
                    }}
                  />
                  <Text style={styles.subtitle}>
                    {countryRegion(item.code).continent} ·{' '}
                    {countryRegion(item.code).region}
                  </Text>
                </View>
              ))
            : cities.map((city) => (
                <Action
                  key={city}
                  label={city}
                  onPress={() => {
                    // 선택한 도시만 적용한다.
                    return onSelect(city);
                  }}
                />
              ))}
          {query.trim() &&
          !(kind === 'country' ? visible.length : cities.length) &&
          !/^[ㄱ-ㅎ\s]+$/.test(query) ? (
            <Action
              label="입력한 이름 적용"
              disabled={locked || Boolean(error)}
              variant="primary"
              onPress={() => {
                // 목록에 없는 이름도 입력 길이와 기존 국가 정책을 지킨다.
                return onSelect(query.trim());
              }}
            />
          ) : null}
          {kind === 'city' && !cities.length && !query ? (
            <Text style={styles.subtitle}>
              도시를 비워 두거나 위에 이름을 입력해 주세요.
            </Text>
          ) : null}
          {error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, padding: 20, gap: 16, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  close: { padding: 10, minWidth: 44, minHeight: 44 },
  list: { paddingBottom: 24, gap: 8 },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  optionText: { color: colors.text, fontSize: 16 },
});
