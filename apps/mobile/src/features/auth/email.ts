import { z } from 'zod';

// 로그인은 기존 계정의 비밀번호 길이 정책을 바꾸지 않는다.
export const emailLoginSchema = z.object({
  email: z
    .string()
    .trim()
    .email('올바른 이메일 주소를 입력해 주세요.')
    .max(254),
  password: z.string().min(1, '비밀번호를 입력해 주세요.').max(128),
});

// 신규 가입의 닉네임과 최소 비밀번호 길이를 검증한다.
export const emailSignupSchema = emailLoginSchema
  .extend({
    nickname: z
      .string()
      .trim()
      .min(2, '닉네임은 2자 이상 입력해 주세요.')
      .max(30, '닉네임은 30자 이하로 입력해 주세요.'),
    password: z.string().min(8, '비밀번호는 8자 이상 입력해 주세요.').max(128),
    confirmation: z.string(),
  })
  .refine(
    (value) => {
      // 비밀번호를 화면에서 재확인한 뒤 계정을 생성한다.
      return value.password === value.confirmation;
    },
    { message: '비밀번호 확인이 일치하지 않습니다.', path: ['confirmation'] },
  );
