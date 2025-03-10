import { Prisma } from "@prisma/client";

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

const prismaSession = Prisma.validator<Prisma.SessionFindUniqueArgs>()({
  where: { authToken: "", active: true, expiresAt: { gt: new Date() } },
  include: { user: { include: { roles: { include: { role: true } } } } },
});

export type PrismaSession = Prisma.SessionGetPayload<typeof prismaSession>;

export interface UserCreateBody {
  username: string;
  firstName: string;
  lastName: string;
  password: string;
}

export interface UserUpdateBody {
  roles: string[];
}
