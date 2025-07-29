import { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import mongoose from "mongoose";

const globalErrorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  let statusCode = 500;
  let message = "Something went wrong!";
  let errorDetails: any = {};

  // Handle Zod validation error
  if (err instanceof ZodError) {
    statusCode = 400;
    message = "Validation failed";
    errorDetails = err.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
  }

  // Handle Mongoose CastError
  else if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    message = "Invalid resource identifier";
    errorDetails = { path: err.path, value: err.value };
  }

  // Handle Mongoose ValidationError
  else if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 400;
    message = "Schema validation error";
    errorDetails = Object.values(err.errors).map((e) => ({
      path: e.path,
      message: e.message,
    }));
  }

  // Custom error with statusCode & message
  else if (err.statusCode && err.message) {
    statusCode = err.statusCode;
    message = err.message;
    errorDetails = err.details || {};
  }

  res.status(statusCode).json({
    success: false,
    message,
    errorDetails,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
};

export default globalErrorHandler;
