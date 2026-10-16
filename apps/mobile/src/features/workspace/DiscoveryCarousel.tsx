import Text from '@/components/AppText';
import { colors } from '@/constants/theme';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DiscoveryCity } from '@wherego/validation';
import { useDiscoveryCarousel } from './useDiscoveryCarousel';
import { discoveryStyles as s } from './discoveryStyles';

interface Props {
  cities: DiscoveryCity[];
  blocked: boolean;
  name: (city: DiscoveryCity) => string;
  renderCity: (city: DiscoveryCity) => ReactNode;
  onSelect: (city: DiscoveryCity) => void;
}
type Controller = ReturnType<typeof useDiscoveryCarousel>;

// 사진과 도시 이야기를 한 장씩 자동으로 넘기는 추천 영역을 제공한다.
export default function DiscoveryCarousel(props: Props) {
  // 상세 화면에서는 선택한 도시를 읽는 동안 배경 이동을 멈춘다.
  return (
    <CarouselContent
      {...props}
      carousel={useDiscoveryCarousel(props.cities.length, props.blocked)}
    />
  );
}

// 터치·키보드·마우스 조작과 자동 전환을 같은 카드 목록에 연결한다.
function CarouselContent({
  cities,
  name,
  renderCity,
  onSelect,
  carousel: {
    scroll,
    index: activeIndex,
    width,
    restricted,
    paused,
    toggle,
    layout,
    settled,
    interact,
    hover,
    pause,
    move,
  },
}: Props & { carousel: Controller }) {
  // 카드 세 장만 유지하며 자동 전환 때문에 사진이나 소개를 다시 조회하지 않는다.
  return (
    <View
      style={s.carousel}
      onLayout={(event) => {
        // 사용 가능한 너비를 측정해 한 카드씩 정확히 정렬한다.
        return layout(event.nativeEvent.layout.width);
      }}
    >
      <ScrollView
        ref={scroll}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        testID="destination-carousel"
        onScroll={(event) => {
          // 스크롤의 카드 경계만 선택 상태에 반영한다.
          return settled(event.nativeEvent.contentOffset.x);
        }}
        scrollEventThrottle={120}
        onScrollBeginDrag={() => {
          // 손으로 넘기기 시작하면 예약된 자동 이동을 취소한다.
          return interact(true);
        }}
        onScrollEndDrag={() => {
          // 손을 놓은 뒤 다시 자동으로 움직이기 전 읽을 시간을 준다.
          return interact(false);
        }}
        onTouchStart={() => {
          // 도시를 누르고 있는 동안 자동 이동하지 않는다.
          return interact(true);
        }}
        onTouchEnd={() => {
          // 단순 터치 뒤에도 사용자 조작 유예를 적용한다.
          return interact(false);
        }}
        onTouchCancel={() => {
          // 다른 제스처가 터치를 가져가도 누름 상태를 해제한다.
          return interact(false);
        }}
      >
        {cities.map((city, index) => {
          // 화면 밖 카드에 키보드 초점이 넘어가지 않게 한다.
          return (
            <View
              key={city.key}
              style={{ width: width || 1 }}
              aria-hidden={activeIndex !== index}
              importantForAccessibility={
                activeIndex === index ? 'auto' : 'no-hide-descendants'
              }
              accessibilityElementsHidden={activeIndex !== index}
            >
              <Pressable
                style={s.card}
                accessibilityRole="button"
                accessibilityLabel={`${name(city)} 여행지 살펴보기`}
                tabIndex={activeIndex === index ? 0 : -1}
                onPress={() => {
                  // 현재 도시의 실제 소개 원문을 연다.
                  return onSelect(city);
                }}
                onFocus={pause}
                onHoverIn={() => {
                  // 마우스로 도시를 읽을 때 자동 이동을 보류한다.
                  return hover(true);
                }}
                onHoverOut={() => {
                  // 마우스가 벗어나면 다음 전환 간격부터 재개한다.
                  return hover(false);
                }}
              >
                {renderCity(city)}
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
      <View style={s.carouselControls}>
        <View style={s.carouselDots}>
          {cities.map((city, index) => {
            // 색상 외에 길이로도 현재 카드 위치를 구분한다.
            return (
              <View
                key={city.key}
                style={[s.dot, activeIndex === index && s.activeDot]}
              />
            );
          })}
          <Text
            style={s.caption}
            testID="destination-carousel-position"
            accessibilityLiveRegion={restricted || paused ? 'polite' : 'none'}
            accessibilityLabel={`${cities[activeIndex] ? name(cities[activeIndex]) : '여행지'} · ${cities.length}개 중 ${activeIndex + 1}번째 여행지`}
          >
            {activeIndex + 1} / {cities.length}
          </Text>
        </View>
        <View style={s.carouselActions}>
          {!restricted && cities.length > 1 && (
            <CarouselButton
              label={
                paused ? '여행지 자동 넘김 재생' : '여행지 자동 넘김 일시정지'
              }
              icon={paused ? 'play' : 'pause'}
              onPress={toggle}
            />
          )}
          <CarouselButton
            label="이전 추천 여행지"
            icon="chevron-back"
            onFocus={pause}
            onPress={() => {
              // 현재 카드에서 한 장 이전으로 이동한다.
              return move(activeIndex - 1);
            }}
          />
          <CarouselButton
            label="다음 추천 여행지"
            icon="chevron-forward"
            onFocus={pause}
            onPress={() => {
              // 현재 카드에서 한 장 다음으로 이동한다.
              return move(activeIndex + 1);
            }}
          />
        </View>
      </View>
    </View>
  );
}

// 슬라이드 조작 버튼에 충분한 터치 영역과 읽기 이름을 제공한다.
function CarouselButton({
  label,
  icon,
  onPress,
  onFocus,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  onFocus?: Controller['pause'];
}) {
  // 기호만 보이더라도 보조 기술에서는 정확한 행동을 읽는다.
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      style={s.carouselButton}
      onPress={onPress}
      onFocus={onFocus}
    >
      <Ionicons name={icon} size={18} color={colors.text} />
    </Pressable>
  );
}
