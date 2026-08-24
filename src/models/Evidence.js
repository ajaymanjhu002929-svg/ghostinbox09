const mongoose =
  require("mongoose");

// ============================================================
// EVIDENCE MESSAGE
// ============================================================

const evidenceMessageSchema =
  new mongoose.Schema(
    {
      messageId: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          "Message",

        required:
          true,
      },

      sender: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          "User",

        required:
          true,
      },

      receiver: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          "User",

        required:
          true,
      },

      text: {
        type:
          String,

        required:
          true,

        trim:
          true,
      },

      createdAt: {
        type:
          Date,

        required:
          true,
      },
    },

    {
      _id:
        false,
    }
  );

// ============================================================
// EVIDENCE
// ============================================================

const evidenceSchema =
  new mongoose.Schema(
    {
      connection: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          "Connection",

        required:
          true,

        index:
          true,
      },

      savedBy: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          "User",

        required:
          true,

        index:
          true,
      },

      reportedUser: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          "User",

        required:
          true,
      },

      messages: {
        type:
          [evidenceMessageSchema],

        default:
          [],
      },

      category: {
        type:
          String,

        default:
          "harmful_content",
      },

      reason: {
        type:
          String,

        default:
          "",

        trim:
          true,

        maxlength:
          500,
      },

      status: {
        type:
          String,

        enum: [
          "saved",
          "reported",
        ],

        default:
          "saved",

        index:
          true,
      },

      reportedAt: {
        type:
          Date,

        default:
          null,
      },
    },

    {
      timestamps:
        true,
    }
  );

// ============================================================
// EXPORT
// ============================================================

module.exports =
  mongoose.model(
    "Evidence",
    evidenceSchema
  );