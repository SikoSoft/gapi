import { UserGoogleAccount } from "@prisma/client";

export interface CommonUser {
  id: string;
  sessionId: string;
  roles: string[];
  googleLink: boolean;
}

export interface UserWithGoogleLink extends CommonUser {
  googleLink: true;
  googleAccount: UserGoogleAccount;
}

export interface UserWithoutGoogleLink extends CommonUser {
  googleLink: false;
}

export interface IntrospectionUser {
  isLoggedIn: true;
  user: UserWithGoogleLink | UserWithoutGoogleLink;
  expiresAt: Date;
}

export interface IntrospectionAnonymous {
  isLoggedIn: false;
}

export type Introspection = IntrospectionUser | IntrospectionAnonymous;
