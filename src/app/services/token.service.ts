import jwt from "jsonwebtoken";
import crypto from "crypto";
import { User, IUser } from "../modules/user/user.model";
import { AppError } from "../middleware/globalErrorHandler";

export interface TokenPayload {
  userId: string;
  role: string;
  type: "access" | "refresh";
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export class TokenService {
  private readonly ACCESS_TOKEN_SECRET: string;
  private readonly REFRESH_TOKEN_SECRET: string;
  private readonly ACCESS_TOKEN_EXPIRES_IN: string;
  private readonly REFRESH_TOKEN_EXPIRES_IN: string;

  constructor() {
    this.ACCESS_TOKEN_SECRET =
      process.env.ACCESS_TOKEN_SECRET ||
      process.env.JWT_SECRET ||
      "access-secret-key";
    this.REFRESH_TOKEN_SECRET =
      process.env.REFRESH_TOKEN_SECRET || "refresh-secret-key";
    this.ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || "15m";
    this.REFRESH_TOKEN_EXPIRES_IN =
      process.env.REFRESH_TOKEN_EXPIRES_IN || "7d";
  }

  /**
   * Generate access token
   */
  generateAccessToken(userId: string, role: string): string {
    const payload: TokenPayload = {
      userId,
      role,
      type: "access",
    };

    return jwt.sign(payload, this.ACCESS_TOKEN_SECRET, {
      expiresIn: this.ACCESS_TOKEN_EXPIRES_IN,
    } as jwt.SignOptions);
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(userId: string, role: string): string {
    const payload: TokenPayload = {
      userId,
      role,
      type: "refresh",
    };

    return jwt.sign(payload, this.REFRESH_TOKEN_SECRET, {
      expiresIn: this.REFRESH_TOKEN_EXPIRES_IN,
    } as jwt.SignOptions);
  }

  /**
   * Generate both access and refresh tokens
   */
  generateTokenPair(userId: string, role: string): TokenPair {
    const accessToken = this.generateAccessToken(userId, role);
    const refreshToken = this.generateRefreshToken(userId, role);

    return { accessToken, refreshToken };
  }

  /**
   * Verify access token
   */
  verifyAccessToken(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(
        token,
        this.ACCESS_TOKEN_SECRET
      ) as TokenPayload;

      if (decoded.type !== "access") {
        throw new AppError("Invalid token type", 401, "INVALID_TOKEN_TYPE");
      }

      return decoded;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AppError("Invalid access token", 401, "INVALID_ACCESS_TOKEN");
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new AppError(
          "Access token has expired",
          401,
          "ACCESS_TOKEN_EXPIRED"
        );
      }
      throw error;
    }
  }

  /**
   * Verify refresh token
   */
  verifyRefreshToken(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(
        token,
        this.REFRESH_TOKEN_SECRET
      ) as TokenPayload;

      if (decoded.type !== "refresh") {
        throw new AppError("Invalid token type", 401, "INVALID_TOKEN_TYPE");
      }

      return decoded;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AppError(
          "Invalid refresh token",
          401,
          "INVALID_REFRESH_TOKEN"
        );
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new AppError(
          "Refresh token has expired",
          401,
          "REFRESH_TOKEN_EXPIRED"
        );
      }
      throw error;
    }
  }

  /**
   * Store refresh token in database
   */
  async storeRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const refreshTokenExpiresAt = new Date();
    refreshTokenExpiresAt.setDate(refreshTokenExpiresAt.getDate() + 7); // 7 days from now

    await User.findByIdAndUpdate(userId, {
      refreshToken: await this.hashToken(refreshToken),
      refreshTokenExpiresAt,
    });
  }

  /**
   * Validate stored refresh token
   */
  async validateStoredRefreshToken(
    userId: string,
    refreshToken: string
  ): Promise<boolean> {
    const user = await User.findById(userId).select(
      "+refreshToken +refreshTokenExpiresAt"
    );

    if (!user || !user.refreshToken || !user.refreshTokenExpiresAt) {
      return false;
    }

    // Check if refresh token has expired
    if (user.refreshTokenExpiresAt < new Date()) {
      // Clean up expired token
      await this.revokeRefreshToken(userId);
      return false;
    }

    // Compare hashed tokens
    const hashedToken = await this.hashToken(refreshToken);
    return user.refreshToken === hashedToken;
  }

  /**
   * Revoke refresh token
   */
  async revokeRefreshToken(userId: string): Promise<void> {
    await User.findByIdAndUpdate(userId, {
      $unset: {
        refreshToken: 1,
        refreshTokenExpiresAt: 1,
      },
    });
  }

  /**
   * Revoke all refresh tokens for a user
   */
  async revokeAllRefreshTokens(userId: string): Promise<void> {
    await this.revokeRefreshToken(userId);
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(
    refreshToken: string
  ): Promise<{ accessToken: string; user: IUser }> {
    // Verify refresh token
    const decoded = this.verifyRefreshToken(refreshToken);

    // Validate stored refresh token
    const isValidStored = await this.validateStoredRefreshToken(
      decoded.userId,
      refreshToken
    );
    if (!isValidStored) {
      throw new AppError(
        "Invalid or expired refresh token",
        401,
        "INVALID_REFRESH_TOKEN"
      );
    }

    // Get user
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

    // Generate new access token
    const accessToken = this.generateAccessToken(
      user._id.toString(),
      user.role
    );

    return { accessToken, user };
  }

  /**
   * Hash token for secure storage
   */
  private async hashToken(token: string): Promise<string> {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  /**
   * Get token expiration times in milliseconds
   */
  getTokenExpirationTimes(): { accessToken: number; refreshToken: number } {
    // Convert time strings to milliseconds
    const accessTokenMs = this.parseTimeToMs(this.ACCESS_TOKEN_EXPIRES_IN);
    const refreshTokenMs = this.parseTimeToMs(this.REFRESH_TOKEN_EXPIRES_IN);

    return {
      accessToken: accessTokenMs,
      refreshToken: refreshTokenMs,
    };
  }

  /**
   * Parse time string to milliseconds
   */
  private parseTimeToMs(timeString: string): number {
    const match = timeString.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error(`Invalid time format: ${timeString}`);
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case "s":
        return value * 1000;
      case "m":
        return value * 60 * 1000;
      case "h":
        return value * 60 * 60 * 1000;
      case "d":
        return value * 24 * 60 * 60 * 1000;
      default:
        throw new Error(`Invalid time unit: ${unit}`);
    }
  }
}

export default new TokenService();
