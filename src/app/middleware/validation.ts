import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { AppError } from "./globalErrorHandler";
import { ParsedQs } from "qs";
import { ParamsDictionary } from "express-serve-static-core";

/**
 * Validation middleware factory
 * Creates middleware to validate request data against Zod schemas
 */
export const validateRequest = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Validate request body
      const validatedData = schema.parse(req.body);

      // Replace request body with validated and sanitized data
      req.body = validatedData;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Format Zod validation errors
        const formattedErrors = error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
          code: issue.code,
        }));

        const errorMessage = formattedErrors
          .map((err) => `${err.field}: ${err.message}`)
          .join(", ");

        const validationError = new AppError(
          `Validation failed: ${errorMessage}`,
          400,
          "VALIDATION_ERROR"
        );

        (validationError as any).errors = formattedErrors;
        next(validationError);
      } else {
        next(error);
      }
    }
  };
};

/**
 * Validate query parameters
 */
export const validateQuery = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validatedQuery = schema.parse(req.query);
      req.query = validatedQuery as unknown as ParsedQs;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
          code: issue.code,
        }));

        const errorMessage = formattedErrors
          .map((err) => `${err.field}: ${err.message}`)
          .join(", ");

        const validationError = new AppError(
          `Query validation failed: ${errorMessage}`,
          400,
          "QUERY_VALIDATION_ERROR"
        );

        (validationError as any).errors = formattedErrors;
        next(validationError);
      } else {
        next(error);
      }
    }
  };
};

/**
 * Validate URL parameters
 */
export const validateParams = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validatedParams = schema.parse(req.params);
      req.params = validatedParams as unknown as ParamsDictionary;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
          code: issue.code,
        }));

        const errorMessage = formattedErrors
          .map((err) => `${err.field}: ${err.message}`)
          .join(", ");

        const validationError = new AppError(
          `Parameter validation failed: ${errorMessage}`,
          400,
          "PARAMS_VALIDATION_ERROR"
        );

        (validationError as any).errors = formattedErrors;
        next(validationError);
      } else {
        next(error);
      }
    }
  };
};

/**
 * Sanitize request data by removing undefined values
 */
export const sanitizeRequest = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (req.body && typeof req.body === "object") {
    req.body = removeUndefinedValues(req.body);
  }

  if (req.query && typeof req.query === "object") {
    req.query = removeUndefinedValues(req.query);
  }

  next();
};

/**
 * Helper function to remove undefined values from objects
 */
function removeUndefinedValues(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(removeUndefinedValues);
  }

  if (obj !== null && typeof obj === "object") {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = removeUndefinedValues(value);
      }
    }
    return cleaned;
  }

  return obj;
}
