import { ErrorCode } from "../models/Error";
import { BaseError } from "./BaseError";

export class AccessError extends BaseError {
  constructor(message: string) {
    super(message);
    this.name = ErrorCode.AccessError;
  }
}
