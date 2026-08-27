const express = require("express");
const passport = require("../config/passport");

const generateToken = require("../utils/jwt");
const authMiddleware = require("../middleware/authMiddleware");

const {
  getMe,
  logout,
  deleteAccount,
} = require("../controllers/auth.controller");

const router = express.Router();

const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  "https://ghostinbox009.vercel.app";

const getCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite:
    process.env.NODE_ENV === "production"
      ? "none"
      : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
});



// ============================================================
// GOOGLE LOGIN
// ============================================================

router.get(
  "/google",
  passport.authenticate("google", {
    scope: [
      "profile",
      "email",
    ],
  })
);


// ============================================================
// GOOGLE CALLBACK
// ============================================================

router.get(
  "/google/callback",

  passport.authenticate("google", {
    session: false,

    failureRedirect:
      `${FRONTEND_URL}/auth`,
  }),

  (req, res) => {

    try {

      // ------------------------------------------
      // GENERATE JWT
      // ------------------------------------------

      const token =
        generateToken(req.user._id);


      console.log(
        "Google login successful:",
        req.user._id.toString()
      );

      console.log(
        "Profile complete:",
        req.user.isProfileComplete
      );

      // ------------------------------------------
      // SET AUTH COOKIE
      // ------------------------------------------
      // The frontend also receives the JWT in the
      // redirect URL for localStorage fallback, but
      // the server must establish the authenticated
      // cookie here so all protected fetch() calls
      // work for a brand-new browser/device too.
      res.cookie(
        "token",
        token,
        getCookieOptions()
      );

      // ------------------------------------------
      // SEND TOKEN TO FRONTEND
      // ------------------------------------------

      if (req.user.isProfileComplete) {

        return res.redirect(
          `${FRONTEND_URL}/auth-callback?token=${encodeURIComponent(token)}&redirect=discover`
        );
      }


      return res.redirect(
        `${FRONTEND_URL}/auth-callback?token=${encodeURIComponent(token)}&redirect=create-profile`
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


// ============================================================
// LOGOUT
// ============================================================

router.post(
  "/logout",
  authMiddleware,
  logout
);


// ============================================================
// DELETE ACCOUNT
// ============================================================

router.delete(
  "/delete-account",
  authMiddleware,
  deleteAccount
);


// ============================================================
// GET CURRENT USER
// ============================================================

router.get(
  "/me",
  authMiddleware,
  getMe
);


module.exports = router;