export type EventErrorCode =
  | "REVISION_CONFLICT"
  | "NOT_REGISTERED"
  | "NOT_OPEN"
  | "CLOSED"
  | "PROCESSED"
  | "FORBIDDEN"
  | "INVALID_INPUT"
  | "INVALID_FILE"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "INTERNAL_ERROR";

export class EventError extends Error {
  readonly status: number;
  constructor(
    public readonly code: EventErrorCode,
    status?: number,
  ) {
    super(code);
    this.status =
      status ??
      (code === "REVISION_CONFLICT"
        ? 409
        : code === "UNAUTHORIZED"
          ? 401
          : code === "NOT_FOUND"
            ? 404
            : [
                  "NOT_REGISTERED",
                  "NOT_OPEN",
                  "CLOSED",
                  "PROCESSED",
                  "FORBIDDEN",
                ].includes(code)
              ? 403
              : code === "INTERNAL_ERROR"
                ? 500
                : 400);
  }
}
