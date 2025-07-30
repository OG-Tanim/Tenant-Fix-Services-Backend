import { Request, Response, NextFunction } from "express";
import { AppError } from "./globalErrorHandler";

/**
 * Enhanced Not Found Middleware
 * Handles 404 errors for all unmatched routes
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const message = `Route ${req.originalUrl} not found on this server!`;

  // Create a custom 404 error with additional context
  const error = new AppError(message, 404, "ROUTE_NOT_FOUND");

  // Add request context for better debugging
  (error as any).method = req.method;
  (error as any).url = req.originalUrl;
  (error as any).ip = req.ip;
  (error as any).userAgent = req.get("User-Agent");

  // Pass to global error handler
  next(error);
};

/**
 * API-specific Not Found Handler
 * Provides more detailed information for API endpoints
 */
export const apiNotFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const availableRoutes = getAvailableRoutes(req.app);

  const error = new AppError(
    `API endpoint ${req.method} ${req.originalUrl} not found`,
    404,
    "API_ENDPOINT_NOT_FOUND"
  );

  // Add API-specific context
  (error as any).method = req.method;
  (error as any).requestedUrl = req.originalUrl;
  (error as any).availableRoutes = availableRoutes;
  (error as any).timestamp = new Date().toISOString();

  next(error);
};

/**
 * Resource-specific Not Found Handler
 * For when a specific resource (user, post, etc.) is not found
 */
export const resourceNotFoundHandler = (
  resourceType: string,
  resourceId?: string
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const id = resourceId || req.params.id;
    const message = `${resourceType} ${id ? `with ID '${id}'` : ""} not found`;

    const error = new AppError(message, 404, "RESOURCE_NOT_FOUND");
    (error as any).resourceType = resourceType;
    (error as any).resourceId = id;

    next(error);
  };
};

/**
 * File Not Found Handler
 * Specifically for file/static asset requests
 */
export const fileNotFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const message = `File '${req.originalUrl}' not found`;

  const error = new AppError(message, 404, "FILE_NOT_FOUND");
  (error as any).fileName = req.originalUrl;
  (error as any).requestType = "file";

  next(error);
};

/**
 * Method Not Allowed Handler
 * For when a route exists but the HTTP method is not supported
 */
export const methodNotAllowedHandler = (allowedMethods: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const message = `Method ${req.method} not allowed on ${req.originalUrl}. Allowed methods: ${allowedMethods.join(", ")}`;

    const error = new AppError(message, 405, "METHOD_NOT_ALLOWED");
    (error as any).method = req.method;
    (error as any).allowedMethods = allowedMethods;

    // Set the Allow header as per HTTP specification
    res.set("Allow", allowedMethods.join(", "));

    next(error);
  };
};

/**
 * Helper function to extract available routes from Express app
 * Useful for debugging and providing helpful error messages
 */
function getAvailableRoutes(app: any): string[] {
  const routes: string[] = [];

  try {
    // Extract routes from Express router stack
    if (app._router && app._router.stack) {
      app._router.stack.forEach((middleware: any) => {
        if (middleware.route) {
          // Direct route
          const methods = Object.keys(middleware.route.methods);
          methods.forEach((method) => {
            routes.push(`${method.toUpperCase()} ${middleware.route.path}`);
          });
        } else if (middleware.name === "router") {
          // Router middleware
          if (middleware.handle && middleware.handle.stack) {
            middleware.handle.stack.forEach((handler: any) => {
              if (handler.route) {
                const methods = Object.keys(handler.route.methods);
                methods.forEach((method) => {
                  const fullPath =
                    (middleware.regexp.source.includes("^\\")
                      ? ""
                      : middleware.regexp.source.replace(
                          /[^a-zA-Z0-9\/]/g,
                          ""
                        )) + handler.route.path;
                  routes.push(`${method.toUpperCase()} ${fullPath}`);
                });
              }
            });
          }
        }
      });
    }
  } catch (error) {
    console.warn("Could not extract available routes:", error);
  }

  return routes.filter((route, index, self) => self.indexOf(route) === index);
}

/**
 * Generic Not Found Factory
 * Creates custom not found handlers for different scenarios
 */
export const createNotFoundHandler = (
  message: string,
  code: string,
  statusCode: number = 404
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const error = new AppError(message, statusCode, code);
    (error as any).url = req.originalUrl;
    (error as any).method = req.method;
    next(error);
  };
};

// Export default not found handler
export default notFoundHandler;
