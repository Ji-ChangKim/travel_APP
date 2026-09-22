import { z } from 'zod';

// 여행 생성 시 입력값의 유효성을 검증하는 스키마를 정의한다.
export const tripCreateSchema = z
  .object({
    title: z
      .string()
      .min(2, { message: '여행 제목을 2글자 이상 입력해 주세요.' })
      .max(50, { message: '여행 제목은 50글자 이하여야 합니다.' }),
    country: z.string().min(1, { message: '국가를 선택하거나 입력해 주세요.' }),
    city: z.string().min(1, { message: '도시를 입력해 주세요.' }),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
      message: 'YYYY-MM-DD 형식으로 입력해 주세요.',
    }),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
      message: 'YYYY-MM-DD 형식으로 입력해 주세요.',
    }),
    coverColor: z.string().default('#246A54'),
  })
  .refine((data) => data.startDate <= data.endDate, {
    message: '종료일은 시작일 이후여야 합니다.',
    path: ['endDate'],
  });

// 여행 생성 폼의 타입 추론을 정의한다.
export type TripCreateInput = z.infer<typeof tripCreateSchema>;

// 장소 및 일정 아이템 등록 시 입력값을 검증하는 스키마를 정의한다.
export const itineraryItemCreateSchema = z.object({
  name: z.string().min(1, { message: '장소 이름을 입력해 주세요.' }),
  category: z.enum(['stay', 'food', 'cafe', 'sightseeing', 'activity', 'etc']),
  timeSlot: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, {
      message: 'HH:MM 형식으로 입력해 주세요.',
    })
    .optional()
    .or(z.literal('')),
  memo: z
    .string()
    .max(200, { message: '메모는 200자 이내로 입력해 주세요.' })
    .optional(),
});

// 일정 아이템 생성 폼의 타입 추론을 정의한다.
export type ItineraryItemCreateInput = z.infer<
  typeof itineraryItemCreateSchema
>;

// 일정 유형별(장소, 이동, 숙소 등) 생성 스키마를 정의한다.
export const scheduleCreateSchema = z.object({
  title: z.string().min(1, { message: '일정 제목을 입력해 주세요.' }),
  type: z
    .enum(['PLACE', 'TRANSPORT', 'STAY', 'RESERVATION', 'TODO', 'MEMO'])
    .default('PLACE'),
  timeSlot: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, {
      message: 'HH:MM 형식으로 입력해 주세요.',
    })
    .optional()
    .or(z.literal('')),
  estimatedCost: z.number().min(0).optional(),
  memo: z
    .string()
    .max(300, { message: '메모는 300자 이내로 입력해 주세요.' })
    .optional(),
});

export type ScheduleCreateInput = z.infer<typeof scheduleCreateSchema>;

// 가계부 지출 항목 등록 시 입력값을 검증하는 스키마를 정의한다.
export const expenseCreateSchema = z.object({
  title: z.string().min(1, { message: '지출 항목명을 입력해 주세요.' }),
  amount: z.number().positive({ message: '금액은 0보다 커야 합니다.' }),
  currency: z.string().default('KRW'),
  category: z
    .enum(['food', 'transport', 'stay', 'activity', 'shopping', 'etc'])
    .default('food'),
  isActual: z.boolean().default(true),
});

export type ExpenseCreateInput = z.infer<typeof expenseCreateSchema>;

// 체크리스트 준비물 등록 시 입력값을 검증하는 스키마를 정의한다.
export const checklistItemCreateSchema = z.object({
  title: z.string().min(1, { message: '준비물 항목을 입력해 주세요.' }),
});

export type ChecklistItemCreateInput = z.infer<
  typeof checklistItemCreateSchema
>;

// 방문 후기 작성 시 입력값을 검증하는 스키마를 정의한다.
export const reviewCreateSchema = z.object({
  rating: z.number().min(1).max(5),
  content: z
    .string()
    .min(5, { message: '후기를 최소 5자 이상 작성해 주세요.' }),
});

// 리뷰 생성 폼의 타입 추론을 정의한다.
export type ReviewCreateInput = z.infer<typeof reviewCreateSchema>;
