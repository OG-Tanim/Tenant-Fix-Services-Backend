import { Router } from "express";
import authController from "./auth.controller";
import { validateRequest } from "../../middleware/validation";
import {
  authenticate,
  authorize,
  ensureSelfAccess,
} from "../../middleware/auth.middleware";
import {
  registrationSchema,
  loginSchema,
  changePasswordSchema,
  updateTenantProfileSchema,
  updateManagerProfileSchema,
  updateContractorProfileSchema,
} from "./auth.validation";

const router = Router();

// Public routes
router.post(
  "/register",
  validateRequest(registrationSchema),
  authController.register
);
router.post("/login", validateRequest(loginSchema), authController.login);
router.post("/refresh-token", authController.refreshToken);

// Semi-protected routes (can work without authentication but better with it)
router.post("/logout", authController.logout);

// Protected routes - require authentication
router.use(authenticate); // All routes below require authentication

// Profile routes
router.get("/profile", authController.getProfile);
router.patch(
  "/profile",
  (req, res, next) => {
    // Dynamic validation based on user role
    const user = req.user;
    if (!user) {
      return next();
    }

    let schema;
    switch (user.role) {
      case "tenant":
        schema = updateTenantProfileSchema;
        break;
      case "manager":
        schema = updateManagerProfileSchema;
        break;
      case "contractor":
        schema = updateContractorProfileSchema;
        break;
      default:
        return res.status(400).json({ error: "Invalid user role" });
    }

    validateRequest(schema)(req, res, next);
  },
  authController.updateProfile
);

// Password management
router.patch(
  "/change-password",
  validateRequest(changePasswordSchema),
  authController.changePassword
);

// Account management
router.delete("/deactivate", authController.deactivateAccount);
router.post("/logout-all", authController.logoutFromAllDevices);

// Search and listing routes
router.get("/contractors/search", authController.searchContractors);

// Admin routes - require specific roles
router.get("/users/:role", authorize("manager"), authController.getUsersByRole);
router.get("/stats", authorize("manager"), authController.getUserStats);

export default router;
