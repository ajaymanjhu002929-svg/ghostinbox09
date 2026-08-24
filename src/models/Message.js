const mongoose = require("mongoose");


// ============================================================
// MESSAGE SCHEMA
// ============================================================

const messageSchema = new mongoose.Schema(
  {
    connection: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Connection",
      required: true,
      index: true,
    },

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },

    readAt: {
      type: Date,
      default: null,
    },

    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },

    isFlagged: {
      type: Boolean,
      default: false,
      index: true,
    },

    isSavedAsEvidence: {
      type: Boolean,
      default: false,
      index: true,
    },

    evidenceSavedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);


// ============================================================
// VALIDATE SENDER / RECEIVER
// ============================================================

messageSchema.pre("validate", function () {
  if (
    this.sender &&
    this.receiver &&
    this.sender.toString() ===
      this.receiver.toString()
  ) {
    throw new Error(
      "Sender and receiver cannot be the same user"
    );
  }
});


// ============================================================
// AUTOMATIC EVIDENCE TIMESTAMP
// ============================================================

messageSchema.pre("save", function () {
  if (
    this.isSavedAsEvidence &&
    !this.evidenceSavedAt
  ) {
    this.evidenceSavedAt = new Date();
  }
});


// ============================================================
// EVIDENCE NEVER EXPIRES
// ============================================================

messageSchema.pre("save", function () {
  if (this.isSavedAsEvidence) {
    this.expiresAt = null;
  }
});


// ============================================================
// IS PARTICIPANT
// ============================================================

messageSchema.methods.isParticipant = function (userId) {
  if (!userId) {
    return false;
  }

  const id = userId.toString();

  return (
    this.sender.toString() === id ||
    this.receiver.toString() === id
  );
};


// ============================================================
// IS EVIDENCE
// ============================================================

messageSchema.methods.isEvidence = function () {
  return this.isSavedAsEvidence === true;
};


// ============================================================
// INDEXES
// ============================================================

messageSchema.index({
  connection: 1,
  createdAt: 1,
});

messageSchema.index({
  connection: 1,
  isSavedAsEvidence: 1,
});


// ============================================================
// EXPORT
// ============================================================

module.exports = mongoose.model(
  "Message",
  messageSchema
);