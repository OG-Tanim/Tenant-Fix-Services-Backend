import { Request, Response, NextFunction } from "express";

// Type definitions for async route handlers
export type AsyncRouteHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<any>;

export type AsyncMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void>;

/**
 * Central Async Wrapper - Catches all async errors and passes them to error handler
 * Usage: router.get('/route', asyncWrapper(asyncController))
 */
export const asyncWrapper = (fn: AsyncRouteHandler | AsyncMiddleware) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Execute the async function and catch any errors
    Promise.resolve(fn(req, res, next)).catch((error) => {
      // Pass any caught error to the global error handler
      next(error);
    });
  };
};

/**
 * Alternative async wrapper with more explicit error handling
 * Useful for operations that need custom error processing
 */
export const asyncWrapperWithContext = (
  fn: AsyncRouteHandler,
  context?: string
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      // Add context information to the error
      if (context) {
        error.context = context;
        error.route = req.route?.path || req.path;
        error.method = req.method;
      }
      next(error);
    });
  };
};

/**
 * Async wrapper for middleware functions
 * Specifically designed for middleware that return Promise<void>
 */
export const asyncMiddlewareWrapper = (fn: AsyncMiddleware) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
