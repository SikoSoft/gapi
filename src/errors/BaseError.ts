import { ErrorCode } from "../models/Error";

export class BaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = ErrorCode.BaseError;
  }
}
