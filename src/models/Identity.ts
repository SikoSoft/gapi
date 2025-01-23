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
