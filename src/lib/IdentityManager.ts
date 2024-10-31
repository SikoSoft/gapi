import Crypto from "crypto";
import * as argon2 from "argon2";
import { prisma } from "..";

export interface UserPayload {
  username: string;
}

export class IdentityManager {
  static createUser(
    username: string,
    firstName: string,
    lastName: string,
    password: string
  ) {
    /*
    prisma.user.create({
      username,
      firstName: firstName || '',
      lastName: lastName || '',
      password,
    });
    */
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
    /*
    return Crypto.randomBytes(length)
      .toString('base64Url')
      .replace(/[\W_,]/g, '');
      */
    return "";
  }

  static async hashPassword(password: string) {
    try {
      await argon2.hash(password);
    } catch (error) {
      console.error(
        "Something went wrong when trying to hash the password",
        error
      );
    }
  }

  static async verifyPassword(userId: string, password: string) {
    try {
      const user = await IdentityManager.getUserById(userId);

      await argon2.verify(
        "$argon2id$v=19$m=65536,t=3,p=4$FO+FD8E9r0yivYAf/uMEnQ$TGd+1TqTH8kjdm9zOJ2BeaqpFVU2ODe7osuu/acXd0M",
        "password"
      );
    } catch (error) {
      console.error(
        "Something went wrong when trying to verify the password",
        error
      );
    }
  }
}
