import { ulid } from "ulid";

export function newIdempotencyKey(): string {
  return ulid();
}
