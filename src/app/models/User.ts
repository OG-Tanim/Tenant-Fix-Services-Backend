import mongoose, { Schema, Document } from "mongoose";

// Base user interface
export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  role: "tenant" | "manager" | "contractor";
  name: string;
  phone: string;
  email: string;
  image?: string;
  password: string;
  isActive: boolean;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Tenant specific interface
export interface ITenant extends IUser {
  role: "tenant";
  unitNumber: string;
  propertyName: string;
  zipCode: string;
  landlordPhone: string;
}

// Manager specific interface
export interface IManager extends IUser {
  role: "manager";
  propertyName: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
}

// Contractor specific interface
export interface IContractor extends IUser {
  role: "contractor";
  tradeType:
    | "General Handyman"
    | "Plumbing"
    | "Electrical"
    | "HVAC"
    | "Appliance Repair"
    | "Carpentry"
    | "Window & Door"
    | "Roofing & Gutters"
    | "Cleaning"
    | "Junk Removal"
    | "Other";
  zipCode: string;
  distance: number; // area of coverage in miles
}

// User schema with discriminator
export const userSchema = new Schema(
  {
    role: {
      type: String,
      enum: ["tenant", "manager", "contractor"],
      required: [true, "Role is required"],
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
      match: [/^\+?[\d\s\-\(\)]+$/, "Please provide a valid phone number"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please provide a valid email",
      ],
    },
    image: {
      type: String,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters long"],
      select: false, // Don't include password in queries by default
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    discriminatorKey: "role",
  }
);

// Create indexes
// userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ role: 1 });

// Create base User model
export const User = mongoose.model<IUser>("User", userSchema);

// Tenant discriminator schema
export const tenantSchema = new Schema({
  unitNumber: {
    type: String,
    required: [true, "Unit number is required"],
    trim: true,
  },
  propertyName: {
    type: String,
    required: [true, "Property name is required"],
    trim: true,
  },
  zipCode: {
    type: String,
    required: [true, "Zip code is required"],
    trim: true,
    match: [/^\d{5}(-\d{4})?$/, "Please provide a valid zip code"],
  },
  landlordPhone: {
    type: String,
    required: [true, "Landlord phone is required"],
    trim: true,
    match: [
      /^\+?[\d\s\-\(\)]+$/,
      "Please provide a valid landlord phone number",
    ],
  },
});

// Manager discriminator schema
export const managerSchema = new Schema({
  propertyName: {
    type: String,
    required: [true, "Property name is required"],
    trim: true,
  },
  streetAddress: {
    type: String,
    required: [true, "Street address is required"],
    trim: true,
  },
  city: {
    type: String,
    required: [true, "City is required"],
    trim: true,
  },
  state: {
    type: String,
    required: [true, "State is required"],
    trim: true,
    maxlength: [2, "State should be 2 characters"],
  },
  zipCode: {
    type: String,
    required: [true, "Zip code is required"],
    trim: true,
    match: [/^\d{5}(-\d{4})?$/, "Please provide a valid zip code"],
  },
});

// Contractor discriminator schema
export const contractorSchema = new Schema({
  tradeType: {
    type: String,
    enum: [
      "General Handyman",
      "Plumbing",
      "Electrical",
      "HVAC",
      "Appliance Repair",
      "Carpentry",
      "Window & Door",
      "Roofing & Gutters",
      "Cleaning",
      "Junk Removal",
      "Other",
    ],
    required: [true, "Trade type is required"],
  },
  zipCode: {
    type: String,
    required: [true, "Zip code is required"],
    trim: true,
    match: [/^\d{5}(-\d{4})?$/, "Please provide a valid zip code"],
  },
  distance: {
    type: Number,
    required: [true, "Coverage distance is required"],
    min: [1, "Distance must be at least 1 mile"],
    max: [100, "Distance cannot exceed 100 miles"],
  },
});

// Create discriminator models
export const Tenant = User.discriminator<ITenant>("tenant", tenantSchema);
export const Manager = User.discriminator<IManager>("manager", managerSchema);
export const Contractor = User.discriminator<IContractor>(
  "contractor",
  contractorSchema
);

export default User;
