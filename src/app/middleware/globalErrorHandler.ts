import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { MulterError, Multer } from "multer";

// Custom error classes
class AppError extends Error {
  public statusCode: number;
  public status: string;
  public isOperational: boolean;
  public code?: string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.isOperational = true;
    this.code = code;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Error response interface
interface ErrorResponse {
  status: string;
  message: string;
  statusCode: number;
  stack?: string;
  error?: any;
  code?: string;
  context?: string;
}

/**
 * Development error response - includes stack trace and full error details
 */
const sendErrorDev = (err: any, res: Response): void => {
  const errorResponse: ErrorResponse = {
    status: err.status || "error",
    message: err.message || "Something went wrong!",
    statusCode: err.statusCode || 500,
    stack: err.stack,
    error: err,
  };

  if (err.code) errorResponse.code = err.code;
  if (err.context) errorResponse.context = err.context;

  res.status(err.statusCode || 500).json(errorResponse);
};

/**
 * Production error response - only sends safe error details
 */
const sendErrorProd = (err: any, res: Response): void => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    const errorResponse: ErrorResponse = {
      status: err.status,
      message: err.message,
      statusCode: err.statusCode,
    };

    if (err.code) errorResponse.code = err.code;

    res.status(err.statusCode).json(errorResponse);
  } else {
    // Programming or other unknown error: don't leak error details
    console.error("ERROR", err);

    res.status(500).json({
      status: "error",
      message: "Something went wrong!",
      statusCode: 500,
    });
  }
};

/**
 * Handle MongoDB cast errors (invalid ObjectId, etc.)
 */
const handleCastErrorDB = (err: { path: string; value: any }): AppError => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400, "CAST_ERROR");
};

/**
 * Handle MongoDB duplicate field errors
 */
const handleDuplicateFieldsDB = (err: {
  keyValue: Record<string, any>;
}): AppError => {
  const field = Object.keys(err.keyValue)[0];
  const value = err.keyValue[field];
  const message = `Duplicate field value: ${field} = '${value}'. Please use another value!`;
  return new AppError(message, 400, "DUPLICATE_FIELD");
};

/**
 * Handle MongoDB validation errors
 */
const handleValidationErrorDB = (err: {
  errors: Record<string, { message: string }>;
}): AppError => {
  const errors = Object.values(err.errors).map((el) => el.message);
  const message = `Invalid input data. ${errors.join(". ")}`;
  return new AppError(message, 400, "VALIDATION_ERROR");
};

/**
 * Handle Joi validation errors
 */
const handleZodValidationError = (err: ZodError): AppError => {
  const message = err.issues
    .map((error) => {
      const path = error.path.join(".");
      return `${path}: ${error.message}`;
    })
    .join(". ");
  return new AppError(
    `Validation error: ${message}`,
    400,
    "ZOD_VALIDATION_ERROR"
  );
};

/**
 * Handle JWT errors
 */
const handleJWTError = (): AppError =>
  new AppError("Invalid token. Please log in again!", 401, "INVALID_JWT");

const handleJWTExpiredError = (): AppError =>
  new AppError(
    "Your token has expired! Please log in again.",
    401,
    "JWT_EXPIRED"
  );

/**
 * Handle multer errors (file upload)
 */

const handleMulterError = (err: MulterError): AppError => {
  switch (err.code) {
    case "LIMIT_FILE_SIZE":
      return new AppError("File too large", 400, "FILE_TOO_LARGE");
    case "LIMIT_FILE_COUNT":
      return new AppError("Too many files", 400, "TOO_MANY_FILES");
    case "LIMIT_UNEXPECTED_FILE":
      return new AppError("Unexpected field", 400, "UNEXPECTED_FIELD");
    default:
      return new AppError(err.message, 400, "MULTER_ERROR");
  }
};

/**
 * Global Error Handler Middleware
 * This should be the last middleware in your app
 */
export const globalErrorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Ensure error has necessary properties
  let error = err instanceof AppError ? err : new AppError(err.message, 500);

  error.statusCode = (error as AppError).statusCode || 500;
  error.status = (error as AppError).status || "error";

  // Log the error
  console.error(`Error ${error.statusCode}: ${error.message}`);
  if (error.stack) console.error(error.stack);

  if (process.env.NODE_ENV === "development") {
    sendErrorDev(error, res);
  } else {
    // Handle specific error types
    if (err.name === "CastError") error = handleCastErrorDB(err as any);
    if ((err as any).code === 11000)
      error = handleDuplicateFieldsDB(err as any);
    if (err.name === "ValidationError")
      error = handleValidationErrorDB(err as any);
    if (err instanceof ZodError) error = handleZodValidationError(err);
    if (err.name === "JsonWebTokenError") error = handleJWTError();
    if (err.name === "TokenExpiredError") error = handleJWTExpiredError();
    if (err instanceof MulterError) error = handleMulterError(err);

    sendErrorProd(error, res);
  }
};

/**
 * Handle unhandled promise rejections
 */
export const handleUnhandledRejection = (server?: any): void => {
  process.on("unhandledRejection", (err: Error) => {
    console.error("UNHANDLED REJECTION. Shutting down...");
    console.error(err.name, err.message);
    if (server) {
      server.close(() => process.exit(1));
    } else {
      process.exit(1);
    }
  });
};

/**
 * Handle uncaught exceptions
 */
export const handleUncaughtException = (server?: any): void => {
  process.on("uncaughtException", (err: Error) => {
    console.error("UNCAUGHT EXCEPTION. Shutting down...");
    console.error(err.name, err.message, err.stack);
    if (server) {
      server.close(() => process.exit(1));
    } else {
      process.exit(1);
    }
  });
};

/**
 * hanlle system termination signal
 */

export const handleShutdownSignals = (server?: any): void => {
  const shutdown = (signal: string) => {
    console.log(`${signal} received. Closing server...`);
    if (server) {
      server.close(() => {
        console.log("Server closed gracefully.");
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
};

export { AppError };
