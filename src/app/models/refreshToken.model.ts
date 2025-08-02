import mongoose, { Schema, Document } from "mongoose";

export interface IRefreshToken extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  token: string;
  expiresAt: Date;
  isActive: boolean;
  deviceInfo?: {
    userAgent?: string;
    ip?: string;
    deviceId?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const refreshTokenSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },
    token: {
      type: String,
      required: [true, "Refresh token is required"],
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: [true, "Expiration date is required"],
      index: { expireAfterSeconds: 0 }, // MongoDB TTL index
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    deviceInfo: {
      userAgent: {
        type: String,
        trim: true,
      },
      ip: {
        type: String,
        trim: true,
      },
      deviceId: {
        type: String,
        trim: true,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for better query performance
refreshTokenSchema.index({ userId: 1, isActive: 1 });
refreshTokenSchema.index({ token: 1, isActive: 1 });

// Clean up expired tokens periodically
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = mongoose.model<IRefreshToken>(
  "RefreshToken",
  refreshTokenSchema
);

export default RefreshToken;