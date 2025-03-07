import { v4 as uuidv4 } from "uuid";
import Crypto from "crypto";
import * as argon2 from "argon2";
import { prisma } from "..";
import { Session, User } from "../models/Identity";

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
  ): Promise<Session | null> {
    let session = null;

    try {
      session = await prisma.session.findUnique({
        where: { authToken, active: true, expiresAt: { gt: new Date() } },
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

  static async saveLoginAttempt(userId: string, ip: string): Promise<void> {
    await prisma.loginAttempt.create({ data: { userId, ip } });
  }
}
