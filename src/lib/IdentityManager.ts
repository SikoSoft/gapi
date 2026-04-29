import { err, ok, Result } from "neverthrow";
import { v4 as uuidv4 } from "uuid";
import Crypto from "crypto";
import * as argon2 from "argon2";
import { prisma } from "..";
import {
  PrismaOneTimeToken,
  PrismaSession,
  PrismaUser,
  User,
  userSchema,
  UserType,
} from "../models/Identity";
import { Identity } from "api-spec/models";

export interface UserPayload {
  username: string;
}

export class IdentityManager {
  static readonly ALGORITHM = "aes-256-gcm";
  static IV_LENGTH = 12;
  static KEY = IdentityManager.getValidatedEncryptionKey();

  private static getValidatedEncryptionKey(): Buffer {
    const encryptionKey = process.env.ENCRYPTION_KEY;

    if (!encryptionKey) {
      throw new Error(
        "ENCRYPTION_KEY is required and must be 32 bytes for aes-256-gcm"
      );
    }

    const keyBuffer = Buffer.from(encryptionKey);
    if (keyBuffer.length !== 32) {
      throw new Error(
        `ENCRYPTION_KEY must be exactly 32 bytes for aes-256-gcm, got ${keyBuffer.length} bytes`
      );
    }

    return keyBuffer;
  }

  static async createUser(
    username: string,
    firstName: string,
    lastName: string,
    password: string
  ): Promise<Result<string, Error>> {
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
      return err(error);
    }

    return ok(userId);
  }

  static async getUserById(id: string): Promise<Result<PrismaUser, Error>> {
    try {
      const user = await prisma.user.findFirst({
        where: { id },
        include: { roles: true },
      });
      return ok(user);
    } catch (error) {
      return err(error);
    }
  }

  static async getUserByUserName(
    username: string
  ): Promise<Result<Identity.User | null, Error>> {
    try {
      const user = await prisma.user.findFirst({
        where: {
          username: { equals: username, mode: "insensitive" },
        },
        include: { roles: true },
      });

      return ok(user ? IdentityManager.mapUser(user) : null);
    } catch (error) {
      return err(error);
    }
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
  ): Promise<Result<boolean, Error>> {
    let success = false;

    try {
      const userRes = await IdentityManager.getUserById(userId);
      if (userRes.isErr()) {
        return err(userRes.error);
      }

      success = await argon2.verify(userRes.value.password, password);
    } catch (error) {
      console.error(
        "Something went wrong when trying to verify the password",
        error
      );
    }

    return ok(success);
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
  ): Promise<Result<PrismaSession | null, Error>> {
    let session = null;

    try {
      session = await prisma.session.findUnique({
        where: { authToken, active: true, expiresAt: { gt: new Date() } },
        include: { user: { include: { roles: true, googleAccount: true } } },
      });
    } catch (error) {
      return err(error);
    }

    return ok(session);
  }

  static async revokeAuthToken(
    authToken: string
  ): Promise<Result<{ userId: string }, Error>> {
    try {
      const result = await prisma.session.update({
        data: { active: false },
        where: { authToken },
      });

      return ok(result);
    } catch (error) {
      return err(error);
    }
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

  static async getUser(userId: string): Promise<Result<UserType, Error>> {
    try {
      const user = IdentityManager.mapUser(
        await prisma.user.findUnique({
          where: { id: userId },
          include: { roles: true },
        })
      );

      if (!user) {
        throw new Error("User not found");
      }

      return ok(user);
    } catch (error) {
      return err(error);
    }
  }

  static async getUsers(): Promise<Result<UserType[], Error>> {
    try {
      const users = (
        await prisma.user.findMany({
          include: { roles: true },
        })
      ).map(IdentityManager.mapUser);

      return ok(users);
    } catch (error) {
      return err(error);
    }
  }

  static mapUser(user: PrismaUser): UserType {
    return { ...user, roles: user.roles.map((r) => r.role) };
  }

  static async updateUserRoles(
    userId: string,
    roles: string[]
  ): Promise<Result<null, Error>> {
    try {
      await prisma.userRole.deleteMany({ where: { userId } });

      const userRolesData = roles.map((role) => ({
        userId,
        role,
      }));

      await prisma.userRole.createMany({ data: userRolesData });
      return ok(null);
    } catch (error) {
      return err(error);
    }
  }

  static encryptToken(token: string): string {
    const iv = Crypto.randomBytes(IdentityManager.IV_LENGTH);
    const cipher = Crypto.createCipheriv(
      IdentityManager.ALGORITHM,
      IdentityManager.KEY,
      iv
    );

    let encrypted = cipher.update(token, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag().toString("hex");

    return `${iv.toString("hex")}:${authTag}:${encrypted}`;
  }

  static decryptToken(encryptedData: string): string {
    const [ivHex, authTagHex, encryptedText] = encryptedData.split(":");

    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = Crypto.createDecipheriv(
      IdentityManager.ALGORITHM,
      IdentityManager.KEY,
      iv
    );

    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }

  static async createOtt(): Promise<Result<string, Error>> {
    try {
      const token = IdentityManager.generateRandomToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);
      await prisma.oneTimeToken.create({ data: { token, expiresAt } });
      return ok(token);
    } catch (error) {
      return err(error);
    }
  }

  static async verifyOtt(token: string = ""): Promise<Result<boolean, Error>> {
    try {
      const ott = await prisma.oneTimeToken.findUnique({
        where: {
          token,
          consumed: false,
          expiresAt: { gt: new Date() },
        },
      });

      if (!ott) {
        return ok(false);
      }

      await prisma.oneTimeToken.update({
        where: { id: ott.id },
        data: { consumed: true },
      });

      return ok(true);
    } catch (error) {
      return err(error);
    }
  }

  static async setupAdmin(): Promise<Result<string, Error>> {
    try {
      const existingRes = await IdentityManager.getUserByUserName("admin");
      if (existingRes.isErr()) {
        return err(existingRes.error);
      }
      if (existingRes.value) {
        return err(new Error("Admin user already exists"));
      }

      const createRes = await IdentityManager.createUser(
        "admin",
        "",
        "",
        "admin"
      );
      if (createRes.isErr()) {
        return err(createRes.error);
      }

      const userId = createRes.value;
      const rolesRes = await IdentityManager.updateUserRoles(userId, ["admin"]);
      if (rolesRes.isErr()) {
        return err(rolesRes.error);
      }

      return ok(userId);
    } catch (error) {
      return err(new Error("Failed to setup admin user", { cause: error }));
    }
  }

  static async saveGoogleAccount(
    userId: string,
    googleId: string,
    email: string,
    refreshToken: string
  ): Promise<Result<null, Error>> {
    try {
      await prisma.userGoogleAccount.create({
        data: { userId, googleId, email, refreshToken },
      });

      return ok(null);
    } catch (error) {
      return err(error);
    }
  }
}
