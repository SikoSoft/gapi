import { z } from "zod";
import { Prisma } from "@prisma/client";

export const StreakAlertConfigBodySchema = z.object({
  streakId: z.number().int().positive(),
  noticeTime: z.number().int().positive(),
});

export const StreakAlertConfigUpdateBodySchema = z.object({
  noticeTime: z.number().int().positive(),
});

export interface StreakAlertConfigBody {
  streakId: number;
  noticeTime: number;
}

export interface StreakAlertConfigUpdateBody {
  noticeTime: number;
}

const prismaStreakAlertConfigValidator = Prisma.validator<Prisma.StreakAlertConfigDefaultArgs>()({});
export type PrismaStreakAlertConfig = Prisma.StreakAlertConfigGetPayload<typeof prismaStreakAlertConfigValidator>;

const prismaStreakAlertValidator = Prisma.validator<Prisma.StreakAlertDefaultArgs>()({});
export type PrismaStreakAlert = Prisma.StreakAlertGetPayload<typeof prismaStreakAlertValidator>;
