import bcrypt from "bcrypt";
import crypto from "crypto";
import {
  User,
  Tenant,
  Manager,
  Contractor,
  IUser,
  ITenant,
  IManager,
  IContractor,
} from "../../models/user.model";
import { AppError } from "../../middleware/globalErrorHandler";
import {
  RegistrationInput,
  LoginInput,
  ChangePasswordInput,
} from "./auth.validation";
import { userResponses } from "../../utils/responseHelper";
import tokenManager, { DeviceInfo } from "../../utils/tokenManager";

export class AuthService {
  private readonly BCRYPT_ROUNDS = 12;

  /**
   * Register a new user based on their role
   */
  async register(
    userData: RegistrationInput,
    deviceInfo?: DeviceInfo
  ): Promise<{ user: IUser; accessToken: string; refreshToken: string }> {
    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email: userData.email }, { phone: userData.phone }],
    });

    if (existingUser) {
      if (existingUser.email === userData.email) {
        throw new AppError(
          "User with this email already exists",
          409,
          "EMAIL_EXISTS"
        );
      }
      if (existingUser.phone === userData.phone) {
        throw new AppError(
          "User with this phone number already exists",
          409,
          "PHONE_EXISTS"
        );
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(
      userData.password,
      this.BCRYPT_ROUNDS
    );

    let user: IUser;

    // Create user based on role
    switch (userData.role) {
      case "tenant":
        user = new Tenant({
          ...userData,
          password: hashedPassword,
        });
        break;
      case "manager":
        user = new Manager({
          ...userData,
          password: hashedPassword,
        });
        break;
      case "contractor":
        user = new Contractor({
          ...userData,
          password: hashedPassword,
        });
        break;
      default:
        throw new AppError("Invalid user role", 400, "INVALID_ROLE");
    }

    await user.save();

    // Generate token pair
    const { accessToken, refreshToken } = await tokenManager.generateTokenPair(user, deviceInfo);

    // Remove password from response
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userResponse } = user.toObject();

    return { 
      user: userResponse as unknown as IUser, 
      accessToken, 
      refreshToken 
    };
  }

  /**
   * Login user
   */
  async login(
    loginData: LoginInput,
    deviceInfo?: DeviceInfo
  ): Promise<{ user: IUser; accessToken: string; refreshToken: string }> {
    // Find user and include password for comparison
    const user = await User.findOne({ email: loginData.email }).select(
      "+password"
    );

    if (!user) {
      throw new AppError(
        "Invalid email or password",
        401,
        "INVALID_CREDENTIALS"
      );
    }

    // Check if user is active
    if (!user.isActive) {
      throw new AppError(
        "Your account has been deactivated. Please contact support.",
        401,
        "ACCOUNT_DEACTIVATED"
      );
    }

    // Compare password
    const isPasswordValid = await bcrypt.compare(
      loginData.password,
      user.password
    );

    if (!isPasswordValid) {
      throw new AppError(
        "Invalid email or password",
        401,
        "INVALID_CREDENTIALS"
      );
    }

    // Generate token pair
    const { accessToken, refreshToken } = await tokenManager.generateTokenPair(user, deviceInfo);

    // Remove password from response
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userResponse } = user.toObject();

    return { 
      user: userResponse as unknown as IUser, 
      accessToken, 
      refreshToken 
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(
    refreshToken: string,
    deviceInfo?: DeviceInfo
  ): Promise<{ accessToken: string; refreshToken: string }> {
    return tokenManager.refreshAccessToken(refreshToken, deviceInfo);
  }

  /**
   * Logout user (revoke refresh token)
   */
  async logout(refreshToken: string): Promise<void> {
    await tokenManager.revokeRefreshToken(refreshToken);
  }

  /**
   * Logout from all devices
   */
  async logoutAllDevices(userId: string): Promise<void> {
    await tokenManager.revokeAllUserTokens(userId);
  }

  /**
   * Get user profile by ID
   */
  async getProfile(userId: string): Promise<IUser> {
    const user = await User.findById(userId);

    if (!user) {
      throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }

    if (!user.isActive) {
      throw new AppError(
        "Account has been deactivated",
        401,
        "ACCOUNT_DEACTIVATED"
      );
    }

    return user;
  }

  /**
   * Update user profile
   */
  async updateProfile(
    userId: string,
    updateData: Partial<IUser>
  ): Promise<IUser> {
    // Remove sensitive fields that shouldn't be updated via this method
    const { password, email, role, isActive, isVerified, ...safeUpdateData } =
      updateData;

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: safeUpdateData },
      { new: true, runValidators: true }
    );

    if (!user) {
      throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }

    return user;
  }

  /**
   * Change user password
   */
  async changePassword(
    userId: string,
    passwordData: ChangePasswordInput
  ): Promise<void> {
    const user = await User.findById(userId).select("+password");

    if (!user) {
      throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      passwordData.currentPassword,
      user.password
    );

    if (!isCurrentPasswordValid) {
      throw new AppError(
        "Current password is incorrect",
        400,
        "INVALID_CURRENT_PASSWORD"
      );
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(
      passwordData.newPassword,
      this.BCRYPT_ROUNDS
    );

    // Update password
    await User.findByIdAndUpdate(userId, { password: hashedNewPassword });
  }

  /**
   * Deactivate user account
   */
  async deactivateAccount(userId: string): Promise<void> {
    const user = await User.findByIdAndUpdate(
      userId,
      { isActive: false },
      { new: true }
    );

    if (!user) {
      throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }
  }

  /**
   * Get users by role with pagination
   */
  async getUsersByRole(
    role: "tenant" | "manager" | "contractor",
    page: number = 1,
    limit: number = 10,
    filters: any = {}
  ): Promise<{ users: IUser[]; total: number; page: number; pages: number }> {
    const skip = (page - 1) * limit;

    const query = { role, isActive: true, ...filters };

    const [users, total] = await Promise.all([
      User.find(query).skip(skip).limit(limit).sort({ createdAt: -1 }),
      User.countDocuments(query),
    ]);

    const pages = Math.ceil(total / limit);

    return { users, total, page, pages };
  }

  /**
   * Search contractors by trade type and location
   */
  async searchContractors(
    tradeType?: string,
    zipCode?: string,
    maxDistance?: number
  ): Promise<IContractor[]> {
    const query: any = { role: "contractor", isActive: true };

    if (tradeType) {
      query.tradeType = tradeType;
    }

    if (zipCode && maxDistance) {
      // For now, we'll do a simple zip code match
      // In a real application, you'd want to implement proper geolocation
      query.zipCode = zipCode;
      query.distance = { $lte: maxDistance };
    }

    const contractors = await Contractor.find(query).sort({ createdAt: -1 });
    return contractors;
  }

  /**
   * Get user active sessions
   */
  async getUserSessions(userId: string) {
    return tokenManager.getUserActiveSessions(userId);
  }

  /**
   * Revoke specific session
   */
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    await tokenManager.revokeSession(userId, sessionId);
  }

  /**
   * Generate password reset token
   */
  generatePasswordResetToken(): {
    token: string;
    hashedToken: string;
    expires: Date;
  } {
    const token = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    return { token, hashedToken, expires };
  }
}

export default new AuthService();
