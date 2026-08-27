const express = require("express");
const passport = require("../config/passport");

const generateToken =
  require("../utils/jwt");

const authMiddleware =
  require("../middleware/authMiddleware");

const {
  getMe,
  logout,
  deleteAccount,
} = require("../controllers/auth.controller");

const router =
  express.Router();


// ============================================================
// FRONTEND URL
// ============================================================

const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  "https://ghostinbox009.vercel.app";


// ============================================================
// CHECK PRODUCTION / HTTPS
// ============================================================

const isProduction =
  FRONTEND_URL.startsWith("https://");


// ============================================================
// GOOGLE LOGIN
// ============================================================

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


// ============================================================
// GOOGLE CALLBACK
// ============================================================

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

      // ------------------------------------------
      // GENERATE JWT
      // ------------------------------------------

      const token =
        generateToken(
          req.user._id
        );


      // ------------------------------------------
      // SET AUTH COOKIE
      // ------------------------------------------
      //
      // Production:
      // Vercel frontend + Render backend
      //
      // secure: true
      // sameSite: "none"
      //
      // Localhost:
      // secure: false
      // sameSite: "lax"
      // ------------------------------------------

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


      // ------------------------------------------
      // LOG
      // ------------------------------------------

      console.log(
        "Google login successful:",
        req.user._id.toString()
      );

      console.log(
        "Profile complete:",
        req.user.isProfileComplete
      );

      console.log(
        "Auth cookie configured:",
        {
          secure:
            isProduction,

          sameSite:
            isProduction
              ? "none"
              : "lax",
        }
      );


      // ------------------------------------------
      // REDIRECT
      // ------------------------------------------

      if (
        req.user.isProfileComplete
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


// ============================================================
// EXPORT
// ============================================================

module.exports = router;