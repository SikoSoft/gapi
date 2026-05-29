import { OneTimeTokenScope, Prisma } from "@prisma/client";
import { calendar_v3 } from "googleapis";
import { z } from "zod";

export { OneTimeTokenScope };

export class User {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  password: string;
}

export class Session {
  userId: string;
  authToken: string;
  createdAt: Date;
  expiresAt: Date;
  active: boolean;
}

const prismaUser = Prisma.validator<Prisma.UserFindUniqueArgs>()({
  where: { id: "" },
  include: { roles: true },
});

export type PrismaUser = Prisma.UserGetPayload<typeof prismaUser>;

const prismaSession = Prisma.validator<Prisma.SessionFindUniqueArgs>()({
  where: { authToken: "", active: true, expiresAt: { gt: new Date() } },
  include: { user: { include: { roles: true, googleAccount: true } } },
});

export type PrismaSession = Prisma.SessionGetPayload<typeof prismaSession>;

const prismaOneTimeToken = Prisma.validator<Prisma.OneTimeTokenDefaultArgs>()(
  {}
);

export type PrismaOneTimeToken = Prisma.OneTimeTokenGetPayload<
  typeof prismaOneTimeToken
>;

export const LoginBodySchema = z.object({
  username: z.string(),
  password: z.string(),
});
export type LoginBody = z.infer<typeof LoginBodySchema>;

export const UserCreateBodySchema = z.object({
  username: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  password: z.string(),
  ott: z.string(),
});
export type UserCreateBody = z.infer<typeof UserCreateBodySchema>;

export const UserUpdateBodySchema = z.object({
  userId: z.string(),
  roles: z.array(z.string()),
});
export type UserUpdateBody = z.infer<typeof UserUpdateBodySchema>;

export const UserSelfUpdateBodySchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  password: z.string().optional(),
  currentPassword: z.string().optional(),
  username: z.string().optional(),
});
export type UserSelfUpdateBody = z.infer<typeof UserSelfUpdateBodySchema>;

export const UserSchema = z.object({
  id: z.string(),
  username: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  roles: z.array(z.string()),
}).strict();

export const userSchema = UserSchema;
export type UserType = z.infer<typeof UserSchema>;

export const MfaVerifySetupBodySchema = z.object({
  secret: z.string(),
  code: z.string(),
});
export type MfaVerifySetupBody = z.infer<typeof MfaVerifySetupBodySchema>;

export const MfaVerifyBodySchema = z.object({
  pendingMfaToken: z.string(),
  code: z.string(),
});
export type MfaVerifyBody = z.infer<typeof MfaVerifyBodySchema>;

export interface SuggestAcceptQuery {
  token: string;
}

export interface GoogleState {
  userId: string;
  returnUrl: string;
}

export type GoogleEvent = calendar_v3.Schema$Event;
