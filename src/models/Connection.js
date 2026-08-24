const mongoose = require("mongoose");

const connectionSchema = new mongoose.Schema(
  {
    user1: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    user2: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    status: {
      type: String,
      enum: [
        "pending",
        "active",
        "inactive",
        "rejected",
      ],
      default: "pending",
      index: true,
    },

    removedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    removedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);


// ============================================================
// DUPLICATE CONNECTION PREVENTION
// ============================================================

connectionSchema.index(
  {
    user1: 1,
    user2: 1,
  },
  {
    unique: true,
  }
);


// ============================================================
// VALIDATE DIFFERENT USERS
// ============================================================

connectionSchema.pre("validate", function () {
  if (
    this.user1 &&
    this.user2 &&
    this.user1.toString() === this.user2.toString()
  ) {
    throw new Error(
      "A user cannot connect with themselves"
    );
  }
});


// ============================================================
// IS PARTICIPANT
// ============================================================

connectionSchema.methods.isParticipant = function (userId) {
  if (!userId) {
    return false;
  }

  const id = userId.toString();

  return (
    this.user1.toString() === id ||
    this.user2.toString() === id
  );
};


// ============================================================
// GET OTHER USER
// ============================================================

connectionSchema.methods.getOtherUser = function (userId) {
  if (!userId) {
    return null;
  }

  const id = userId.toString();

  if (this.user1.toString() === id) {
    return this.user2;
  }

  if (this.user2.toString() === id) {
    return this.user1;
  }

  return null;
};


// ============================================================
// CHECK REMOVED BY USER
// ============================================================

connectionSchema.methods.isRemovedBy = function (userId) {
  if (!userId || !this.removedBy) {
    return false;
  }

  const id = userId.toString();

  return this.removedBy.some(
    (removedUserId) =>
      removedUserId.toString() === id
  );
};


// ============================================================
// EXPORT
// ============================================================

module.exports = mongoose.model(
  "Connection",
  connectionSchema
);