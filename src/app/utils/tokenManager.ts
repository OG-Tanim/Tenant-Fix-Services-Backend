import jwt from "jsonwebtoken";
import crypto from "crypto";
import { RefreshToken, IRefreshToken } from "../models/refreshToken.model";
import { IUser } from "../models/user.model";
import { AppError } from "../middleware/globalErrorHandler";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface TokenPayload {
  userId: string;
  role: string;
  email: string;
}

export interface DeviceInfo {
  userAgent?: string;
  ip?: string;
  deviceId?: string;
}

export class TokenManager {
  private readonly ACCESS_TOKEN_SECRET: string;
  private readonly REFRESH_TOKEN_SECRET: string;
  private readonly ACCESS_TOKEN_EXPIRES_IN: string;
  private readonly REFRESH_TOKEN_EXPIRES_IN: string;
  private readonly REFRESH_TOKEN_EXPIRES_DAYS: number;

  constructor() {
    this.ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET || "access-secret-key";
    this.REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || "refresh-secret-key";
    this.ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || "15m";
    this.REFRESH_TOKEN_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "7d";
    this.REFRESH_TOKEN_EXPIRES_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || "7");
  }

  /**
   * Generate access token
   */
  generateAccessToken(user: IUser): string {
    const payload: TokenPayload = {
      userId: user._id.toString(),
      role: user.role,
      email: user.email,
    };

    return jwt.sign(payload, this.ACCESS_TOKEN_SECRET, {
      expiresIn: this.ACCESS_TOKEN_EXPIRES_IN,
      issuer: "tenant-fix-services",
      audience: "tenant-fix-app",
    });
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(): string {
    return crypto.randomBytes(64).toString("hex");
  }

  /**
   * Generate token pair (access + refresh)
   */
  async generateTokenPair(user: IUser, deviceInfo?: DeviceInfo): Promise<TokenPair> {
    const accessToken = this.generateAccessToken(user);
    const refreshTokenString = this.generateRefreshToken();

    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.REFRESH_TOKEN_EXPIRES_DAYS);

    // Store refresh token in database
    const refreshToken = new RefreshToken({
      userId: user._id,
      token: refreshTokenString,
      expiresAt,
      deviceInfo,
    });

    await refreshToken.save();

    return {
      accessToken,
      refreshToken: refreshTokenString,
    };
  }

  /**
   * Verify access token
   */
  verifyAccessToken(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(token, this.ACCESS_TOKEN_SECRET) as TokenPayload;
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AppError("Access token has expired", 401, "ACCESS_TOKEN_EXPIRED");
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AppError("Invalid access token", 401, "INVALID_ACCESS_TOKEN");
      }
      throw new AppError("Token verification failed", 401, "TOKEN_VERIFICATION_FAILED");
    }
  }

  /**
   * Verify refresh token
   */
  async verifyRefreshToken(token: string): Promise<IRefreshToken> {
    const refreshToken = await RefreshToken.findOne({
      token,
      isActive: true,
      expiresAt: { $gt: new Date() },
    }).populate("userId");

    if (!refreshToken) {
      throw new AppError("Invalid or expired refresh token", 401, "INVALID_REFRESH_TOKEN");
    }

    return refreshToken;
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshTokenString: string, deviceInfo?: DeviceInfo): Promise<TokenPair> {
    const refreshToken = await this.verifyRefreshToken(refreshTokenString);
    const user = refreshToken.userId as any; // Populated user

    if (!user || !user.isActive) {
      throw new AppError("User not found or inactive", 401, "USER_INACTIVE");
    }

    // Generate new token pair
    const newTokenPair = await this.generateTokenPair(user, deviceInfo);

    // Invalidate old refresh token
    await RefreshToken.findByIdAndUpdate(refreshToken._id, { isActive: false });

    return newTokenPair;
  }

  /**
   * Revoke refresh token (logout)
   */
  async revokeRefreshToken(token: string): Promise<void> {
    await RefreshToken.findOneAndUpdate(
      { token, isActive: true },
      { isActive: false }
    );
  }

  /**
   * Revoke all refresh tokens for a user (logout from all devices)
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    await RefreshToken.updateMany(
      { userId, isActive: true },
      { isActive: false }
    );
  }

  /**
   * Clean up expired tokens
   */
  async cleanupExpiredTokens(): Promise<void> {
    await RefreshToken.deleteMany({
      $or: [
        { expiresAt: { $lt: new Date() } },
        { isActive: false, updatedAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
      ]
    });
  }

  /**
   * Get active sessions for a user
   */
  async getUserActiveSessions(userId: string): Promise<IRefreshToken[]> {
    return RefreshToken.find({
      userId,
      isActive: true,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });
  }

  /**
   * Revoke specific session
   */
  async revokeSession(userId: string, tokenId: string): Promise<void> {
    await RefreshToken.findOneAndUpdate(
      { _id: tokenId, userId, isActive: true },
      { isActive: false }
    );
  }

  /**
   * Extract device info from request
   */
  extractDeviceInfo(req: any): DeviceInfo {
    return {
      userAgent: req.get("User-Agent"),
      ip: req.ip || req.connection.remoteAddress,
      deviceId: req.get("X-Device-ID"), // Custom header for device identification
    };
  }
}

export default new TokenManager();