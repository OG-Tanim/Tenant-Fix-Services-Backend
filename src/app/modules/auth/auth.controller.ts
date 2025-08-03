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

export class AuthController {
  /**
   * Register a new user
   */
  register = asyncWrapper(async (req: Request, res: Response) => {
    const userData: RegistrationInput = req.body;

    const { user, accessToken, refreshToken } =
      await authService.register(userData);

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

    const { user, accessToken, refreshToken } =
      await authService.login(loginData);

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
      },
      200,
      {
        message: "Login successful",
      }
    );
  });

  /**
   * Logout user
   */
  logout = asyncWrapper(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;

    if (userId) {
      // Revoke refresh token from database
      await authService.logout(userId);
    }

    // Clear token cookies
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");

    sendResponse.message(res, "Logout successful");
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
   * Refresh access token using refresh token
   */
  refreshToken = asyncWrapper(async (req: Request, res: Response) => {
    let refreshToken: string | undefined;

    // Get refresh token from cookie or body
    if (req.cookies?.refreshToken) {
      refreshToken = req.cookies.refreshToken;
    } else if (req.body.refreshToken) {
      refreshToken = req.body.refreshToken;
    }

    if (!refreshToken) {
      throw new AppError("Refresh token not provided", 401, "NO_REFRESH_TOKEN");
    }

    const { accessToken, user } = await authService.refreshToken(refreshToken);

    // Set new access token in cookie
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    sendResponse.success(
      res,
      {
        user,
        accessToken,
      },
      200,
      {
        message: "Token refreshed successfully",
      }
    );
  });

  /**
   * Logout from all devices
   */
  logoutFromAllDevices = asyncWrapper(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;

    if (userId) {
      // Revoke all refresh tokens from database
      await authService.logoutFromAllDevices(userId);
    }

    // Clear token cookies
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");

    sendResponse.message(res, "Logged out from all devices successfully");
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

    // Clear token cookies
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");

    sendResponse.message(res, "Account deactivated successfully");
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
