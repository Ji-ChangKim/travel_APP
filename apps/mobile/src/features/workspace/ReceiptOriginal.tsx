import Text from '@/components/AppText';
import { useState } from 'react';
import { Image, ScrollView, View } from 'react-native';
import { usePrivatePhotoQuery } from './usePrivatePhoto';
import { LedgerAction } from './LedgerUI';
import ServerPhoto from './ServerPhoto';
import { ledgerStyles as l } from './ledgerTheme';

// 같은 폼 안에서 원본을 확대해도 입력과 이탈 보호 수명을 유지한다.
export default function ReceiptOriginal(props: {
  userId: string;
  tripId: string;
  mediaId: string;
  retained: boolean;
  disabled: boolean;
}) {
  return props.retained ? (
    <RetainedOriginal key={`${props.userId}:${props.mediaId}`} {...props} />
  ) : (
    <Text style={l.meta}>
      원본 사진을 보관하지 않은 기록이에요. 확인한 내용은 아래에서 볼 수 있어요.
    </Text>
  );
}

function RetainedOriginal(props: Parameters<typeof ReceiptOriginal>[0]) {
  const [expanded, setExpanded] = useState(false);
  const [width, setWidth] = useState(280);
  const [ratio, setRatio] = useState(1);
  const [failed, setFailed] = useState(false);
  const query = usePrivatePhotoQuery(props.userId, props.tripId, props.mediaId);
  return (
    <View
      style={l.card}
      onLayout={(event) =>
        setWidth(Math.max(1, event.nativeEvent.layout.width - 32))
      }
    >
      {!expanded || !query.data || query.isError || failed ? (
        <ServerPhoto
          userId={props.userId}
          tripId={props.tripId}
          mediaId={props.mediaId}
          fit="contain"
        />
      ) : (
        <ScrollView
          horizontal
          accessibilityLabel="확대한 영수증 원본. 좌우로 이동할 수 있어요."
        >
          <Image
            source={{ uri: query.data }}
            resizeMode="contain"
            accessibilityLabel="영수증 원본"
            style={{ width: width * 2, height: (width * 2) / ratio }}
            onLoad={(event) => {
              const source = event.nativeEvent.source;
              if (source.width && source.height)
                setRatio(source.width / source.height);
            }}
            onError={() => setFailed(true)}
          />
        </ScrollView>
      )}
      <LedgerAction
        label={expanded ? '원본 접고 입력 계속' : '원본 확대'}
        disabled={props.disabled || !query.data || query.isError}
        onPress={() => {
          setFailed(false);
          setExpanded(!expanded);
        }}
      />
    </View>
  );
}
