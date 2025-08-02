import { Request, Response, NextFunction } from "express";
import { asyncWrapper } from "../../utils/asyncWrapper";
import authService from "./auth.service";
import sendResponse from "../../utils/sendResponse";
import { AppError } from "../../middleware/globalErrorHandler";
import {
  RegistrationInput,
  LoginInput,
  ChangePasswordInput,
} from "./auth.validation";
import tokenManager from "../../utils/tokenManager";

export class AuthController {
  /**
   * Register a new user
   */
  register = asyncWrapper(async (req: Request, res: Response) => {
    const userData: RegistrationInput = req.body;
    const deviceInfo = tokenManager.extractDeviceInfo(req);

    const { user, accessToken, refreshToken } = await authService.register(userData, deviceInfo);

    // Set tokens in cookies
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    sendResponse.created(
      res,
      {
        user,
        accessToken,
        refreshToken,
      },
      {
        message: `${user.role.charAt(0).toUpperCase() + user.role.slice(1)} registered successfully`,
      }
    );
  });

  /**
   * Login user
   */
  login = asyncWrapper(async (req: Request, res: Response) => {
    const loginData: LoginInput = req.body;
    const deviceInfo = tokenManager.extractDeviceInfo(req);

    const { user, accessToken, refreshToken } = await authService.login(loginData, deviceInfo);

    // Set tokens in cookies
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    sendResponse.success(
      res,
      {
        user,
        accessToken,
        refreshToken,
      },
      200,
      {
        message: "Login successful",
      }
    );
  });

  /**
   * Refresh access token
   */
  refreshToken = asyncWrapper(async (req: Request, res: Response) => {
    const { refreshToken: refreshTokenFromBody } = req.body;
    const refreshTokenFromCookie = req.cookies?.refreshToken;
    const deviceInfo = tokenManager.extractDeviceInfo(req);

    const refreshToken = refreshTokenFromBody || refreshTokenFromCookie;

    if (!refreshToken) {
      throw new AppError("Refresh token is required", 400, "REFRESH_TOKEN_REQUIRED");
    }

    const { accessToken, refreshToken: newRefreshToken } = await authService.refreshToken(
      refreshToken,
      deviceInfo
    );

    // Set new tokens in cookies
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    sendResponse.success(
      res,
      {
        accessToken,
        refreshToken: newRefreshToken,
      },
      200,
      {
        message: "Token refreshed successfully",
      }
    );
  });
  /**
   * Logout user
   */
  logout = asyncWrapper(async (req: Request, res: Response) => {
    const { refreshToken: refreshTokenFromBody } = req.body;
    const refreshTokenFromCookie = req.cookies?.refreshToken;

    const refreshToken = refreshTokenFromBody || refreshTokenFromCookie;

    if (refreshToken) {
      await authService.logout(refreshToken);
    }

    // Clear token cookies
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");

    sendResponse.message(res, "Logout successful");
  });

  /**
   * Logout from all devices
   */
  logoutAllDevices = asyncWrapper(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;

    await authService.logoutAllDevices(userId);

    // Clear token cookies
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");

    sendResponse.message(res, "Logged out from all devices successfully");
  });

  /**
   * Get current user profile
   */
  getProfile = asyncWrapper(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;

    const user = await authService.getProfile(userId);

    sendResponse.success(res, user, 200, {
      message: "Profile retrieved successfully",
    });
  });

  /**
   * Update user profile
   */
  updateProfile = asyncWrapper(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const updateData = req.body;

    const user = await authService.updateProfile(userId, updateData);

    sendResponse.success(res, user, 200, {
      message: "Profile updated successfully",
    });
  });

  /**
   * Change password
   */
  changePassword = asyncWrapper(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const passwordData: ChangePasswordInput = req.body;

    await authService.changePassword(userId, passwordData);

    sendResponse.message(res, "Password changed successfully");
  });

  /**
   * Deactivate account
   */
  deactivateAccount = asyncWrapper(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;

    await authService.deactivateAccount(userId);
    await authService.logoutAllDevices(userId);

    // Clear token cookies
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");

    sendResponse.message(res, "Account deactivated successfully");
  });

  /**
   * Get user active sessions
   */
  getSessions = asyncWrapper(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;

    const sessions = await authService.getUserSessions(userId);

    sendResponse.success(res, sessions, 200, {
      message: "Active sessions retrieved successfully",
    });
  });

  /**
   * Revoke specific session
   */
  revokeSession = asyncWrapper(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { sessionId } = req.params;

    await authService.revokeSession(userId, sessionId);

    sendResponse.message(res, "Session revoked successfully");
  });

  /**
   * Get users by role (admin functionality)
   */
  getUsersByRole = asyncWrapper(async (req: Request, res: Response) => {
    const { role } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    if (!["tenant", "manager", "contractor"].includes(role)) {
      throw new AppError("Invalid role specified", 400, "INVALID_ROLE");
    }

    const result = await authService.getUsersByRole(
      role as "tenant" | "manager" | "contractor",
      page,
      limit
    );

    sendResponse.paginated(res, result.users, {
      total: result.total,
      page: result.page,
      limit,
      pages: result.pages,
      hasNext: result.page < result.pages,
      hasPrev: result.page > 1,
    });
  });

  /**
   * Search contractors
   */
  searchContractors = asyncWrapper(async (req: Request, res: Response) => {
    const { tradeType, zipCode, maxDistance } = req.query;

    const contractors = await authService.searchContractors(
      tradeType as string,
      zipCode as string,
      maxDistance ? parseInt(maxDistance as string) : undefined
    );

    sendResponse.success(res, contractors, 200, {
      message: `Found ${contractors.length} contractors`,
    });
  });

  /**
   * Get user statistics (admin functionality)
   */
  getUserStats = asyncWrapper(async (req: Request, res: Response) => {
    const [tenants, managers, contractors] = await Promise.all([
      authService.getUsersByRole("tenant", 1, 1),
      authService.getUsersByRole("manager", 1, 1),
      authService.getUsersByRole("contractor", 1, 1),
    ]);

    const stats = {
      totalUsers: tenants.total + managers.total + contractors.total,
      tenants: tenants.total,
      managers: managers.total,
      contractors: contractors.total,
    };

    sendResponse.success(res, stats, 200, {
      message: "User statistics retrieved successfully",
    });
  });
}

export default new AuthController();
