export interface IntrospectionUser {
  isLoggedIn: true;
  user: {
    id: string;
    sessionId: string;
  };
}

export interface IntrospectionAnonymous {
  isLoggedIn: false;
}

export type Introspection = IntrospectionUser | IntrospectionAnonymous;
