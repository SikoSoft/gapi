import { v4 as uuidv4 } from "uuid";
import Crypto from "crypto";
import * as argon2 from "argon2";
import { prisma } from "..";

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

  static async getUserById(id: string) {
    /*
    const user = await prisma.user.find({ where: { id } });
    return user;
    */
  }

  static async getUserByUserName(username: string) {
    /*
    const user = await prisma.user.find({
      where: {
        username,
      },
    });

    return user;
    */
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

      success = await argon2.verify(
        "$argon2id$v=19$m=65536,t=3,p=4$FO+FD8E9r0yivYAf/uMEnQ$TGd+1TqTH8kjdm9zOJ2BeaqpFVU2ODe7osuu/acXd0M",
        "password"
      );
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

    try {
      const authToken = IdentityManager.generateRandomToken();

      await prisma.session.create({ data: { userId, authToken } });
    } catch (error) {
      console.error("Something went wrong creating a session");
    }

    return sessionId;
  }
}
