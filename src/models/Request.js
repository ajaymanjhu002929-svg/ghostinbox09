
const mongoose = require("mongoose");

const requestSchema = new mongoose.Schema(
  {
    // Request bhejne wala user
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Request receive karne wala user
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Request ki current condition
    status: {
      type: String,
      enum: [
        "pending",
        "accepted",
        "rejected",
      ],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);


// ==========================================
// SAME REQUEST DOBARA NA BANNE DO
// ==========================================

requestSchema.index(
  {
    sender: 1,
    receiver: 1,
  },
  {
    unique: true,
  }
);


module.exports = mongoose.model(
  "Request",
  requestSchema
);
