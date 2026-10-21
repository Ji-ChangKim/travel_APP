import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

// 로컬 원본을 HTML의 cover·72%/30% 위치와 같은 계산으로 표시한다.
export default function HomeHeroBackground() {
  // 배경은 스크린 리더와 터치에서 제외하고 실제 카드 크기만 읽는다.
  const [size, setSize] = useState({ width: 0, height: 0 });
  const imageWidth = Math.max(size.width, size.height * 1.5);
  const imageHeight = imageWidth / 1.5;
  return (
    <View
      pointerEvents="none"
      accessible={false}
      aria-hidden
      style={StyleSheet.absoluteFill}
      onLayout={(event) => {
        // 글자 확대나 화면 회전으로 카드가 변하면 그림 위치도 다시 계산한다.
        return setSize(event.nativeEvent.layout);
      }}
    >
      <Image
        accessible={false}
        testID="home-hero-background-image"
        source={require('../../../assets/illustrations/home/tripprint-home-create-background.png')}
        style={{
          position: 'absolute',
          width: imageWidth,
          height: imageHeight,
          left: (size.width - imageWidth) * 0.72,
          top: (size.height - imageHeight) * 0.3,
        }}
      />
      <Svg
        width="100%"
        height="100%"
        accessible={false}
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          <LinearGradient
            id="homeCreateVertical"
            x1="0%"
            y1="0%"
            x2="0%"
            y2="100%"
          >
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.7} />
            <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0.95} />
          </LinearGradient>
          <LinearGradient
            id="homeCreateHorizontal"
            x1="0%"
            y1="0%"
            x2="80%"
            y2="0%"
          >
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.9} />
            <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0.5} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#homeCreateVertical)" />
        <Rect width="100%" height="100%" fill="url(#homeCreateHorizontal)" />
      </Svg>
    </View>
  );
}
