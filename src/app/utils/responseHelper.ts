import { Request, Response } from "express";
import sendResponse, { PaginationMeta } from "./sendResponse";

/**
 * Response Helper Utilities
 * Additional utilities to work with the central SendResponse
 */

/**
 * Extract pagination parameters from request query
 * @param req Express Request object
 * @param defaultLimit Default limit if not provided
 * @returns Pagination parameters
 */
export const extractPaginationParams = (
  req: Request,
  defaultLimit: number = 10
): { page: number; limit: number; offset: number } => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(req.query.limit as string) || defaultLimit)
  );
  const offset = (page - 1) * limit;

  return { page, limit, offset };
};

/**
 * Create pagination metadata from total count and pagination params
 * @param total Total number of items
 * @param page Current page
 * @param limit Items per page
 * @returns Pagination metadata
 */
export const createPaginationMeta = (
  total: number,
  page: number,
  limit: number
): PaginationMeta => {
  const pages = Math.ceil(total / limit);

  return {
    total,
    page,
    limit,
    pages,
    hasNext: page < pages,
    hasPrev: page > 1,
  };
};

/**
 * Extract request ID from various sources (headers, custom middleware, etc.)
 * @param req Express Request object
 * @returns Request ID or generates one
 */
export const extractRequestId = (req: Request): string => {
  return (
    (req.headers["x-request-id"] as string) ||
    (req as any).requestId ||
    `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  );
};

/**
 * Response wrapper that automatically handles request ID extraction
 * @param res Express Response object
 * @param req Express Request object (optional, for request ID extraction)
 * @returns Response helper object
 */
export const createResponseHelper = (res: Response, req?: Request) => {
  const requestId = req ? extractRequestId(req) : undefined;

  return {
    /**
     * Send success response with automatic request ID
     */
    success: <T>(
      data: T,
      statusCode?: number,
      message?: string,
      meta?: any
    ) => {
      return sendResponse.success(res, data, statusCode, {
        message,
        meta,
        requestId,
      });
    },

    /**
     * Send created response with automatic request ID
     */
    created: <T>(data: T, message?: string) => {
      return sendResponse.created(res, data, {
        message,
        requestId,
      });
    },

    /**
     * Send message response with automatic request ID
     */
    message: (message: string, data?: any, statusCode?: number) => {
      return sendResponse.message(res, message, data, statusCode, {
        requestId,
      });
    },

    /**
     * Send paginated response with automatic request ID and pagination
     */
    paginated: <T>(data: T[], total: number, page: number, limit: number) => {
      const meta = createPaginationMeta(total, page, limit);
      return sendResponse.paginated(res, data, meta, {
        requestId,
      });
    },

    /**
     * Send no content response
     */
    noContent: () => {
      return sendResponse.noContent(res, { requestId });
    },

    /**
     * Send error response (use sparingly)
     */
    error: (
      message: string,
      statusCode?: number,
      code?: string,
      errors?: any[]
    ) => {
      return sendResponse.error(res, message, statusCode, code, errors);
    },
  };
};

/**
 * Middleware to attach response helper to res object
 * Usage: app.use(attachResponseHelper);
 */
export const attachResponseHelper = (
  req: Request,
  res: Response,
  next: any
) => {
  (res as any).sendResponse = createResponseHelper(res, req);
  next();
};

/**
 * Transform database results for API response
 * Removes sensitive fields and formats data
 * @param data Raw data from database
 * @param excludeFields Fields to exclude from response
 * @returns Transformed data
 */
export const transformForResponse = <T extends Record<string, any>>(
  data: T | T[],
  excludeFields: string[] = ["password", "__v", "deletedAt"]
): T | T[] => {
  const transform = (item: T): T => {
    const transformed = { ...item } as T & { id?: any; _id?: any };

    // Remove excluded fields
    excludeFields.forEach((field) => {
      delete transformed[field];
    });

    // Transform _id to id if it exists (MongoDB)
    if (transformed._id) {
      transformed.id = transformed._id;
      delete transformed._id;
    }

    return transformed as T;
  };

  return Array.isArray(data) ? data.map(transform) : transform(data);
};

/**
 * Format validation errors for consistent response
 * @param errors Validation errors array
 * @returns Formatted error array
 */
export const formatValidationErrors = (errors: any[]): any[] => {
  return errors.map((error) => ({
    field: error.path || error.field,
    message: error.message,
    value: error.value,
    code: error.code || "VALIDATION_ERROR",
  }));
};

/**
 * Create a response handler for common CRUD operations
 * @param resourceName Name of the resource (e.g., 'user', 'post')
 * @returns Object with common response methods
 */
export const createCrudResponseHandler = (resourceName: string) => {
  const capitalizedName =
    resourceName.charAt(0).toUpperCase() + resourceName.slice(1);

  return {
    created: (res: Response, data: any, req?: Request) => {
      const helper = createResponseHelper(res, req);
      return helper.created(data, `${capitalizedName} created successfully`);
    },

    updated: (res: Response, data: any, req?: Request) => {
      const helper = createResponseHelper(res, req);
      return helper.success(
        data,
        200,
        `${capitalizedName} updated successfully`
      );
    },

    deleted: (res: Response, req?: Request) => {
      const helper = createResponseHelper(res, req);
      return helper.message(`${capitalizedName} deleted successfully`);
    },

    retrieved: (res: Response, data: any, req?: Request) => {
      const helper = createResponseHelper(res, req);
      return helper.success(
        data,
        200,
        `${capitalizedName} retrieved successfully`
      );
    },

    listed: (
      res: Response,
      data: any[],
      total: number,
      page: number,
      limit: number,
      req?: Request
    ) => {
      const helper = createResponseHelper(res, req);
      return helper.paginated(data, total, page, limit);
    },
  };
};

// Export commonly used CRUD handlers
export const userResponses = createCrudResponseHandler("user");
export const postResponses = createCrudResponseHandler("post");
export const categoryResponses = createCrudResponseHandler("category");

export default {
  extractPaginationParams,
  createPaginationMeta,
  extractRequestId,
  createResponseHelper,
  attachResponseHelper,
  transformForResponse,
  formatValidationErrors,
  createCrudResponseHandler,
  userResponses,
  postResponses,
  categoryResponses,
};
