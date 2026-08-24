const jwt = require("jsonwebtoken");

const Message = require("../models/Message");
const Connection = require("../models/Connection");
const Evidence = require("../models/Evidence");

const {
  detectSafety,
} = require("../utils/safetyDetector");

// ============================================================
// GET SOCKET TOKEN
// ============================================================

const getSocketToken = (socket) => {
  if (socket.handshake.auth?.token) {
    return socket.handshake.auth.token;
  }

  const cookieHeader =
    socket.handshake.headers?.cookie;

  if (!cookieHeader) {
    return null;
  }

  const tokenCookie = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) =>
      item.startsWith("token=")
    );

  if (!tokenCookie) {
    return null;
  }

  return decodeURIComponent(
    tokenCookie.substring("token=".length)
  );
};

// ============================================================
// GET ACTIVE CONNECTION
// ============================================================

const getConnection = async (
  connectionId,
  userId,
  receiverId = null
) => {
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

  if (!connection) {
    return null;
  }

  if (receiverId) {
    const receiverIsParticipant =
      connection.user1.toString() ===
        receiverId.toString() ||
      connection.user2.toString() ===
        receiverId.toString();

    if (!receiverIsParticipant) {
      return null;
    }
  }

  return connection;
};

// ============================================================
// CREATE AUTOMATIC EVIDENCE
// ============================================================

const createAutomaticEvidence = async ({
  connection,
  message,
  receiver,
  category,
}) => {
  try {
    // ------------------------------------------
    // CHECK EXISTING EVIDENCE
    // ------------------------------------------

    let evidence =
      await Evidence.findOne({
        connection: connection._id,
        savedBy: receiver,
        status: {
          $in: [
            "saved",
            "reported",
          ],
        },
      });

    // ------------------------------------------
    // IF ALREADY EXISTS
    // ------------------------------------------

    if (evidence) {
      const alreadyExists =
        evidence.messages.some(
          (item) =>
            item.messageId.toString() ===
            message._id.toString()
        );

      if (!alreadyExists) {
        evidence.messages.push({
          messageId: message._id,
          sender: message.sender,
          receiver: message.receiver,
          text: message.text,
          createdAt: message.createdAt,
        });

        await evidence.save();
      }

      return evidence;
    }

    // ------------------------------------------
    // FIND OTHER USER
    // ------------------------------------------

    const reportedUser =
      connection.user1.toString() ===
      receiver.toString()
        ? connection.user2
        : connection.user1;

    // ------------------------------------------
    // CREATE EVIDENCE
    // ------------------------------------------

    evidence =
      await Evidence.create({
        connection: connection._id,

        savedBy: receiver,

        reportedUser,

        messages: [
          {
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
          },
        ],

        category:
          category ||
          "harmful_content",

        reason:
          "Automatically preserved because harmful content was detected.",

        status:
          "saved",

        reportedAt:
          null,
      });

    return evidence;

  } catch (error) {
    console.error(
      "Automatic evidence error:",
      error
    );

    return null;
  }
};

// ============================================================
// INITIALIZE SOCKET
// ============================================================

const initializeSocket = (io) => {

  // ==========================================================
  // SOCKET AUTH
  // ==========================================================

  io.use((socket, next) => {
    try {
      const token =
        getSocketToken(socket);

      if (!token) {
        return next(
          new Error(
            "Authentication required"
          )
        );
      }

      const decoded =
        jwt.verify(
          token,
          process.env.JWT_SECRET
        );

      socket.userId =
        decoded.userId;

      next();

    } catch (error) {

      console.error(
        "Socket auth error:",
        error.message
      );

      next(
        new Error(
          "Invalid authentication"
        )
      );
    }
  });

  // ==========================================================
  // CONNECTION
  // ==========================================================

  io.on(
    "connection",
    (socket) => {

      const userId =
        socket.userId.toString();

      console.log(
        "Socket connected:",
        userId
      );

      socket.join(
        `user:${userId}`
      );

      // ========================================================
      // SEND MESSAGE
      // ========================================================

      socket.on(
        "send-message",
        async (
          data,
          callback
        ) => {

          try {

            const {
              connectionId,
              receiver,
              text,
            } = data || {};

            // ------------------------------------------
            // VALIDATION
            // ------------------------------------------

            if (!connectionId) {
              return callback?.({
                success: false,
                message:
                  "Connection ID is required",
              });
            }

            if (!receiver) {
              return callback?.({
                success: false,
                message:
                  "Receiver is required",
              });
            }

            if (
              !text ||
              !text.trim()
            ) {
              return callback?.({
                success: false,
                message:
                  "Message cannot be empty",
              });
            }

            if (
              userId ===
              receiver.toString()
            ) {
              return callback?.({
                success: false,
                message:
                  "You cannot message yourself",
              });
            }

            // ------------------------------------------
            // CONNECTION CHECK
            // ------------------------------------------

            const connection =
              await getConnection(
                connectionId,
                userId,
                receiver
              );

            if (!connection) {
              return callback?.({
                success: false,
                message:
                  "Active connection not found",
              });
            }

            const cleanText =
              text.trim();

            // ------------------------------------------
            // SAFETY CHECK
            // ------------------------------------------

            const safetyResult =
              detectSafety(
                cleanText
              );

            const isFlagged =
              safetyResult?.isHarmful ===
              true;

            const isSavedAsEvidence =
              isFlagged;

            // ------------------------------------------
            // SAVE MESSAGE
            // ------------------------------------------

            const message =
              await Message.create({

                connection:
                  connection._id,

                sender:
                  userId,

                receiver:
                  receiver,

                text:
                  cleanText,

                isRead:
                  false,

                readAt:
                  null,

                expiresAt:
                  null,

                isFlagged,

                isSavedAsEvidence,

              });

            // ------------------------------------------
            // AUTOMATIC EVIDENCE
            // ------------------------------------------

            let evidence = null;

            if (isFlagged) {

              evidence =
                await createAutomaticEvidence({
                  connection,
                  message,
                  receiver,
                  category:
                    safetyResult?.category,
                });

              // ----------------------------------------
              // KEEP MESSAGE PERMANENT
              // ----------------------------------------

              message.isSavedAsEvidence =
                true;

              message.evidenceSavedAt =
                new Date();

              message.expiresAt =
                null;

              await message.save();
            }

            // ------------------------------------------
            // SEND MESSAGE TO RECEIVER
            // ------------------------------------------

            io.to(
              `user:${receiver.toString()}`
            ).emit(
              "new-message",
              message
            );

            // ------------------------------------------
            // SAFETY PROMPT
            // ------------------------------------------

            if (isFlagged) {

              io.to(
                `user:${receiver.toString()}`
              ).emit(
                "safety-prompt",
                {
                  messageId:
                    message._id,

                  connectionId:
                    connection._id,

                  message:
                    message.text,

                  category:
                    safetyResult?.category ||
                    "harmful_content",

                  isHarmful:
                    true,

                  autoSavedAsEvidence:
                    true,

                  evidenceId:
                    evidence?._id ||
                    null,

                  messageIds: [
                    message._id,
                  ],
                }
              );
            }

            // ------------------------------------------
            // SENDER
            // ------------------------------------------

            socket.emit(
              "message-sent",
              message
            );

            // ------------------------------------------
            // SUCCESS
            // ------------------------------------------

            return callback?.({
              success: true,

              message,

              safety: {
                isHarmful:
                  isFlagged,

                category:
                  safetyResult?.category ||
                  null,

                autoSavedAsEvidence:
                  isSavedAsEvidence,

                evidenceId:
                  evidence?._id ||
                  null,
              },
            });

          } catch (error) {

            console.error(
              "Send message error:",
              error
            );

            return callback?.({
              success: false,
              message:
                "Failed to send message",
            });
          }
        }
      );

      // ========================================================
      // MESSAGE READ
      // ========================================================

      socket.on(
        "message-read",
        async (
          data,
          callback
        ) => {

          try {

            const {
              messageId,
            } = data || {};

            if (!messageId) {
              return callback?.({
                success: false,
                message:
                  "Message ID is required",
              });
            }

            const message =
              await Message.findOne({
                _id:
                  messageId,

                receiver:
                  userId,

                isRead:
                  false,
              });

            if (!message) {
              return callback?.({
                success: false,
                message:
                  "Unread message not found",
              });
            }

            const connection =
              await getConnection(
                message.connection,
                userId
              );

            if (!connection) {
              return callback?.({
                success: false,
                message:
                  "Connection no longer active",
              });
            }

            const readAt =
              new Date();

            message.isRead =
              true;

            message.readAt =
              readAt;

            if (
              message.isSavedAsEvidence
            ) {

              message.expiresAt =
                null;

            } else {

              message.expiresAt =
                new Date(
                  readAt.getTime() +
                  10 * 60 * 1000
                );
            }

            await message.save();

            io.to(
              `user:${message.sender.toString()}`
            ).emit(
              "message-read",
              {
                messageId:
                  message._id,

                readAt,
              }
            );

            return callback?.({
              success: true,
              message,
            });

          } catch (error) {

            console.error(
              "Message read error:",
              error
            );

            return callback?.({
              success: false,
              message:
                "Failed to mark message as read",
            });
          }
        }
      );

      // ========================================================
      // DISCONNECT
      // ========================================================

      socket.on(
        "disconnect",
        () => {
          console.log(
            "Socket disconnected:",
            userId
          );
        }
      );
    }
  );
};

module.exports = {
  initializeSocket,
};