import { Prisma } from "@prisma/client";
import { calendar_v3 } from "googleapis";
import * as t from "io-ts";

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

export interface UserCreateBody {
  username: string;
  firstName: string;
  lastName: string;
  password: string;
  ott: string;
}

const prismaOneTimeToken = Prisma.validator<Prisma.OneTimeTokenDefaultArgs>()(
  {}
);

export type PrismaOneTimeToken = Prisma.OneTimeTokenGetPayload<
  typeof prismaOneTimeToken
>;

export interface UserUpdateBody {
  userId: string;
  roles: string[];
}

export const userSchema = t.exact(
  t.type({
    id: t.string,
    username: t.string,
    firstName: t.string,
    lastName: t.string,
    roles: t.array(t.string),
  })
);

export type UserType = t.TypeOf<typeof userSchema>;

export interface GoogleState {
  userId: string;
  returnUrl: string;
}

export type GoogleEvent = calendar_v3.Schema$Event;
