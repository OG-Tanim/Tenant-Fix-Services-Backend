import { Request, Response, NextFunction } from "express";
import { User, IUser } from "../models/user.model";
import { AppError } from "./globalErrorHandler";
import { asyncWrapper } from "../utils/asyncWrapper";
import tokenManager from "../utils/tokenManager";

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
    let token: string | undefined;

    // Get token from Authorization header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }
    // Get token from cookie
    else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      throw new AppError("Access denied. No token provided.", 401, "NO_TOKEN");
    }

    try {
      // Verify access token
      const decoded = tokenManager.verifyAccessToken(token);

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
      // TokenManager already throws appropriate AppErrors
      next(error);
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
    let token: string | undefined;

    // Get token from Authorization header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }
    // Get token from cookie
    else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (token) {
      try {
        const decoded = tokenManager.verifyAccessToken(token);

        const user = await User.findById(decoded.userId);

        if (user && user.isActive) {
          req.user = user;
        }
      } catch (error) {
        // Silently ignore token errors for optional auth
        console.warn("Optional auth token error:", error);
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
