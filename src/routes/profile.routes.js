const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");

const {
  updateProfile,
  updateCategory,
  updateAbout,
  updatePreferences,
  getMyProfile,
  getUserProfile,
} = require("../controllers/profile.controller");

const router = express.Router();


// ==========================================
// 1. BASIC PROFILE
// username + gender
// ==========================================

router.put(
  "/",
  authMiddleware,
  updateProfile
);


// ==========================================
// 2. INTEREST CATEGORY
// loyal / casual
// ==========================================

router.put(
  "/category",
  authMiddleware,
  updateCategory
);


// ==========================================
// 3. ABOUT + INTERESTS
// ==========================================

router.put(
  "/about",
  authMiddleware,
  updateAbout
);


// ==========================================
// 4. FINAL PREFERENCES
// lookingFor + qualities
// profile complete
// ==========================================

router.put(
  "/preferences",
  authMiddleware,
  updatePreferences
);


// ==========================================
// 5. MY PROFILE
// ==========================================

router.get(
  "/me",
  authMiddleware,
  getMyProfile
);


// ==========================================
// 6. OTHER USER PROFILE
// /profile/:id
// ==========================================

router.get(
  "/:id",
  authMiddleware,
  getUserProfile
);


module.exports = router;