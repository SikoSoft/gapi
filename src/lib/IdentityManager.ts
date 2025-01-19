import { v4 as uuidv4 } from "uuid";
import Crypto from "crypto";
import * as argon2 from "argon2";
import { prisma } from "..";
import { User } from "../models/Identity";

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

    return user.id;
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

  static createOtt(userId: string) {
    /*
    await prisma.ott.create({
      userId,
      oneTimeToken,
      authToken,
    });
    */
  }

  static exchangeOtt() {}

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

      await prisma.session.create({ data: { userId, authToken } });
    } catch (error) {
      console.error("Something went wrong creating a session", error);
    }

    return authToken;
  }

  static async getUserIdByAuthToken(authToken: string): Promise<string> {
    let userId = "";

    try {
      const user = await prisma.session.findUnique({ where: { authToken } });

      userId = user.userId;
    } catch (error) {
      console.error(
        "Something went wrong looking up session by authToken",
        error
      );
    }

    return userId;
  }
}
