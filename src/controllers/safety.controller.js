const Message = require("../models/Message");
const Connection = require("../models/Connection");


// ==========================================
// GET ACTIVE CONNECTION
// ==========================================

const getActiveConnection = async (
  connectionId,
  userId
) => {
  if (!connectionId || !userId) {
    return null;
  }

  const connection =
    await Connection.findOne({
      _id: connectionId,

      status: "active",

      $or: [
        { user1: userId },
        { user2: userId },
      ],

      removedBy: {
        $ne: userId,
      },
    });

  return connection;
};


// ==========================================
// SAVE CONVERSATION AS EVIDENCE
// ==========================================
//
// Page 13 se ye endpoint call hoga.
//
// User:
//     "Save Conversation"
//
// press karega.
//
// Us connection ke saare messages:
//     isSavedAsEvidence = true
//
// kar diye jayenge.
//
// Evidence messages:
//     expiresAt = null
//
// rahenge.
//

const saveConversationAsEvidence =
  async (req, res) => {
    try {
      const userId =
        req.userId;

      const {
        connectionId,
      } = req.body;


      // ========================================
      // VALIDATION
      // ========================================

      if (!connectionId) {
        return res.status(400).json({
          success: false,
          message:
            "Connection ID is required",
        });
      }


      // ========================================
      // CONNECTION CHECK
      // ========================================

      const connection =
        await getActiveConnection(
          connectionId,
          userId
        );


      if (!connection) {
        return res.status(403).json({
          success: false,
          message:
            "Active connection not found",
        });
      }


      // ========================================
      // SAVE CONVERSATION
      // ========================================
      //
      // Sirf isi connection ke messages.
      //
      // Kisi doosre user's messages ko touch
      // nahi karenge.
      //

      const result =
        await Message.updateMany(
          {
            connection:
              connectionId,

            $or: [
              {
                sender:
                  userId,
              },
              {
                receiver:
                  userId,
              },
            ],
          },

          {
            $set: {
              isSavedAsEvidence:
                true,

              expiresAt:
                null,
            },
          }
        );


      // ========================================
      // RESPONSE
      // ========================================

      return res.status(200).json({
        success: true,

        message:
          "Conversation saved as evidence",

        connectionId,

        savedMessages:
          result.modifiedCount,
      });

    } catch (error) {

      console.error(
        "Save conversation error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to save conversation",
      });
    }
  };


// ==========================================
// GET EVIDENCE MESSAGES
// ==========================================
//
// Evidence Collection page ke liye.
//
// Sirf:
//     isSavedAsEvidence = true
//
// wale messages return honge.
//

const getEvidenceMessages =
  async (req, res) => {
    try {
      const userId =
        req.userId;


      // ========================================
      // GET USER'S CONNECTIONS
      // ========================================

      const connections =
        await Connection.find({
          status: "active",

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
        }).select("_id");


      const connectionIds =
        connections.map(
          (connection) =>
            connection._id
        );


      // ========================================
      // GET EVIDENCE
      // ========================================

      const messages =
        await Message.find({
          connection: {
            $in:
              connectionIds,
          },

          isSavedAsEvidence:
            true,

          $or: [
            {
              sender:
                userId,
            },
            {
              receiver:
                userId,
            },
          ],
        })
          .populate(
            "sender",
            "username photo"
          )
          .populate(
            "receiver",
            "username photo"
          )
          .sort({
            createdAt:
              -1,
          });


      return res.status(200).json({
        success: true,

        messages,
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


// ==========================================
// GET EVIDENCE FOR ONE CONNECTION
// ==========================================
//
// Kisi particular chat ki evidence collection.
//

const getConnectionEvidence =
  async (req, res) => {
    try {
      const userId =
        req.userId;

      const {
        connectionId,
      } = req.params;


      // ========================================
      // CONNECTION CHECK
      // ========================================

      const connection =
        await getActiveConnection(
          connectionId,
          userId
        );


      if (!connection) {
        return res.status(403).json({
          success: false,
          message:
            "Connection not found",
        });
      }


      // ========================================
      // GET EVIDENCE
      // ========================================

      const messages =
        await Message.find({
          connection:
            connectionId,

          isSavedAsEvidence:
            true,

          $or: [
            {
              sender:
                userId,
            },
            {
              receiver:
                userId,
            },
          ],
        })
          .populate(
            "sender",
            "username photo"
          )
          .populate(
            "receiver",
            "username photo"
          )
          .sort({
            createdAt:
              1,
          });


      return res.status(200).json({
        success: true,

        connectionId,

        messages,
      });

    } catch (error) {

      console.error(
        "Get connection evidence error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to load conversation evidence",
      });
    }
  };


// ==========================================
// SAVE SINGLE MESSAGE AS EVIDENCE
// ==========================================
//
// Future mein agar Page 13 se user bole:
//
// "Ye particular message save karo"
//
// to ye endpoint use ho sakta hai.
//

const saveMessageAsEvidence =
  async (req, res) => {
    try {
      const userId =
        req.userId;

      const {
        messageId,
      } = req.params;


      // ========================================
      // FIND MESSAGE
      // ========================================

      const message =
        await Message.findOne({
          _id: messageId,

          $or: [
            {
              sender:
                userId,
            },
            {
              receiver:
                userId,
            },
          ],
        });


      if (!message) {
        return res.status(404).json({
          success: false,
          message:
            "Message not found",
        });
      }


      // ========================================
      // CONNECTION CHECK
      // ========================================

      const connection =
        await getActiveConnection(
          message.connection,
          userId
        );


      if (!connection) {
        return res.status(403).json({
          success: false,
          message:
            "Connection is no longer active",
        });
      }


      // ========================================
      // SAVE
      // ========================================

      message.isSavedAsEvidence =
        true;

      message.expiresAt =
        null;


      await message.save();


      return res.status(200).json({
        success: true,

        message:
          "Message saved as evidence",

        data:
          message,
      });

    } catch (error) {

      console.error(
        "Save message evidence error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to save message as evidence",
      });
    }
  };


// ==========================================
// CHECK IF CONVERSATION HAS EVIDENCE
// ==========================================

const checkConversationEvidence =
  async (req, res) => {
    try {
      const userId =
        req.userId;

      const {
        connectionId,
      } = req.params;


      // ========================================
      // CONNECTION CHECK
      // ========================================

      const connection =
        await getActiveConnection(
          connectionId,
          userId
        );


      if (!connection) {
        return res.status(403).json({
          success: false,
          message:
            "Connection not found",
        });
      }


      // ========================================
      // CHECK
      // ========================================

      const count =
        await Message.countDocuments({
          connection:
            connectionId,

          isSavedAsEvidence:
            true,
        });


      return res.status(200).json({
        success: true,

        hasEvidence:
          count > 0,

        evidenceCount:
          count,
      });

    } catch (error) {

      console.error(
        "Check evidence error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to check conversation evidence",
      });
    }
  };


// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  saveConversationAsEvidence,

  getEvidenceMessages,

  getConnectionEvidence,

  saveMessageAsEvidence,

  checkConversationEvidence,
};