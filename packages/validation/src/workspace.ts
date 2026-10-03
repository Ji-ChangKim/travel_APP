import { z } from 'zod';
import {
  calendarDateSchema,
  decimalExpenseSchema,
  foundationUuidSchema,
  isAllowedTripPeriod,
} from './foundation';

// 일정·사진·지출 입력에서 UUID 부모를 재사용한다.
const idInput = z.object({ id: foundationUuidSchema }).strict();
const optionalId = foundationUuidSchema.optional();
const title = z.string().trim().min(1).max(100);
const roles = z.enum(['editor', 'viewer']);
export const scheduleInputSchema = z
  .object({
    id: foundationUuidSchema,
    dayId: foundationUuidSchema,
    title,
    type: z.enum(['PLACE', 'TRANSPORT', 'STAY', 'RESERVATION', 'TODO', 'MEMO']),
    timeSlot: z
      .string()
      .regex(/^$|^([01]\d|2[0-3]):[0-5]\d$/)
      .default(''),
    sortOrder: z.number().int().positive().max(10000),
    memo: z.string().max(300).default(''),
    address: z.string().max(200).default(''),
    googlePlaceId: z
      .string()
      .regex(/^[A-Za-z0-9_-]{1,200}$|^$/)
      .optional(),
  })
  .strict();
export const expenseInputSchema = z
  .object({
    id: foundationUuidSchema,
    dayId: optionalId,
    scheduleId: optionalId,
    title,
    amount: z.string(),
    currency: z.enum(['KRW', 'JPY', 'USD']),
    category: z.enum([
      'food',
      'transport',
      'stay',
      'activity',
      'shopping',
      'etc',
    ]),
    isActual: z.boolean(),
  })
  .strict()
  .refine((value) => {
    // 통화별 소수 규칙은 공통 검증을 사용한다.
    return decimalExpenseSchema.safeParse({
      amount: value.amount,
      currency: value.currency,
    }).success;
  });
export const receiptInputSchema = z
  .object({
    id: foundationUuidSchema,
    dayId: foundationUuidSchema,
    scheduleId: optionalId,
    mediaId: foundationUuidSchema,
    merchant: title,
    transactionDate: calendarDateSchema,
    amount: z.string(),
    currency: z.enum(['KRW', 'JPY', 'USD']),
    details: z.string().max(1000).default(''),
  })
  .strict()
  .refine((value) => {
    // 사용자가 확인한 금액만 실제 지출로 저장한다.
    return decimalExpenseSchema.safeParse({
      amount: value.amount,
      currency: value.currency,
    }).success;
  });
// 명령별 허용 필드와 기본값을 서버와 화면에서 함께 사용한다.
export const workspaceCommandSchema = z.discriminatedUnion('operation', [
  z
    .object({
      operation: z.literal('schedule.save'),
      input: scheduleInputSchema,
    })
    .strict(),
  z
    .object({ operation: z.literal('schedule.delete'), input: idInput })
    .strict(),
  z
    .object({ operation: z.literal('expense.save'), input: expenseInputSchema })
    .strict(),
  z.object({ operation: z.literal('expense.delete'), input: idInput }).strict(),
  z
    .object({
      operation: z.literal('trip.update'),
      input: z
        .object({
          title: z.string().trim().min(1).max(50),
          country: z.string().trim().min(1).max(50),
          city: z.string().trim().min(1).max(50),
          status: z.enum(['DRAFT', 'PLANNED', 'IN_PROGRESS', 'COMPLETED']),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      operation: z.literal('trip.period'),
      input: z
        .object({ startDate: calendarDateSchema, endDate: calendarDateSchema })
        .strict()
        .refine(isAllowedTripPeriod),
    })
    .strict(),
  z
    .object({
      operation: z.literal('media.register'),
      input: z
        .object({
          id: foundationUuidSchema,
          scheduleId: optionalId,
          path: z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png)$/),
          purpose: z.enum(['photo', 'receipt']),
          mimeType: z.enum(['image/jpeg', 'image/png']),
        })
        .strict(),
    })
    .strict(),
  z.object({ operation: z.literal('media.delete'), input: idInput }).strict(),
  z
    .object({
      operation: z.literal('receipt.confirm'),
      input: receiptInputSchema,
    })
    .strict(),
  z.object({ operation: z.literal('receipt.delete'), input: idInput }).strict(),
  z
    .object({
      operation: z.literal('invite.create'),
      input: z.object({ role: roles }).strict(),
    })
    .strict(),
  z.object({ operation: z.literal('invite.revoke'), input: idInput }).strict(),
  z
    .object({
      operation: z.literal('member.role'),
      input: z.object({ userId: foundationUuidSchema, role: roles }).strict(),
    })
    .strict(),
  z
    .object({
      operation: z.literal('member.remove'),
      input: z.object({ userId: foundationUuidSchema }).strict(),
    })
    .strict(),
  z
    .object({
      operation: z.literal('community.publish'),
      input: z
        .object({
          title,
          body: z.string().max(2000),
          scheduleIds: z.array(foundationUuidSchema).max(300),
          photoIds: z.array(foundationUuidSchema).max(30),
          includeCosts: z.boolean(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      operation: z.literal('community.withdraw'),
      input: z.object({}).strict(),
    })
    .strict(),
]);
export type WorkspaceCommand = z.infer<typeof workspaceCommandSchema>;
export const acceptInviteSchema = z
  .object({ token: z.string().regex(/^[0-9a-f]{64}$/) })
  .strict();
export const receiptOcrSchema = z
  .object({ mediaId: foundationUuidSchema })
  .strict();
export const reportSchema = z
  .object({
    postId: foundationUuidSchema,
    reason: z.string().trim().min(1).max(500),
  })
  .strict();

// 불완전한 서버 결과를 화면 데이터로 사용하지 않는다.
export const workspaceTripSchema = z.object({
  id: foundationUuidSchema,
  ownerId: foundationUuidSchema,
  title: z.string(),
  country: z.string(),
  city: z.string(),
  startDate: calendarDateSchema,
  endDate: calendarDateSchema,
  timezone: z.string(),
  defaultCurrency: z.enum(['KRW', 'JPY', 'USD']),
  coverColor: z.string(),
  status: z.enum(['DRAFT', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED']),
  version: z.number().int().positive(),
});
export const workspaceSnapshotSchema = z.object({
  trip: workspaceTripSchema,
  myRole: z.enum(['owner', 'editor', 'viewer']),
  days: z.array(
    z.object({
      id: foundationUuidSchema,
      dayNumber: z.number(),
      tripDate: calendarDateSchema,
    }),
  ),
  itinerary: z.array(
    z.object({
      id: foundationUuidSchema,
      dayId: foundationUuidSchema,
      title: z.string(),
      type: z.enum([
        'PLACE',
        'TRANSPORT',
        'STAY',
        'RESERVATION',
        'TODO',
        'MEMO',
      ]),
      timeSlot: z.string().nullable(),
      sortOrder: z.number(),
      memo: z.string().nullable(),
      address: z.string(),
      googlePlaceId: z
        .string()
        .regex(/^[A-Za-z0-9_-]{1,200}$/)
        .optional(),
    }),
  ),
  expenses: z.array(
    z.object({
      id: foundationUuidSchema,
      title: z.string(),
      amount: z.string(),
      currency: z.enum(['KRW', 'JPY', 'USD']),
      isActual: z.boolean(),
      dayId: z.string().nullable(),
      scheduleId: z.string().nullable(),
      category: z.string(),
      source: z.string(),
    }),
  ),
  checklists: z.array(
    z.object({
      id: foundationUuidSchema,
      title: z.string(),
      isCompleted: z.boolean(),
    }),
  ),
  members: z.array(
    z.object({
      memberId: foundationUuidSchema,
      userId: foundationUuidSchema,
      nickname: z.string(),
      role: z.enum(['owner', 'editor', 'viewer']),
      isMe: z.boolean(),
    }),
  ),
  media: z.array(
    z.object({
      id: foundationUuidSchema,
      path: z.string(),
      purpose: z.enum(['photo', 'receipt']),
      scheduleId: z.string().nullable(),
    }),
  ),
  receipts: z.array(
    z.object({
      id: foundationUuidSchema,
      scheduleId: foundationUuidSchema,
      mediaId: foundationUuidSchema,
      merchant: z.string(),
      date: calendarDateSchema,
      amount: z.string(),
      currency: z.enum(['KRW', 'JPY', 'USD']),
      details: z.string(),
    }),
  ),
  invites: z.array(
    z.object({
      id: foundationUuidSchema,
      role: z.enum(['owner', 'editor', 'viewer']),
      expiresAt: z.string(),
      revokedAt: z.string().nullable(),
      usedAt: z.string().nullable(),
    }),
  ),
  postId: z.string().nullable(),
});
export const communityPostSchema = z.object({
  id: foundationUuidSchema,
  authorId: foundationUuidSchema,
  author: z.string(),
  title: z.string(),
  body: z.string(),
  publishedAt: z.string(),
  photoPaths: z.array(z.string()),
  snapshot: z.object({
    country: z.string(),
    city: z.string(),
    startDate: calendarDateSchema,
    endDate: calendarDateSchema,
    itinerary: z.array(
      z.object({
        title: z.string(),
        date: calendarDateSchema,
        timeSlot: z.string().nullable(),
        address: z.string(),
      }),
    ),
    costs: z.object({
      KRW: z.string().optional(),
      JPY: z.string().optional(),
      USD: z.string().optional(),
    }),
  }),
});
