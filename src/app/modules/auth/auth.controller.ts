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

    const { user, token } = await authService.register(userData);

    // Set token in cookie (optional)
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    sendResponse.created(
      res,
      {
        user,
        token,
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

    const { user, token } = await authService.login(loginData);

    // Set token in cookie (optional)
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    sendResponse.success(
      res,
      {
        user,
        token,
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
    // Clear token cookie
    res.clearCookie("token");

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

    // Clear token cookie
    res.clearCookie("token");

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
