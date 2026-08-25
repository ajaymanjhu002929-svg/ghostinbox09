const User = require("../models/User");
const Request = require("../models/Request");
const Connection = require("../models/Connection");
const Message = require("../models/Message");
const Evidence = require("../models/Evidence");

const generateToken = require("../utils/jwt");


// ============================================================
// COOKIE OPTIONS
// ============================================================

const getCookieOptions = () => {
  const isProduction =
    process.env.NODE_ENV === "production";

  return {
    httpOnly: true,

    secure: isProduction,

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
  };
};


// ============================================================
// REGISTER
// ============================================================

const register = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    // ------------------------------------------
    // CHECK EXISTING USER
    // ------------------------------------------

    const existingUser =
      await User.findOne({ phone });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User already exists",
      });
    }

    // ------------------------------------------
    // CREATE USER
    // ------------------------------------------
    //
    // NOTE:
    // Current Google flow creates username first.
    // Phone registration flow should provide username
    // before using this endpoint.
    //
    // This keeps the existing endpoint behaviour
    // without changing the rest of the project.
    // ------------------------------------------

    const user = await User.create({
      phone,
    });

    // ------------------------------------------
    // GENERATE JWT
    // ------------------------------------------

    const token =
      generateToken(user._id);

    // ------------------------------------------
    // STORE TOKEN IN COOKIE
    // ------------------------------------------

    res.cookie(
      "token",
      token,
      getCookieOptions()
    );

    return res.status(201).json({
      success: true,
      message:
        "User registered successfully",
      user,
    });

  } catch (error) {

    console.error(
      "Register error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Registration failed",
    });
  }
};


// ============================================================
// LOGIN
// ============================================================

const login = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message:
          "Phone number is required",
      });
    }

    // ------------------------------------------
    // FIND USER
    // ------------------------------------------

    const user =
      await User.findOne({ phone });

    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          "User not found",
      });
    }

    // ------------------------------------------
    // GENERATE TOKEN
    // ------------------------------------------

    const token =
      generateToken(user._id);

    // ------------------------------------------
    // STORE COOKIE
    // ------------------------------------------

    res.cookie(
      "token",
      token,
      getCookieOptions()
    );

    return res.status(200).json({
      success: true,
      message:
        "Login successful",
      user,
    });

  } catch (error) {

    console.error(
      "Login error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Login failed",
    });
  }
};


// ============================================================
// LOGOUT
// ============================================================

const logout = async (req, res) => {
  try {

    // ------------------------------------------
    // IF USER IS AUTHENTICATED
    // MARK OFFLINE
    // ------------------------------------------

    if (req.userId) {
      await User.findByIdAndUpdate(
        req.userId,
        {
          isOnline: false,
          lastSeen: new Date(),
        }
      );
    }

    // ------------------------------------------
    // CLEAR COOKIE
    // ------------------------------------------

    res.clearCookie(
      "token",
      {
        httpOnly: true,

        secure:
          process.env.NODE_ENV ===
          "production",

        sameSite:
          process.env.NODE_ENV ===
          "production"
            ? "none"
            : "lax",

        path: "/",
      }
    );

    return res.status(200).json({
      success: true,
      message:
        "Logout successful",
    });

  } catch (error) {

    console.error(
      "Logout error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Logout failed",
    });
  }
};


// ============================================================
// DELETE ACCOUNT
// ============================================================
//
// DELETE /api/auth/delete-account
//
// User ki:
// - requests
// - connections
// - messages
// - evidence
// - profile/user
//
// sab permanently remove honge.
//
// Transaction use kiya gaya hai taaki beech me error aaye
// to half-deleted account na bane.
// ============================================================

const deleteAccount = async (
  req,
  res
) => {

  const session =
    await User.startSession();

  try {

    const userId =
      req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required",
      });
    }

    // ------------------------------------------
    // CHECK USER
    // ------------------------------------------

    const user =
      await User.findById(userId)
        .session(session);

    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          "User not found",
      });
    }

    // ------------------------------------------
    // START TRANSACTION
    // ------------------------------------------

    await session.withTransaction(
      async () => {

        // ======================================
        // 1. DELETE EVIDENCE
        // ======================================

        await Evidence.deleteMany(
          {
            $or: [
              {
                savedBy: userId,
              },
              {
                reportedUser: userId,
              },
              {
                "messages.sender":
                  userId,
              },
              {
                "messages.receiver":
                  userId,
              },
            ],
          },
          {
            session,
          }
        );

        // ======================================
        // 2. DELETE MESSAGES
        // ======================================

        await Message.deleteMany(
          {
            $or: [
              {
                sender: userId,
              },
              {
                receiver: userId,
              },
            ],
          },
          {
            session,
          }
        );

        // ======================================
        // 3. DELETE REQUESTS
        // ======================================

        await Request.deleteMany(
          {
            $or: [
              {
                sender: userId,
              },
              {
                receiver: userId,
              },
            ],
          },
          {
            session,
          }
        );

        // ======================================
        // 4. DELETE CONNECTIONS
        // ======================================

        await Connection.deleteMany(
          {
            $or: [
              {
                user1: userId,
              },
              {
                user2: userId,
              },
            ],
          },
          {
            session,
          }
        );

        // ======================================
        // 5. DELETE USER
        // ======================================

        await User.deleteOne(
          {
            _id: userId,
          },
          {
            session,
          }
        );
      }
    );

    // ------------------------------------------
    // CLEAR AUTH COOKIE
    // ------------------------------------------

    res.clearCookie(
      "token",
      {
        httpOnly: true,

        secure:
          process.env.NODE_ENV ===
          "production",

        sameSite:
          process.env.NODE_ENV ===
          "production"
            ? "none"
            : "lax",

        path: "/",
      }
    );

    return res.status(200).json({
      success: true,
      message:
        "Account deleted successfully",
    });

  } catch (error) {

    console.error(
      "Delete account error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Account deletion failed",
    });

  } finally {

    await session.endSession();
  }
};


// ============================================================
// GET CURRENT USER
// ============================================================

const getMe = async (
  req,
  res
) => {

  try {

    const user =
      await User.findById(
        req.userId
      ).select("-__v");

    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });

  } catch (error) {

    console.error(
      "Get me error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to get user",
    });
  }
};


// ============================================================
// EXPORT
// ============================================================

module.exports = {
  register,
  login,
  logout,
  deleteAccount,
  getMe,
};