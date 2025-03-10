export interface IntrospectionUser {
  isLoggedIn: true;
  user: {
    id: string;
    sessionId: string;
    roles: string[];
  };
  expiresAt: Date;
}

export interface IntrospectionAnonymous {
  isLoggedIn: false;
}

export type Introspection = IntrospectionUser | IntrospectionAnonymous;
