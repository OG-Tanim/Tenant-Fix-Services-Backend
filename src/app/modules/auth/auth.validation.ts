import { z } from "zod";

// Base user validation schema
const baseUserSchema = {
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name cannot exceed 100 characters")
    .trim(),
  phone: z
    .string()
    .min(1, "Phone number is required")
    .regex(/^\+?[\d\s\-\(\)]+$/, "Please provide a valid phone number"),
  email: z.string().email("Please provide a valid email address").toLowerCase(),
  image: z.string().url("Please provide a valid image URL").optional(),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters long")
    .max(128, "Password cannot exceed 128 characters"),
};

// Tenant registration validation
export const tenantRegistrationSchema = z.object({
  role: z.literal("tenant"),
  ...baseUserSchema,
  unitNumber: z.string().min(1, "Unit number is required").trim(),
  propertyName: z.string().min(1, "Property name is required").trim(),
  zipCode: z
    .string()
    .regex(/^\d{5}(-\d{4})?$/, "Please provide a valid zip code"),
  landlordPhone: z
    .string()
    .min(1, "Landlord phone is required")
    .regex(
      /^\+?[\d\s\-\(\)]+$/,
      "Please provide a valid landlord phone number"
    ),
});

// Manager registration validation
export const managerRegistrationSchema = z.object({
  role: z.literal("manager"),
  ...baseUserSchema,
  propertyName: z.string().min(1, "Property name is required").trim(),
  streetAddress: z.string().min(1, "Street address is required").trim(),
  city: z.string().min(1, "City is required").trim(),
  state: z.string().length(2, "State should be 2 characters").toUpperCase(),
  zipCode: z
    .string()
    .regex(/^\d{5}(-\d{4})?$/, "Please provide a valid zip code"),
});

// Contractor registration validation
export const contractorRegistrationSchema = z.object({
  role: z.literal("contractor"),
  ...baseUserSchema,
  tradeType: z.enum([
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
    ], {
      message: "Please select a valid trade type",
    }),
  zipCode: z
    .string()
    .regex(/^\d{5}(-\d{4})?$/, "Please provide a valid zip code"),
  distance: z
    .number()
    .min(1, "Distance must be at least 1 mile")
    .max(100, "Distance cannot exceed 100 miles"),
});

// Combined registration schema
export const registrationSchema = z.discriminatedUnion("role", [
  tenantRegistrationSchema,
  managerRegistrationSchema,
  contractorRegistrationSchema,
]);

// Login validation
export const loginSchema = z.object({
  email: z.string().email("Please provide a valid email address").toLowerCase(),
  password: z.string().min(1, "Password is required"),
});

// Password reset request validation
export const passwordResetRequestSchema = z.object({
  email: z.string().email("Please provide a valid email address").toLowerCase(),
});

// Password reset validation
export const passwordResetSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters long")
    .max(128, "Password cannot exceed 128 characters"),
});

// Change password validation
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(6, "New password must be at least 6 characters long")
    .max(128, "New password cannot exceed 128 characters"),
});

// Refresh token validation
export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

// Update profile validation schemas
export const updateTenantProfileSchema = z.object({
  name: z.string().min(1, "Name is required").max(100).trim().optional(),
  phone: z
    .string()
    .regex(/^\+?[\d\s\-\(\)]+$/, "Please provide a valid phone number")
    .optional(),
  image: z.string().url("Please provide a valid image URL").optional(),
  unitNumber: z.string().min(1, "Unit number is required").trim().optional(),
  propertyName: z
    .string()
    .min(1, "Property name is required")
    .trim()
    .optional(),
  zipCode: z
    .string()
    .regex(/^\d{5}(-\d{4})?$/, "Please provide a valid zip code")
    .optional(),
  landlordPhone: z
    .string()
    .regex(/^\+?[\d\s\-\(\)]+$/, "Please provide a valid landlord phone number")
    .optional(),
});

export const updateManagerProfileSchema = z.object({
  name: z.string().min(1, "Name is required").max(100).trim().optional(),
  phone: z
    .string()
    .regex(/^\+?[\d\s\-\(\)]+$/, "Please provide a valid phone number")
    .optional(),
  image: z.string().url("Please provide a valid image URL").optional(),
  propertyName: z
    .string()
    .min(1, "Property name is required")
    .trim()
    .optional(),
  streetAddress: z
    .string()
    .min(1, "Street address is required")
    .trim()
    .optional(),
  city: z.string().min(1, "City is required").trim().optional(),
  state: z
    .string()
    .length(2, "State should be 2 characters")
    .toUpperCase()
    .optional(),
  zipCode: z
    .string()
    .regex(/^\d{5}(-\d{4})?$/, "Please provide a valid zip code")
    .optional(),
});

export const updateContractorProfileSchema = z.object({
  name: z.string().min(1, "Name is required").max(100).trim().optional(),
  phone: z
    .string()
    .regex(/^\+?[\d\s\-\(\)]+$/, "Please provide a valid phone number")
    .optional(),
  image: z.string().url("Please provide a valid image URL").optional(),
  tradeType: z
    .enum([
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
    ])
    .optional(),
  zipCode: z
    .string()
    .regex(/^\d{5}(-\d{4})?$/, "Please provide a valid zip code")
    .optional(),
  distance: z
    .number()
    .min(1, "Distance must be at least 1 mile")
    .max(100, "Distance cannot exceed 100 miles")
    .optional(),
});

// Type exports
export type TenantRegistrationInput = z.infer<typeof tenantRegistrationSchema>;
export type ManagerRegistrationInput = z.infer<
  typeof managerRegistrationSchema
>;
export type ContractorRegistrationInput = z.infer<
  typeof contractorRegistrationSchema
>;
export type RegistrationInput = z.infer<typeof registrationSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type PasswordResetRequestInput = z.infer<
  typeof passwordResetRequestSchema
>;
export type PasswordResetInput = z.infer<typeof passwordResetSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
