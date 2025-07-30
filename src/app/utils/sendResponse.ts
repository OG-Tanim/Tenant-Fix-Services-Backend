import { Response } from "express";

// Response interfaces
export interface SuccessResponseData<T = any> {
  status: "success";
  message?: string;
  data: T;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    pages?: number;
    hasNext?: boolean;
    hasPrev?: boolean;
  };
  timestamp?: string;
  requestId?: string;
}

export interface ErrorResponseData {
  status: "error" | "fail";
  message: string;
  code?: string;
  errors?: any[];
  timestamp?: string;
  requestId?: string;
  path?: string;
}

// Pagination metadata interface
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Response options
export interface ResponseOptions {
  message?: string;
  meta?: Partial<PaginationMeta>;
  requestId?: string;
  headers?: Record<string, string>;
  cookies?: Array<{
    name: string;
    value: string;
    options?: any;
  }>;
}

/**
 * Central SendResponse Class
 * Provides consistent response formatting throughout the application
 */
class SendResponse {
  /**
   * Send successful response with data
   * @param res Express Response object
   * @param data Response data
   * @param statusCode HTTP status code (default: 200)
   * @param options Additional response options
   */
  success<T>(
    res: Response,
    data: T,
    statusCode: number = 200,
    options?: ResponseOptions
  ): Response {
    const response: SuccessResponseData<T> = {
      status: "success",
      data,
      timestamp: new Date().toISOString(),
    };

    // Add optional fields
    if (options?.message) response.message = options.message;
    if (options?.meta) response.meta = this.formatMeta(options.meta);
    if (options?.requestId) response.requestId = options.requestId;

    // Set custom headers if provided
    if (options?.headers) {
      Object.entries(options.headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
    }

    // Set cookies if provided
    if (options?.cookies) {
      options.cookies.forEach((cookie) => {
        res.cookie(cookie.name, cookie.value, cookie.options);
      });
    }

    return res.status(statusCode).json(response);
  }

  /**
   * Send successful response for created resources
   * @param res Express Response object
   * @param data Created resource data
   * @param options Additional response options
   */
  created<T>(res: Response, data: T, options?: ResponseOptions): Response {
    return this.success(res, data, 201, {
      message: "Resource created successfully",
      ...options,
    });
  }

  /**
   * Send successful response with custom message
   * @param res Express Response object
   * @param message Success message
   * @param data Optional response data
   * @param statusCode HTTP status code (default: 200)
   * @param options Additional response options
   */
  message<T = any>(
    res: Response,
    message: string,
    data?: T,
    statusCode: number = 200,
    options?: Omit<ResponseOptions, "message">
  ): Response {
    return this.success(res, data || ({} as T), statusCode, {
      message,
      ...options,
    });
  }

  /**
   * Send paginated response
   * @param res Express Response object
   * @param data Array of items
   * @param pagination Pagination metadata
   * @param options Additional response options
   */
  paginated<T>(
    res: Response,
    data: T[],
    pagination: PaginationMeta,
    options?: Omit<ResponseOptions, "meta">
  ): Response {
    return this.success(res, data, 200, {
      message: `Retrieved ${data.length} items`,
      meta: pagination,
      ...options,
    });
  }

  /**
   * Send no content response (204)
   * @param res Express Response object
   * @param options Additional response options
   */
  noContent(res: Response, options?: ResponseOptions): Response {
    // Set custom headers if provided
    if (options?.headers) {
      Object.entries(options.headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
    }

    // Set cookies if provided
    if (options?.cookies) {
      options.cookies.forEach((cookie) => {
        res.cookie(cookie.name, cookie.value, cookie.options);
      });
    }

    return res.status(204).send();
  }

  /**
   * Send error response (use this sparingly, prefer throwing AppError)
   * @param res Express Response object
   * @param message Error message
   * @param statusCode HTTP status code
   * @param code Error code
   * @param errors Additional error details
   */
  error(
    res: Response,
    message: string,
    statusCode: number = 500,
    code?: string,
    errors?: any[]
  ): Response {
    const response: ErrorResponseData = {
      status: statusCode < 500 ? "fail" : "error",
      message,
      timestamp: new Date().toISOString(),
    };

    if (code) response.code = code;
    if (errors) response.errors = errors;

    return res.status(statusCode).json(response);
  }

  /**
   * Format pagination metadata
   * @param meta Partial pagination metadata
   * @returns Formatted pagination metadata
   */
  private formatMeta(meta: Partial<PaginationMeta>): PaginationMeta {
    const { total = 0, page = 1, limit = 10 } = meta;
    const pages = Math.ceil(total / limit);

    return {
      total,
      page,
      limit,
      pages,
      hasNext: page < pages,
      hasPrev: page > 1,
    };
  }
}

// Create singleton instance
const sendResponse = new SendResponse();

// Export individual methods for convenience
export const success = sendResponse.success.bind(sendResponse);
export const created = sendResponse.created.bind(sendResponse);
export const message = sendResponse.message.bind(sendResponse);
export const paginated = sendResponse.paginated.bind(sendResponse);
export const noContent = sendResponse.noContent.bind(sendResponse);
export const error = sendResponse.error.bind(sendResponse);

// Export the class and instance
export { SendResponse };
export default sendResponse;
