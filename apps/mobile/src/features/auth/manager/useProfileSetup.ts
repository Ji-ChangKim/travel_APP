import { UserFacingError } from '@/services/userFacingError';
import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { Keyboard, Platform } from 'react-native';
import type { Profile } from '@wherego/domain';
import {
  profileDraft,
  retainProfileDraft,
  clearProfileDraft,
} from '../model/profileDraft';
import { useAuthReady } from './authReadiness';
import { useTripStore } from '@/stores/useTripStore';
import { fetchUserProfile } from '@/services/profileService';
import {
  completeProfile,
  confirmProfileOperation,
  pendingProfileOperation,
  profileAvatars,
  rememberProfileOperation,
  type ProfileAvatar,
} from '@/services/profileOnboardingService';
import {
  pickProfilePhoto,
  uploadProfilePhoto,
  profilePhotoPreview,
} from '@/services/profilePhotoService';
import {
  profileInput,
  type ProfileImageChoice,
} from '../model/profileOnboarding';
import { completedDestination } from '../model/destination';
import { authReturn } from '../model/authReturn';
import {
  completeFormExit,
  requestScheduleExit,
  useScheduleExitGuard,
} from '@/features/workspace/schedule/ui/scheduleExitGuard';

export function useProfileSetup() {
  const router = useRouter();
  const params = useLocalSearchParams<Record<string, string>>();
  const client = useQueryClient();
  const user = useTripStore((state) => state.currentUser);
  const account = user?.id;
  const authReady = useAuthReady((state) => state.ready);
  const [ready, setReady] = useState(false);
  const [completedTarget, setCompletedTarget] = useState<Href | null>(null);
  const [nickname, setNickname] = useState(
    profileDraft(account)?.nickname || '',
  );
  const [focused, setFocused] = useState(false);
  const [touched, setTouched] = useState(false);
  const [image, setImage] = useState<ProfileImageChoice>(
    profileDraft(account)?.image || { type: 'default' },
  );
  const [avatars, setAvatars] = useState<ProfileAvatar[]>([]);
  const [photoHeaders, setPhotoHeaders] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [picker, setPicker] = useState(false);
  const [revision, setRevision] = useState(0);
  const operation = useRef<{ id: string; signature: string } | null>(null);
  const alive = useRef(true);
  const lock = useRef(false);
  const input = profileInput(nickname);
  useEffect(
    () => () => {
      if (
        Platform.OS === 'web' &&
        image.type === 'photo' &&
        image.uri.startsWith('blob:')
      )
        URL.revokeObjectURL(image.uri);
    },
    [image],
  );
  useEffect(() => {
    if (account && ready) retainProfileDraft(account, nickname, image);
  }, [account, ready, nickname, image]);
  const current = () =>
    alive.current && useTripStore.getState().currentUser?.id === account;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  function login() {
    router.replace({
      pathname: '/login',
      params: {
        ...authReturn(params.next, params.destination, params.tripId, params),
        force_auth_entry: '1',
      },
    });
  }
  useScheduleExitGuard(
    ready && account && !completedTarget
      ? { kind: 'profile', id: account, values: { nickname, image } }
      : null,
    !completedTarget && (busy || uploading || checking),
    () => {
      setNickname('');
      setImage({ type: 'default' });
    },
  );
  function back() {
    if (picker) {
      setPicker(false);
      return;
    }
    if (Keyboard.isVisible()) {
      Keyboard.dismiss();
      return;
    }
    requestScheduleExit(login);
  }
  async function finish(profile: Profile) {
    if (!current()) return;
    useTripStore.getState().updateProfile(profile);
    if (account) clearProfileDraft(account);
    client.setQueryData(['member-profile', account], profile);
    const target = await completedDestination(
      params.next,
      params.destination,
      params.tripId,
      false,
      authReturn(params.next, params.destination, params.tripId, params),
    );
    if (current()) setCompletedTarget(target);
  }
  useEffect(() => {
    if (completedTarget)
      completeFormExit(() => router.replace(completedTarget));
  }, [completedTarget, router]);
  useEffect(() => {
    let active = true;
    if (!authReady) return;
    if (!user || user.authProvider === 'guest') {
      login();
      return;
    }
    void (async () => {
      const profile = await fetchUserProfile(user.id);
      if (!active || !current() || !profile) return;
      if (profile.onboardingCompleted) {
        await finish(profile);
        return;
      }
      const pending = await pendingProfileOperation(user.id);
      if (pending) {
        const result = await confirmProfileOperation(user.id, pending);
        if (!active || !current()) return;
        if (result.state === 'confirmed' && result.profile) {
          await finish(result.profile);
          return;
        }
      }
      const available = await profileAvatars(user.id);
      const draft = profileDraft(user.id);
      if (draft?.image.type === 'photo') {
        const preview = await profilePhotoPreview(user.id, draft.image.id);
        if (active && current()) {
          setImage({ ...draft.image, uri: preview.uri });
          setPhotoHeaders(preview.headers);
        } else if (Platform.OS === 'web') URL.revokeObjectURL(preview.uri);
      }
      if (active && current()) {
        setAvatars(available);
        setError('');
        setReady(true);
      }
    })().catch(() => {
      if (active && current())
        setError(
          '프로필을 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.',
        );
    });
    return () => {
      active = false;
    };
    // 계정과 명시적인 재시도만 초기 조회를 다시 시작하며 입력을 응답으로 덮어쓰지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, authReady, revision]);

  async function photo(camera: boolean) {
    if (lock.current || !account) return;
    lock.current = true;
    setPicker(false);
    setUploading(true);
    setError('');
    try {
      const asset = await pickProfilePhoto(camera);
      if (!asset || !current()) return;
      const selected = await uploadProfilePhoto(account, asset);
      const preview = await profilePhotoPreview(account, selected.id);
      if (current()) {
        setImage({ ...selected, uri: preview.uri });
        setPhotoHeaders(preview.headers);
      } else if (Platform.OS === 'web') URL.revokeObjectURL(preview.uri);
    } catch (failure) {
      if (current())
        setError(
          failure instanceof UserFacingError
            ? failure.message
            : '사진을 불러오지 못했어요. 다시 시도하거나 다른 사진을 선택해 주세요.',
        );
    } finally {
      lock.current = false;
      if (current()) setUploading(false);
    }
  }
  async function save() {
    if (!account || !ready || lock.current || input.error || uploading) return;
    lock.current = true;
    setBusy(true);
    setError('');
    setTouched(true);
    setNickname(input.nickname);
    const signature = JSON.stringify({ nickname: input.nickname, image });
    try {
      // 결과가 불명확한 이전 제출을 확인한 뒤 다음 저장을 시작한다.
      if (operation.current) {
        setChecking(true);
        const existing = await confirmProfileOperation(
          account,
          operation.current.id,
        );
        if (existing.state === 'confirmed' && existing.profile) {
          await finish(existing.profile);
          return;
        }
        if (!current()) return;
      }
      if (!operation.current || operation.current.signature !== signature)
        operation.current = { id: Crypto.randomUUID(), signature };
      await rememberProfileOperation(account, operation.current.id);
      if (!current()) return;
      setChecking(false);
      await finish(
        await completeProfile(
          account,
          operation.current.id,
          input.nickname,
          image,
        ),
      );
    } catch {
      if (current()) {
        setChecking(true);
        try {
          const result =
            operation.current &&
            (await confirmProfileOperation(account, operation.current.id));
          if (result && result.state === 'confirmed' && result.profile) {
            await finish(result.profile);
            return;
          }
        } catch {
          /* 결과를 확인할 때까지 같은 작업 ID를 유지한다. */
        }
        if (current())
          setError(
            '프로필을 저장하지 못했어요. 입력한 내용은 그대로예요. 다시 시도해 주세요.',
          );
      }
    } finally {
      lock.current = false;
      if (current()) {
        setBusy(false);
        setChecking(false);
      }
    }
  }
  return {
    ready,
    nickname,
    setNickname,
    touched,
    focused,
    focus: () => setFocused(true),
    input,
    image,
    avatars,
    photoHeaders,
    busy,
    checking,
    uploading,
    error,
    picker,
    setPicker,
    back,
    save,
    photo,
    setImage: (choice: ProfileImageChoice) => {
      if (!lock.current) {
        setImage(choice);
        setPicker(false);
      }
    },
    blur: () => {
      setFocused(false);
      setTouched(true);
      setNickname(input.nickname);
    },
    retry: () => {
      setReady(false);
      setRevision((value) => value + 1);
    },
  };
}
