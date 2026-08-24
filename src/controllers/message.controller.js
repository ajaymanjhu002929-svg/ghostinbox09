const Message = require("../models/Message");
const Connection = require("../models/Connection");

const {
  detectSafety,
} = require("../utils/safetyDetector");


// ==========================================
// GET ACTIVE CONNECTION FOR USER
// ==========================================

const getActiveConnection = async (
  connectionId,
  userId
) => {
  return Connection.findOne({
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
};


// ==========================================
// SEND MESSAGE
// ==========================================
//
// HTTP message sending.
//
// IMPORTANT:
//
// Message send hone se pehle safety detector chalega.
//
// Harmful message:
//   isFlagged = true
//   isSavedAsEvidence = true
//   expiresAt = null
//
// Normal message:
//   isFlagged = false
//   isSavedAsEvidence = false
//
// Iska matlab harmful message automatic evidence
// collection mein preserve rahega.
//
// ==========================================

const sendMessage = async (req, res) => {
  try {
    const senderId = req.userId;

    const {
      connectionId,
      receiverId,
      text,
    } = req.body;


    // ------------------------------------------
    // VALIDATION
    // ------------------------------------------

    if (!connectionId) {
      return res.status(400).json({
        success: false,
        message: "Connection ID is required",
      });
    }


    if (!receiverId) {
      return res.status(400).json({
        success: false,
        message: "Receiver ID is required",
      });
    }


    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: "Message cannot be empty",
      });
    }


    // ------------------------------------------
    // SELF MESSAGE CHECK
    // ------------------------------------------

    if (
      senderId.toString() ===
      receiverId.toString()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "You cannot message yourself",
      });
    }


    // ------------------------------------------
    // CONNECTION CHECK
    // ------------------------------------------

    const connection =
      await getActiveConnection(
        connectionId,
        senderId
      );


    if (!connection) {
      return res.status(403).json({
        success: false,
        message:
          "Active connection not found",
      });
    }


    // ------------------------------------------
    // SENDER PARTICIPANT CHECK
    // ------------------------------------------

    const isParticipant =
      connection.user1.toString() ===
        senderId.toString() ||
      connection.user2.toString() ===
        senderId.toString();


    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message:
          "You are not part of this connection",
      });
    }


    // ------------------------------------------
    // RECEIVER PARTICIPANT CHECK
    // ------------------------------------------

    const receiverIsParticipant =
      connection.user1.toString() ===
        receiverId.toString() ||
      connection.user2.toString() ===
        receiverId.toString();


    if (!receiverIsParticipant) {
      return res.status(400).json({
        success: false,
        message:
          "Receiver is not part of this connection",
      });
    }


    // ------------------------------------------
    // NORMALIZE TEXT
    // ------------------------------------------

    const cleanText = text.trim();


    // ------------------------------------------
    // SAFETY DETECTION
    // ------------------------------------------

    const safetyResult =
      detectSafety(cleanText);


    console.log(
      "===================================="
    );

    console.log(
      "MESSAGE SAFETY CHECK"
    );

    console.log(
      "Is harmful:",
      safetyResult.isHarmful
    );

    console.log(
      "Category:",
      safetyResult.category
    );

    console.log(
      "===================================="
    );


    // ------------------------------------------
    // EVIDENCE / EXPIRY DECISION
    // ------------------------------------------
    //
    // Harmful message:
    //
    // isFlagged = true
    // isSavedAsEvidence = true
    // expiresAt = null
    //
    // Normal message:
    //
    // isFlagged = false
    // isSavedAsEvidence = false
    // expiresAt = null initially
    //
    // Normal messages later read hone ke baad
    // existing read-message logic se expiry set hogi.
    //

    const isFlagged =
      safetyResult.isHarmful;

    const isSavedAsEvidence =
      safetyResult.isHarmful;


    // ------------------------------------------
    // CREATE MESSAGE
    // ------------------------------------------

    const message = await Message.create({
      connection: connectionId,

      sender: senderId,

      receiver: receiverId,

      text: cleanText,

      isRead: false,

      readAt: null,

      // Harmful/evidence message ko kabhi
      // automatic expiry nahi deni.
      expiresAt: null,

      isFlagged,

      isSavedAsEvidence,
    });


    // ------------------------------------------
    // RESPONSE
    // ------------------------------------------

    return res.status(201).json({
      success: true,

      message:
        "Message sent successfully",

      data: message,

      // Frontend future mein is information
      // ka use safety prompt ke liye kar sakta hai.
      safety: {
        isHarmful:
          safetyResult.isHarmful,

        category:
          safetyResult.category,
      },
    });

  } catch (error) {
    console.error(
      "Send message error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to send message",
    });
  }
};


// ==========================================
// GET CHAT
// ==========================================

const getMessages = async (req, res) => {
  try {
    const userId = req.userId;

    const { connectionId } =
      req.params;


    // ------------------------------------------
    // CONNECTION CHECK
    // ------------------------------------------

    const connection =
      await getActiveConnection(
        connectionId,
        userId
      );


    if (!connection) {
      return res.status(403).json({
        success: false,
        message:
          "Chat is not available",
      });
    }


    // ------------------------------------------
    // GET MESSAGES
    // ------------------------------------------

    const messages =
      await Message.find({
        connection: connectionId,

        $or: [
          { sender: userId },
          { receiver: userId },
        ],
      }).sort({
        createdAt: 1,
      });


    return res.status(200).json({
      success: true,
      messages,
    });

  } catch (error) {
    console.error(
      "Get messages error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to get messages",
    });
  }
};


// ==========================================
// MARK ONE MESSAGE READ
// ==========================================

const markMessageAsRead = async (
  req,
  res
) => {
  try {
    const userId = req.userId;

    const { messageId } =
      req.params;


    // ------------------------------------------
    // FIND UNREAD MESSAGE
    // ------------------------------------------

    const message =
      await Message.findOne({
        _id: messageId,

        receiver: userId,

        isRead: false,
      });


    if (!message) {
      return res.status(404).json({
        success: false,
        message:
          "Unread message not found",
      });
    }


    // ------------------------------------------
    // CONNECTION CHECK
    // ------------------------------------------

    const connection =
      await getActiveConnection(
        message.connection,
        userId
      );


    if (!connection) {
      return res.status(403).json({
        success: false,
        message:
          "Chat is no longer available",
      });
    }


    // ------------------------------------------
    // EVIDENCE MESSAGE PROTECTION
    // ------------------------------------------
    //
    // Agar message already evidence hai,
    // to usko expiry nahi deni.
    //
    // Evidence forever preserved rahega.
    //

    const readAt = new Date();

    let expiresAt = null;


    if (!message.isSavedAsEvidence) {
      expiresAt = new Date(
        readAt.getTime() +
          10 * 60 * 1000
      );
    }


    message.isRead = true;

    message.readAt = readAt;

    message.expiresAt =
      expiresAt;


    await message.save();


    return res.status(200).json({
      success: true,

      message:
        "Message marked as read",

      data: message,
    });

  } catch (error) {
    console.error(
      "Read message error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to mark message as read",
    });
  }
};


// ==========================================
// MARK ALL READ
// ==========================================

const markAllMessagesAsRead = async (
  req,
  res
) => {
  try {
    const userId = req.userId;

    const { connectionId } =
      req.params;


    // ------------------------------------------
    // CONNECTION CHECK
    // ------------------------------------------

    const connection =
      await getActiveConnection(
        connectionId,
        userId
      );


    if (!connection) {
      return res.status(403).json({
        success: false,
        message:
          "Chat is no longer available",
      });
    }


    // ------------------------------------------
    // READ TIME
    // ------------------------------------------

    const readAt = new Date();

    const expiresAt = new Date(
      readAt.getTime() +
        10 * 60 * 1000
    );


    // ------------------------------------------
    // NORMAL MESSAGES
    // ------------------------------------------
    //
    // Evidence messages ko update nahi karenge.
    //
    // Kyunki evidence ko expire nahi hona chahiye.
    //

    const result =
      await Message.updateMany(
        {
          connection: connectionId,

          receiver: userId,

          isRead: false,

          isSavedAsEvidence: false,
        },

        {
          $set: {
            isRead: true,

            readAt,

            expiresAt,
          },
        }
      );


    // ------------------------------------------
    // EVIDENCE MESSAGES
    // ------------------------------------------
    //
    // Evidence messages ko read mark karna hai,
    // lekin expiresAt null hi rahega.
    //

    await Message.updateMany(
      {
        connection: connectionId,

        receiver: userId,

        isRead: false,

        isSavedAsEvidence: true,
      },

      {
        $set: {
          isRead: true,

          readAt,

          expiresAt: null,
        },
      }
    );


    return res.status(200).json({
      success: true,

      message:
        "Messages marked as read",

      modifiedCount:
        result.modifiedCount,
    });

  } catch (error) {
    console.error(
      "Mark all read error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to mark messages as read",
    });
  }
};


// ==========================================
// DELETE MESSAGE
// ==========================================

const deleteMessage = async (
  req,
  res
) => {
  try {
    const userId = req.userId;

    const { messageId } =
      req.params;


    // ------------------------------------------
    // FIND MESSAGE
    // ------------------------------------------

    const message =
      await Message.findOne({
        _id: messageId,

        $or: [
          { sender: userId },
          { receiver: userId },
        ],
      });


    if (!message) {
      return res.status(404).json({
        success: false,
        message:
          "Message not found",
      });
    }


    // ------------------------------------------
    // EVIDENCE PROTECTION
    // ------------------------------------------

    if (message.isSavedAsEvidence) {
      return res.status(403).json({
        success: false,
        message:
          "Evidence message cannot be deleted",
      });
    }


    // ------------------------------------------
    // DELETE
    // ------------------------------------------

    await Message.findByIdAndDelete(
      messageId
    );


    return res.status(200).json({
      success: true,

      message:
        "Message deleted successfully",
    });

  } catch (error) {
    console.error(
      "Delete message error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to delete message",
    });
  }
};


// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  sendMessage,
  getMessages,
  markMessageAsRead,
  markAllMessagesAsRead,
  deleteMessage,
};