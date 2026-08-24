const Evidence =
  require("../models/Evidence");

const Message =
  require("../models/Message");

const Connection =
  require("../models/Connection");

// ============================================================
// USER ID
// ============================================================

const getUserId = (req) => {
  return (
    req.userId ||
    req.user?.id ||
    req.user?._id ||
    null
  );
};

// ============================================================
// GET CONNECTION
// ============================================================

const getConnectionForUser =
  async (
    connectionId,
    userId
  ) => {

    return Connection.findOne({
      _id:
        connectionId,

      $or: [
        {
          user1:
            userId,
        },
        {
          user2:
            userId,
        },
      ],
    });
  };

// ============================================================
// BUILD MESSAGE SNAPSHOT
// ============================================================

const buildEvidenceMessages =
  (messages) => {

    return messages.map(
      (message) => ({
        messageId:
          message._id,

        sender:
          message.sender,

        receiver:
          message.receiver,

        text:
          message.text,

        createdAt:
          message.createdAt,
      })
    );
  };

// ============================================================
// SAVE EVIDENCE
// ============================================================

const saveEvidence =
  async (
    req,
    res
  ) => {

    try {

      const userId =
        getUserId(req);

      const {
        connectionId,
        messageIds = [],
        category,
      } =
        req.body || {};

      if (!userId) {
        return res.status(401).json({
          success: false,
          message:
            "Authentication required",
        });
      }

      if (!connectionId) {
        return res.status(400).json({
          success: false,
          message:
            "Connection ID is required",
        });
      }

      const connection =
        await getConnectionForUser(
          connectionId,
          userId
        );

      if (!connection) {
        return res.status(404).json({
          success: false,
          message:
            "Connection not found",
        });
      }

      let ids =
        Array.isArray(messageIds)
          ? messageIds.filter(Boolean)
          : [];

      // ------------------------------------------
      // AUTOMATIC HARMFUL MESSAGES
      // ------------------------------------------

      if (!ids.length) {

        const harmfulMessages =
          await Message.find({
            connection:
              connectionId,

            isFlagged:
              true,
          }).sort({
            createdAt:
              1,
          });

        ids =
          harmfulMessages.map(
            (message) =>
              message._id
          );
      }

      if (!ids.length) {
        return res.status(400).json({
          success: false,
          message:
            "No messages available to save as evidence",
        });
      }

      const messages =
        await Message.find({
          _id: {
            $in:
              ids,
          },

          connection:
            connectionId,
        }).sort({
          createdAt:
            1,
        });

      if (!messages.length) {
        return res.status(404).json({
          success: false,
          message:
            "Messages not found",
        });
      }

      // ------------------------------------------
      // EXISTING EVIDENCE
      // ------------------------------------------

      let evidence =
        await Evidence.findOne({
          connection:
            connectionId,

          savedBy:
            userId,

          status: {
            $in: [
              "saved",
              "reported",
            ],
          },
        });

      const reportedUser =
        connection.user1.toString() ===
        userId.toString()
          ? connection.user2
          : connection.user1;

      // ------------------------------------------
      // CREATE OR UPDATE
      // ------------------------------------------

      if (!evidence) {

        evidence =
          await Evidence.create({

            connection:
              connectionId,

            savedBy:
              userId,

            reportedUser,

            messages:
              buildEvidenceMessages(
                messages
              ),

            category:
              category ||
              "harmful_content",

            status:
              "saved",

            reason:
              "",

            reportedAt:
              null,
          });

      } else {

        const existingIds =
          new Set(
            evidence.messages.map(
              (item) =>
                item.messageId.toString()
            )
          );

        for (
          const message of messages
        ) {

          if (
            !existingIds.has(
              message._id.toString()
            )
          ) {

            evidence.messages.push({
              messageId:
                message._id,

              sender:
                message.sender,

              receiver:
                message.receiver,

              text:
                message.text,

              createdAt:
                message.createdAt,
            });
          }
        }

        if (category) {
          evidence.category =
            category;
        }

        await evidence.save();
      }

      // ------------------------------------------
      // MARK MESSAGES
      // ------------------------------------------

      await Message.updateMany(
        {
          _id: {
            $in:
              messages.map(
                (message) =>
                  message._id
              ),
          },

          connection:
            connectionId,
        },

        {
          $set: {
            isSavedAsEvidence:
              true,

            evidenceSavedAt:
              new Date(),

            expiresAt:
              null,
          },
        }
      );

      return res.status(200).json({
        success: true,

        message:
          "Conversation saved as evidence",

        evidence,
      });

    } catch (error) {

      console.error(
        "Save evidence error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to save evidence",
      });
    }
  };

// ============================================================
// GET MY EVIDENCE
// ============================================================

const getMyEvidence =
  async (
    req,
    res
  ) => {

    try {

      const userId =
        getUserId(req);

      if (!userId) {
        return res.status(401).json({
          success: false,
          message:
            "Authentication required",
        });
      }

      const evidences =
        await Evidence.find({
          savedBy:
            userId,
        })
          .populate(
            "savedBy",
            "username photo"
          )
          .populate(
            "reportedUser",
            "username photo"
          )
          .populate(
            "connection"
          )
          .sort({
            createdAt:
              -1,
          });

      return res.status(200).json({
        success: true,
        evidences,
      });

    } catch (error) {

      console.error(
        "Get evidence error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to load evidence",
      });
    }
  };

// ============================================================
// REPORT EVIDENCE
// ============================================================

const reportEvidence =
  async (
    req,
    res
  ) => {

    try {

      const userId =
        getUserId(req);

      const {
        connectionId,
        messageIds = [],
        category,
        reason = "",
      } =
        req.body || {};

      if (!userId) {
        return res.status(401).json({
          success: false,
          message:
            "Authentication required",
        });
      }

      if (!connectionId) {
        return res.status(400).json({
          success: false,
          message:
            "Connection ID is required",
        });
      }

      const connection =
        await getConnectionForUser(
          connectionId,
          userId
        );

      if (!connection) {
        return res.status(404).json({
          success: false,
          message:
            "Connection not found",
        });
      }

      let ids =
        Array.isArray(messageIds)
          ? messageIds.filter(Boolean)
          : [];

      if (!ids.length) {

        const harmfulMessages =
          await Message.find({
            connection:
              connectionId,

            isFlagged:
              true,
          }).sort({
            createdAt:
              1,
          });

        ids =
          harmfulMessages.map(
            (message) =>
              message._id
          );
      }

      const messages =
        await Message.find({
          _id: {
            $in:
              ids,
          },

          connection:
            connectionId,
        }).sort({
          createdAt:
            1,
        });

      if (!messages.length) {
        return res.status(404).json({
          success: false,
          message:
            "No messages found for report",
        });
      }

      const reportedUser =
        connection.user1.toString() ===
        userId.toString()
          ? connection.user2
          : connection.user1;

      // ------------------------------------------
      // FIND EXISTING
      // ------------------------------------------

      let evidence =
        await Evidence.findOne({
          connection:
            connectionId,

          savedBy:
            userId,
        });

      if (evidence) {

        const existingIds =
          new Set(
            evidence.messages.map(
              (item) =>
                item.messageId.toString()
            )
          );

        for (
          const message of messages
        ) {

          if (
            !existingIds.has(
              message._id.toString()
            )
          ) {

            evidence.messages.push({
              messageId:
                message._id,

              sender:
                message.sender,

              receiver:
                message.receiver,

              text:
                message.text,

              createdAt:
                message.createdAt,
            });
          }
        }

        evidence.reportedUser =
          reportedUser;

        evidence.category =
          category ||
          evidence.category ||
          "harmful_content";

        evidence.reason =
          reason ||
          evidence.reason ||
          "";

        evidence.status =
          "reported";

        evidence.reportedAt =
          new Date();

        await evidence.save();

      } else {

        evidence =
          await Evidence.create({

            connection:
              connectionId,

            savedBy:
              userId,

            reportedUser,

            messages:
              buildEvidenceMessages(
                messages
              ),

            category:
              category ||
              "harmful_content",

            reason,

            status:
              "reported",

            reportedAt:
              new Date(),
          });
      }

      await Message.updateMany(
        {
          _id: {
            $in:
              messages.map(
                (message) =>
                  message._id
              ),
          },

          connection:
            connectionId,
        },

        {
          $set: {
            isSavedAsEvidence:
              true,

            evidenceSavedAt:
              new Date(),

            expiresAt:
              null,
          },
        }
      );

      return res.status(200).json({
        success: true,

        message:
          "Conversation reported successfully",

        evidence,
      });

    } catch (error) {

      console.error(
        "Report evidence error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to report conversation",
      });
    }
  };

module.exports = {
  saveEvidence,
  getMyEvidence,
  reportEvidence,
};