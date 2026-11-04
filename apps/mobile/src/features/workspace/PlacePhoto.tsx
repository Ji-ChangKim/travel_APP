import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  View,
} from 'react-native';
import { colors } from '@/constants/theme';
import Text from '@/components/AppText';
import { communityStyles as s } from './communityStyles';
import { Action } from './ui';
import { GoogleAttribution } from './GooglePlace';
import { usePlacePhoto } from './usePlacePhoto';

// 현재 DAY의 장소마다 실제 Google 대표 사진과 출처를 표시한다.
export default function PlacePhoto({
  postId,
  preview,
  scheduleId,
  title,
}: {
  postId?: string;
  preview?: { tripId: string; userId: string };
  scheduleId: string;
  title: string;
}) {
  useLocale();
  const {
    photo,
    failed,
    isError,
    isPending,
    isFetching,
    errorMessage,
    retryPhoto,
    markImageFailed,
  } = usePlacePhoto({ postId, preview, scheduleId });
  return (
    <View style={{ gap: 8 }}>
      {photo && !isError && !failed ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('{p0} Google Maps 사진 원본 보기', {
              p0: title,
            })}
            onPress={() => {
              // 작은 사진은 저작자 정보가 있는 Google 원본으로 연결한다.
              return void Linking.openURL(photo.sourceUrl).catch(() => {
                // 외부 사진 실행 실패에도 여행계획은 계속 읽을 수 있다.
                return undefined;
              });
            }}
            style={{ width: 88, minHeight: 88 }}
          >
            <Image
              source={{ uri: photo.imageUrl, cache: 'reload' }}
              style={{ width: 88, height: 88, borderRadius: 12 }}
              resizeMode="cover"
              resizeMethod="resize"
              accessibilityLabel={t('{p0} Google 장소 사진', { p0: title })}
              onError={markImageFailed}
            />
          </Pressable>
        </>
      ) : (
        <PlacePhotoPlaceholder
          failed={failed}
          isError={isError}
          isPending={isPending}
          errorMessage={errorMessage}
        />
      )}
      <GoogleAttribution />
      {(failed || isError) && (
        <View style={{ gap: 8 }}>
          <Text style={s.meta}>
            {isError ? errorMessage : t('장소 사진을 표시하지 못했어요.')}
          </Text>
          <Action
            variant="quiet"
            label={t('사진 다시 불러오기')}
            accessibilityLabel={t('{p0} 사진 다시 불러오기', { p0: title })}
            loading={isFetching}
            onPress={retryPhoto}
          />
        </View>
      )}
    </View>
  );
}

// 사진 크기를 유지하면서 불러오는 중·오류·사진 없음 상태를 구분해 알린다.
function PlacePhotoPlaceholder({
  failed,
  isError,
  isPending,
  errorMessage,
}: {
  failed: boolean;
  isError: boolean;
  isPending: boolean;
  errorMessage: string;
}) {
  return (
    <View
      accessibilityLabel={
        failed
          ? t('장소 사진을 표시하지 못했어요. 다시 불러와 주세요.')
          : (isError ? errorMessage : '') ||
            (isPending
              ? '장소 사진을 불러오는 중이에요.'
              : 'Google에 등록된 장소 사진이 없어요.')
      }
      style={{
        width: 88,
        height: 88,
        borderRadius: 12,
        backgroundColor: colors.surfaceMuted,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {isPending ? (
        <ActivityIndicator color={colors.muted} />
      ) : (
        <Text style={s.meta}>{failed || isError ? '!' : '—'}</Text>
      )}
    </View>
  );
}
