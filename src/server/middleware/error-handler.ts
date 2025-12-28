import type { Context, Next } from "hono";
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
    public code?: string
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

export async function errorHandler(c: Context, next: Next): Promise<Response | void> {
  try {
    await next();
  } catch (error) {
    console.error("Error:", error);

    if (error instanceof ValidationError) {
      return c.json<ApiError>(
        { error: error.message, code: "VALIDATION_ERROR" },
        400
      );
    }

    if (error instanceof AppError) {
      return c.json<ApiError>(
        { error: error.message, code: error.code ?? "APP_ERROR" },
        error.statusCode
      );
    }

    if (error instanceof Error) {
      // Don't expose internal errors in production
      const message =
        process.env.NODE_ENV === "production"
          ? "Internal server error"
          : error.message;
      return c.json<ApiError>({ error: message, code: "INTERNAL_ERROR" }, 500);
    }

    return c.json<ApiError>(
      { error: "Unknown error occurred", code: "UNKNOWN_ERROR" },
      500
    );
  }
}
