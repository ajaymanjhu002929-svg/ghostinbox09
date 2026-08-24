const express = require("express");
const passport = require("../config/passport");
const generateToken = require("../utils/jwt");
const authMiddleware = require("../middleware/authMiddleware");

const {
  getMe,
} = require("../controllers/auth.controller");

const router = express.Router();


// ======================================
// GOOGLE LOGIN
// ======================================

router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);


// ======================================
// GOOGLE CALLBACK
// ======================================

router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: "http://localhost:5173/auth",
  }),
  (req, res) => {

    const token = generateToken(req.user._id);

    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    if (req.user.isProfileComplete) {
      return res.redirect(
        "http://localhost:5173/discover"
      );
    }

    return res.redirect(
      "http://localhost:5173/create-profile"
    );
  }
);


// ======================================
// GET CURRENT LOGGED-IN USER
// ======================================

router.get(
  "/me",
  authMiddleware,
  getMe
);


module.exports = router;