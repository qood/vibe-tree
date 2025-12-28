import { describe, test, expect } from "bun:test";
import {
  AppError,
  NotFoundError,
  BadRequestError,
} from "../server/middleware/error-handler";
import { ValidationError } from "../shared/validation";

describe("AppError", () => {
  test("creates error with default status code", () => {
    const error = new AppError("Something went wrong");
    expect(error.message).toBe("Something went wrong");
    expect(error.statusCode).toBe(500);
    expect(error.code).toBeUndefined();
    expect(error.name).toBe("AppError");
  });

  test("creates error with custom status code", () => {
    const error = new AppError("Unauthorized", 401);
    expect(error.statusCode).toBe(401);
  });

  test("creates error with custom code", () => {
    const error = new AppError("Forbidden", 403, "FORBIDDEN");
    expect(error.code).toBe("FORBIDDEN");
  });

  test("is instance of Error", () => {
    const error = new AppError("Test");
    expect(error instanceof Error).toBe(true);
    expect(error instanceof AppError).toBe(true);
  });
});

describe("NotFoundError", () => {
  test("creates error with correct message and status", () => {
    const error = new NotFoundError("User");
    expect(error.message).toBe("User not found");
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe("NOT_FOUND");
  });

  test("is instance of AppError", () => {
    const error = new NotFoundError("Resource");
    expect(error instanceof AppError).toBe(true);
  });
});

describe("BadRequestError", () => {
  test("creates error with correct message and status", () => {
    const error = new BadRequestError("Invalid input");
    expect(error.message).toBe("Invalid input");
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe("BAD_REQUEST");
  });

  test("is instance of AppError", () => {
    const error = new BadRequestError("Bad");
    expect(error instanceof AppError).toBe(true);
  });
});

describe("ValidationError", () => {
  test("creates error with message", () => {
    const error = new ValidationError("field: is required");
    expect(error.message).toBe("field: is required");
    expect(error.name).toBe("ValidationError");
  });

  test("is instance of Error", () => {
    const error = new ValidationError("test");
    expect(error instanceof Error).toBe(true);
  });
});
