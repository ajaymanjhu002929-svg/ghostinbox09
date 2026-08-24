const express = require("express");
const passport = require("../config/passport");
const generateToken = require("../utils/jwt");
const authMiddleware = require("../middleware/authMiddleware");

const {
  getMe,
} = require("../controllers/auth.controller");

const router = express.Router();

// ==========================================
// FRONTEND URL
// ==========================================

const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  "http://localhost:5173";

// ==========================================
// GOOGLE LOGIN
// ==========================================

router.get(
  "/google",
  passport.authenticate(
    "google",
    {
      scope: [
        "profile",
        "email",
      ],
    }
  )
);

// ==========================================
// GOOGLE CALLBACK
// ==========================================

router.get(
  "/google/callback",
  passport.authenticate(
    "google",
    {
      session: false,

      failureRedirect:
        `${FRONTEND_URL}/auth`,
    }
  ),

  (req, res) => {
    try {
      const token =
        generateToken(
          req.user._id
        );

      const isProduction =
        process.env.NODE_ENV ===
        "production";

      res.cookie(
        "token",
        token,
        {
          httpOnly: true,

          secure:
            isProduction,

          sameSite:
            isProduction
              ? "none"
              : "lax",

          maxAge:
            7 *
            24 *
            60 *
            60 *
            1000,

          path: "/",
        }
      );

      console.log(
        "Google login successful:",
        req.user._id.toString()
      );

      console.log(
        "Profile complete:",
        req.user.isProfileComplete
      );

      // ========================================
      // REDIRECT
      // ========================================

      if (
        req.user
          .isProfileComplete
      ) {
        return res.redirect(
          `${FRONTEND_URL}/discover`
        );
      }

      return res.redirect(
        `${FRONTEND_URL}/create-profile`
      );
    } catch (error) {
      console.error(
        "Google callback error:",
        error
      );

      return res.redirect(
        `${FRONTEND_URL}/auth`
      );
    }
  }
);

// ==========================================
// GET CURRENT USER
// ==========================================

router.get(
  "/me",
  authMiddleware,
  getMe
);

module.exports = router;