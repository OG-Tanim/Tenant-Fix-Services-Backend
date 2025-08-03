import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User, IUser } from "../modules/user/user.model";
import { AppError } from "./globalErrorHandler";
import { asyncWrapper } from "../utils/asyncWrapper";
import tokenService from "../services/token.service";

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request
 */
export const authenticate = asyncWrapper(
  async (req: Request, res: Response, next: NextFunction) => {
    let accessToken: string | undefined;

    // Get access token from Authorization header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      accessToken = req.headers.authorization.split(" ")[1];
    }
    // Get access token from cookie (if using cookie-based auth)
    else if (req.cookies?.accessToken) {
      accessToken = req.cookies.accessToken;
    }

    if (!accessToken) {
      throw new AppError(
        "Access denied. No access token provided.",
        401,
        "NO_ACCESS_TOKEN"
      );
    }

    try {
      // Verify access token using token service
      const decoded = tokenService.verifyAccessToken(accessToken);

      // Get user from database
      const user = await User.findById(decoded.userId);

      if (!user) {
        throw new AppError(
          "User not found. Token may be invalid.",
          401,
          "USER_NOT_FOUND"
        );
      }

      if (!user.isActive) {
        throw new AppError(
          "Account has been deactivated.",
          401,
          "ACCOUNT_DEACTIVATED"
        );
      }

      // Attach user to request
      req.user = user;
      next();
    } catch (error) {
      // If access token is expired, try to refresh it automatically
      if (error instanceof AppError && error.code === "ACCESS_TOKEN_EXPIRED") {
        return handleTokenRefresh(req, res, next);
      }
      throw error;
    }
  }
);

/**
 * Handle automatic token refresh
 */
const handleTokenRefresh = asyncWrapper(
  async (req: Request, res: Response, next: NextFunction) => {
    let refreshToken: string | undefined;

    // Get refresh token from cookie
    if (req.cookies?.refreshToken) {
      refreshToken = req.cookies.refreshToken;
    }

    if (!refreshToken) {
      throw new AppError(
        "Access token expired and no refresh token provided. Please login again.",
        401,
        "TOKEN_REFRESH_REQUIRED"
      );
    }

    try {
      // Refresh the access token
      const { accessToken: newAccessToken, user } =
        await tokenService.refreshAccessToken(refreshToken);

      // Set new access token in cookie
      res.cookie("accessToken", newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 15 * 60 * 1000, // 15 minutes
      });

      // Attach user to request
      req.user = user;
      next();
    } catch (refreshError) {
      // If refresh token is also invalid/expired, require login
      throw new AppError(
        "Session expired. Please login again.",
        401,
        "SESSION_EXPIRED"
      );
    }
  }
);

/**
 * Authorization middleware factory
 * Restricts access to specific user roles
 */
export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AppError("Authentication required.", 401, "AUTH_REQUIRED");
    }

    if (!roles.includes(req.user.role)) {
      throw new AppError(
        `Access denied. Required roles: ${roles.join(", ")}`,
        403,
        "INSUFFICIENT_PERMISSIONS"
      );
    }

    next();
  };
};

/**
 * Optional authentication middleware
 * Attaches user to request if token is provided, but doesn't require it
 */
export const optionalAuth = asyncWrapper(
  async (req: Request, res: Response, next: NextFunction) => {
    let accessToken: string | undefined;

    // Get access token from Authorization header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      accessToken = req.headers.authorization.split(" ")[1];
    }
    // Get access token from cookie
    else if (req.cookies?.accessToken) {
      accessToken = req.cookies.accessToken;
    }

    if (accessToken) {
      try {
        const decoded = tokenService.verifyAccessToken(accessToken);
        const user = await User.findById(decoded.userId);

        if (user && user.isActive) {
          req.user = user;
        }
      } catch (error) {
        // Try to refresh token if access token is expired
        if (
          error instanceof AppError &&
          error.code === "ACCESS_TOKEN_EXPIRED"
        ) {
          try {
            const refreshToken = req.cookies?.refreshToken;
            if (refreshToken) {
              const { accessToken: newAccessToken, user } =
                await tokenService.refreshAccessToken(refreshToken);

              // Set new access token in cookie
              res.cookie("accessToken", newAccessToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
                maxAge: 15 * 60 * 1000, // 15 minutes
              });

              req.user = user;
            }
          } catch (refreshError) {
            // Silently ignore refresh errors for optional auth
            console.warn("Optional auth refresh error:", refreshError);
          }
        } else {
          // Silently ignore other token errors for optional auth
          console.warn("Optional auth token error:", error);
        }
      }
    }

    next();
  }
);

/**
 * Self-access middleware
 * Ensures users can only access their own resources
 */
export const ensureSelfAccess = (userIdParam: string = "userId") => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AppError("Authentication required.", 401, "AUTH_REQUIRED");
    }

    const requestedUserId = req.params[userIdParam];
    const currentUserId = req.user._id.toString();

    if (requestedUserId !== currentUserId) {
      throw new AppError(
        "Access denied. You can only access your own resources.",
        403,
        "SELF_ACCESS_ONLY"
      );
    }

    next();
  };
};

/**
 * Account verification middleware
 * Ensures user account is verified
 */
export const requireVerification = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    throw new AppError("Authentication required.", 401, "AUTH_REQUIRED");
  }

  if (!req.user.isVerified) {
    throw new AppError(
      "Account verification required.",
      403,
      "VERIFICATION_REQUIRED"
    );
  }

  next();
};

/**
 * Rate limiting by user
 * Can be extended to implement user-specific rate limiting
 */
export const userRateLimit = (maxRequests: number, windowMs: number) => {
  const userRequests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next();
    }

    const userId = req.user._id.toString();
    const now = Date.now();
    const userLimit = userRequests.get(userId);

    if (!userLimit || now > userLimit.resetTime) {
      userRequests.set(userId, {
        count: 1,
        resetTime: now + windowMs,
      });
      return next();
    }

    if (userLimit.count >= maxRequests) {
      throw new AppError(
        "Too many requests. Please try again later.",
        429,
        "RATE_LIMIT_EXCEEDED"
      );
    }

    userLimit.count++;
    next();
  };
};
