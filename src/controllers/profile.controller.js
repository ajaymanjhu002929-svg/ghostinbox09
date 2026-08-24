const User = require("../models/User");


// ==========================================
// UPDATE BASIC PROFILE
// username + gender
// ==========================================

const updateProfile = async (req, res) => {
  try {
    const { username, gender } = req.body;

    if (!username || !gender) {
      return res.status(400).json({
        success: false,
        message: "Username and gender are required",
      });
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      {
        username: username.trim(),
        gender,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user,
    });

  } catch (error) {
    console.error("Update profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update profile",
    });
  }
};



// ==========================================
// UPDATE INTEREST CATEGORY
// loyal / casual
// ==========================================

const updateCategory = async (req, res) => {
  try {
    const { category } = req.body;

    if (!category) {
      return res.status(400).json({
        success: false,
        message: "Category is required",
      });
    }

    if (!["loyal", "casual"].includes(category)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category",
      });
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      {
        category,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Category updated successfully",
      user,
    });

  } catch (error) {
    console.error("Update category error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update category",
    });
  }
};



// ==========================================
// UPDATE ABOUT + INTERESTS
// ==========================================

const updateAbout = async (req, res) => {
  try {
    const { about, interests } = req.body;

    if (!about || !about.trim()) {
      return res.status(400).json({
        success: false,
        message: "About is required",
      });
    }

    if (
      !Array.isArray(interests) ||
      interests.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "At least one interest is required",
      });
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      {
        about: about.trim(),
        interests,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "About information updated successfully",
      user,
    });

  } catch (error) {
    console.error("Update about error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update about information",
    });
  }
};



// ==========================================
// UPDATE PREFERENCES
// lookingFor + qualities
// ==========================================

const updatePreferences = async (req, res) => {
  try {
    const { lookingFor, qualities } = req.body;

    if (!lookingFor) {
      return res.status(400).json({
        success: false,
        message: "Looking for is required",
      });
    }

    if (
      !Array.isArray(qualities) ||
      qualities.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "At least one quality is required",
      });
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      {
        lookingFor,
        qualities,
        isProfileComplete: true,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile completed successfully",
      user,
    });

  } catch (error) {
    console.error("Update preferences error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update preferences",
    });
  }
};

// ==========================================
// GET MY PROFILE
// ==========================================

const getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-__v");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });

  } catch (error) {
    console.error("Get my profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch profile",
    });
  }
};
// ==========================================
// GET OTHER USER PROFILE
// /profile/:id
// ==========================================

const getUserProfile = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select(
      "_id username photo gender category about interests lookingFor qualities"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });

  } catch (error) {
    console.error("Get user profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch user profile",
    });
  }
};
module.exports = {
  updateProfile,
  updateCategory,
  updateAbout,
  updatePreferences,
  getMyProfile,
  getUserProfile,
};