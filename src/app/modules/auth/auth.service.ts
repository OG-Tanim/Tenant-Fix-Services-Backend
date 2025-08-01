import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
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

export class AuthService {
  private readonly JWT_SECRET: string =
    process.env.JWT_SECRET || "your-secret-key";
  private readonly JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || "7d";
  private readonly BCRYPT_ROUNDS = 12;

  /**
   * Register a new user based on their role
   */
  async register(
    userData: RegistrationInput
  ): Promise<{ user: IUser; token: string }> {
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

    // Generate JWT token
    const token = this.generateToken(user._id.toString());

    // Remove password from response
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userResponse } = user.toObject();

    return { user: userResponse as unknown as IUser, token };
  }

  /**
   * Login user
   */
  async login(loginData: LoginInput): Promise<{ user: IUser; token: string }> {
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

    // Generate JWT token
    const token = this.generateToken(user._id.toString());

    // Remove password from response
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userResponse } = user.toObject();

    return { user: userResponse as unknown as IUser, token };
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
   * Verify JWT token and return user
   */
  async verifyToken(token: string): Promise<IUser> {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET) as { userId: string };
      const user = await User.findById(decoded.userId);

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
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AppError("Invalid token", 401, "INVALID_TOKEN");
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new AppError("Token has expired", 401, "TOKEN_EXPIRED");
      }
      throw error;
    }
  }

  /**
   * Generate JWT token
   */
  private generateToken(userId: string): string {
    return jwt.sign(
      { userId },
      this.JWT_SECRET as string,
      { expiresIn: this.JWT_EXPIRES_IN } as jwt.SignOptions
    );
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
