import type { ErrorHandler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ValidationError } from "../../shared/validation";

export interface ApiError {
  error: string;
  code: string;
  details?: unknown;
}

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: ContentfulStatusCode = 500,
    public code?: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, "NOT_FOUND");
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) {
    super(message, 400, "BAD_REQUEST");
  }
}

// Hono onError handler
export const onErrorHandler: ErrorHandler = (error, c) => {
  console.error("Error:", error);

  if (error instanceof ValidationError) {
    return c.json<ApiError>({ error: error.message, code: "VALIDATION_ERROR" }, 400);
  }

  // Use duck typing as instanceof can fail with certain bundlers/module systems
  if (
    error instanceof AppError ||
    (error instanceof Error && "statusCode" in error && "code" in error)
  ) {
    const appError = error as AppError;
    return c.json<ApiError>(
      { error: appError.message, code: appError.code ?? "APP_ERROR" },
      appError.statusCode,
    );
  }

  if (error instanceof Error) {
    // Don't expose internal errors in production
    const message =
      process.env.NODE_ENV === "production" ? "Internal server error" : error.message;
    return c.json<ApiError>({ error: message, code: "INTERNAL_ERROR" }, 500);
  }

  return c.json<ApiError>({ error: "Unknown error occurred", code: "UNKNOWN_ERROR" }, 500);
};
