import { ErrorCode } from "../models/Error";
import { BaseError } from "./BaseError";

export class AuthError extends BaseError {
  constructor(message: string) {
    super(message);
    this.name = ErrorCode.AuthError;
  }
}
