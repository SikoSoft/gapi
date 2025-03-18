import { err, ok, Result } from "neverthrow";
import { v4 as uuidv4 } from "uuid";
import Crypto from "crypto";
import * as argon2 from "argon2";
import { prisma } from "..";
import { PrismaSession, User } from "../models/Identity";

export interface UserPayload {
  username: string;
}

export class IdentityManager {
  static async createUser(
    username: string,
    firstName: string,
    lastName: string,
    password: string
  ) {
    let userId = "";

    try {
      const id = uuidv4();
      const passwordHash = await IdentityManager.hashPassword(password);
      const user = await prisma.user.create({
        data: {
          id,
          username,
          firstName: firstName || "",
          lastName: lastName || "",
          password: passwordHash,
        },
      });
      userId = user.id;
    } catch (error) {
      console.error("Something went wrong trying to create user", error);
    }

    return userId;
  }

  static async getUserById(id: string): Promise<User> {
    const user = await prisma.user.findFirst({ where: { id } });
    return user;
  }

  static async getUserByUserName(username: string): Promise<User | null> {
    const user = await prisma.user.findFirst({
      where: {
        username: { equals: username, mode: "insensitive" },
      },
    });

    return user;
  }

  static generateRandomToken(length = 64): string {
    return Crypto.randomBytes(length)
      .toString("base64url")
      .replace(/[\W_,]/g, "");
  }

  static async hashPassword(password: string): Promise<string> {
    let passwordHash = "";
    try {
      passwordHash = await argon2.hash(password);
    } catch (error) {
      console.error(
        "Something went wrong when trying to hash the password",
        error
      );
    }
    return passwordHash;
  }

  static async verifyPassword(
    userId: string,
    password: string
  ): Promise<boolean> {
    let success = false;

    try {
      const user = await IdentityManager.getUserById(userId);

      success = await argon2.verify(user.password, password);
    } catch (error) {
      console.error(
        "Something went wrong when trying to verify the password",
        error
      );
    }

    return success;
  }

  static async createSession(userId: string): Promise<string> {
    let sessionId = "";
    let authToken = "";

    try {
      authToken = IdentityManager.generateRandomToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 1);

      await prisma.session.create({ data: { userId, authToken, expiresAt } });
    } catch (error) {
      console.error("Something went wrong creating a session", error);
    }

    return authToken;
  }

  static async getSessionByAuthToken(
    authToken: string
  ): Promise<PrismaSession | null> {
    let session = null;

    try {
      session = await prisma.session.findUnique({
        where: { authToken, active: true, expiresAt: { gt: new Date() } },
        include: { user: { include: { roles: { include: { role: true } } } } },
      });
    } catch (error) {
      console.error(
        "Something went wrong looking up session by authToken",
        error
      );
    }

    return session;
  }

  static async revokeAuthToken(authToken: string): Promise<{ userId: string }> {
    const result = await prisma.session.update({
      data: { active: false },
      where: { authToken },
    });

    return result;
  }

  static async saveLoginAttempt(
    userId: string,
    ip: string
  ): Promise<Result<null, Error>> {
    try {
      await prisma.loginAttempt.create({
        data: { ...(userId ? { userId } : {}), ip },
      });
      return ok(null);
    } catch (error) {
      console.error("Something went wrong saving login attempt", error);
      return err(error);
    }
  }

  static async getLoginAttempts(
    userId: string,
    ip: string,
    seconds: number
  ): Promise<Result<number, Error>> {
    try {
      const attempts = await prisma.loginAttempt.count({
        where: {
          AND: [
            { OR: [{ userId }, { ip }] },
            {
              attemptedAt: {
                gte: new Date(Date.now() - seconds * 1000),
              },
            },
          ],
        },
      });
      return ok(attempts);
    } catch (error) {
      return err(error);
    }
  }

  static async setRoles(userId: string, roles: string[]): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { roles: { set: [] } },
    });
  }
}
