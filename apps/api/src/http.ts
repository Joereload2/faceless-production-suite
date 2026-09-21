import type { ErrorCode } from "@faceless/schema";

export class HttpError extends Error {
  constructor(
    public status: number,
    public errorCode: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function errJson(errorCode: ErrorCode, message: string): { errorCode: ErrorCode; message: string } {
  return { errorCode, message };
}
