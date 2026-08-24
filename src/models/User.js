const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    // ==========================================
    // GOOGLE AUTH
    // ==========================================

    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },

    // ==========================================
    // EMAIL
    // ==========================================

    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },

    // ==========================================
    // PHONE
    // ==========================================

    phone: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },

    // ==========================================
    // BASIC PROFILE
    // ==========================================

    username: {
      type: String,
      unique: true,
      required: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 30,
    },

    photo: {
      type: String,
      default: "",
    },

    gender: {
      type: String,
      enum: ["male", "female", ""],
      default: "",
    },

    // ==========================================
    // CATEGORY
    // ==========================================

    category: {
      type: String,
      enum: ["loyal", "casual", ""],
      default: "",
    },

    // ==========================================
    // ABOUT
    // ==========================================

    about: {
      type: String,
      default: "",
      maxlength: 300,
    },

    // ==========================================
    // INTERESTS
    // ==========================================

    interests: {
      type: [String],
      default: [],
    },

    // ==========================================
    // LOOKING FOR
    // ==========================================

    lookingFor: {
      type: String,
      enum: ["male", "female", ""],
      default: "",
    },

    // ==========================================
    // QUALITIES
    // ==========================================

    qualities: {
      type: [String],
      default: [],
    },

    // ==========================================
    // PROFILE STATUS
    // ==========================================

    isProfileComplete: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);


// ==========================================
// USERNAME INDEX
// ==========================================
//
// Same username dobara create nahi hoga.
// Example:
//
// ajay  -> allowed
// ajay  -> NOT allowed
//
// lowercase ki wajah se:
//
// Ajay
// ajay
// AJAY
//
// teeno same username maane jayenge.
// ==========================================

userSchema.index(
  {
    username: 1,
  },
  {
    unique: true,
  }
);


module.exports = mongoose.model(
  "User",
  userSchema
);