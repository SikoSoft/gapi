import { ErrorCode } from "../models/Error";
import { BaseError } from "./BaseError";

export class ValidationError extends BaseError {
  constructor(message: string) {
    super(message);
    this.name = ErrorCode.ValidationError;
  }
}
