
import jwt from "jsonwebtoken";
import cookie from "cookie";

import userModel from "../models/User.js";
import connectionModel from "../models/Connection.js";
import messageModel from "../models/Message.js";

// ======================================================
// ONLINE USERS
// ======================================================

const onlineUsers = new Map();

// userId -> Set of socketIds
// Ek user multiple tabs/devices se connected ho sakta hai.

// ======================================================
// GET USER ID FROM COOKIE
// ======================================================

const getUserIdFromSocket = (socket) => {
  try {
    const rawCookie = socket.handshake.headers.cookie;

    if (!rawCookie) {
      return null;
    }

    const cookies = cookie.parse(rawCookie);

    const token = cookies.token;

    if (!token) {
      return null;
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    return decoded.id || decoded._id || null;
  } catch (error) {
    console.error(
      "SOCKET AUTH ERROR:",
      error.message
    );

    return null;
  }
};

// ======================================================
// ADD ONLINE USER
// ======================================================

const addOnlineUser = (userId, socketId) => {
  const id = userId.toString();

  if (!onlineUsers.has(id)) {
    onlineUsers.set(id, new Set());
  }

  onlineUsers.get(id).add(socketId);
};

// ======================================================
// REMOVE ONLINE USER
// ======================================================

const removeOnlineUser = (userId, socketId) => {
  const id = userId.toString();

  const sockets = onlineUsers.get(id);

  if (!sockets) {
    return;
  }

  sockets.delete(socketId);

  if (sockets.size === 0) {
    onlineUsers.delete(id);

    return true;
  }

  return false;
};

// ======================================================
// CHECK ONLINE
// ======================================================

const isUserOnline = (userId) => {
  if (!userId) {
    return false;
  }

  return onlineUsers.has(
    userId.toString()
  );
};

// ======================================================
// EMIT PRESENCE
// ======================================================

const emitPresence = (
  io,
  userId,
  isOnline,
  lastSeen = null
) => {
  io.emit("user-presence", {
    userId: userId.toString(),
    online: isOnline,
    lastSeen,
  });
};

// ======================================================
// SOCKET SETUP
// ======================================================

const setupSocket = (io) => {
  // ====================================================
  // SOCKET AUTH MIDDLEWARE
  // ====================================================

  io.use((socket, next) => {
    const userId =
      getUserIdFromSocket(socket);

    if (!userId) {
      return next(
        new Error("Unauthorized socket connection")
      );
    }

    socket.userId = userId.toString();

    next();
  });

  // ====================================================
  // CONNECTION
  // ====================================================

  io.on("connection", async (socket) => {
    const userId = socket.userId;

    console.log(
      "SOCKET CONNECTED:",
      userId,
      socket.id
    );

    // --------------------------------------------------
    // ADD USER ONLINE
    // --------------------------------------------------

    addOnlineUser(
      userId,
      socket.id
    );

    // --------------------------------------------------
    // JOIN PERSONAL USER ROOM
    // --------------------------------------------------

    socket.join(
      `user:${userId}`
    );

    // --------------------------------------------------
    // SEND CURRENT PRESENCE
    // --------------------------------------------------

    emitPresence(
      io,
      userId,
      true,
      null
    );

    // ==================================================
    // SEND CURRENT ONLINE STATUS TO CONNECTED CLIENT
    // ==================================================

    socket.on(
      "check-user-presence",
      (targetUserId, callback) => {
        const online =
          isUserOnline(targetUserId);

        if (typeof callback === "function") {
          callback({
            success: true,
            online,
          });
        }
      }
    );

    // ==================================================
    // JOIN CONNECTION ROOM
    // ==================================================

    socket.on(
      "join-connection",
      async (
        connectionId,
        callback
      ) => {
        try {
          if (!connectionId) {
            return callback?.({
              success: false,
              message:
                "Connection ID is required",
            });
          }

          const connection =
            await connectionModel.findById(
              connectionId
            );

          if (!connection) {
            return callback?.({
              success: false,
              message:
                "Connection not found",
            });
          }

          const user1 =
            connection.user1?.toString();

          const user2 =
            connection.user2?.toString();

          if (
            userId !== user1 &&
            userId !== user2
          ) {
            return callback?.({
              success: false,
              message:
                "You are not part of this connection",
            });
          }

          socket.join(
            `connection:${connectionId}`
          );

          callback?.({
            success: true,
          });
        } catch (error) {
          console.error(
            "JOIN CONNECTION ERROR:",
            error
          );

          callback?.({
            success: false,
            message:
              "Unable to join connection",
          });
        }
      }
    );

    // ==================================================
    // TYPING START
    // ==================================================

    socket.on(
      "typing-start",
      async (data) => {
        try {
          const {
            connectionId,
            receiverId,
          } = data || {};

          if (
            !connectionId ||
            !receiverId
          ) {
            return;
          }

          const connection =
            await connectionModel.findById(
              connectionId
            );

          if (!connection) {
            return;
          }

          const user1 =
            connection.user1?.toString();

          const user2 =
            connection.user2?.toString();

          if (
            userId !== user1 &&
            userId !== user2
          ) {
            return;
          }

          if (
            receiverId.toString() !==
              user1 &&
            receiverId.toString() !==
              user2
          ) {
            return;
          }

          io.to(
            `user:${receiverId}`
          ).emit(
            "user-typing",
            {
              userId,
              connectionId:
                connectionId.toString(),
              typing: true,
            }
          );
        } catch (error) {
          console.error(
            "TYPING START ERROR:",
            error
          );
        }
      }
    );

    // ==================================================
    // TYPING STOP
    // ==================================================

    socket.on(
      "typing-stop",
      async (data) => {
        try {
          const {
            connectionId,
            receiverId,
          } = data || {};

          if (
            !connectionId ||
            !receiverId
          ) {
            return;
          }

          io.to(
            `user:${receiverId}`
          ).emit(
            "user-typing",
            {
              userId,
              connectionId:
                connectionId.toString(),
              typing: false,
            }
          );
        } catch (error) {
          console.error(
            "TYPING STOP ERROR:",
            error
          );
        }
      }
    );

    // ==================================================
    // SEND MESSAGE
    // ==================================================

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

          if (
            !connectionId ||
            !receiver ||
            !text?.trim()
          ) {
            return callback?.({
              success: false,
              message:
                "Connection, receiver and message are required",
            });
          }

          // --------------------------------------------
          // CHECK CONNECTION
          // --------------------------------------------

          const connection =
            await connectionModel.findById(
              connectionId
            );

          if (!connection) {
            return callback?.({
              success: false,
              message:
                "Connection not found",
            });
          }

          // --------------------------------------------
          // CHECK USER BELONGS TO CONNECTION
          // --------------------------------------------

          const user1 =
            connection.user1?.toString();

          const user2 =
            connection.user2?.toString();

          if (
            userId !== user1 &&
            userId !== user2
          ) {
            return callback?.({
              success: false,
              message:
                "You are not part of this connection",
            });
          }

          // --------------------------------------------
          // CHECK RECEIVER
          // --------------------------------------------

          const receiverId =
            receiver.toString();

          if (
            receiverId !== user1 &&
            receiverId !== user2
          ) {
            return callback?.({
              success: false,
              message:
                "Invalid receiver",
            });
          }

          if (
            receiverId === userId
          ) {
            return callback?.({
              success: false,
              message:
                "You cannot send message to yourself",
            });
          }

          // --------------------------------------------
          // CREATE MESSAGE
          // --------------------------------------------

          const message =
            await messageModel.create({
              connection:
                connectionId,
              sender: userId,
              receiver: receiverId,
              text: text.trim(),
            });

          // --------------------------------------------
          // POPULATE MESSAGE
          // --------------------------------------------

          const populatedMessage =
            await messageModel
              .findById(message._id)
              .populate(
                "sender",
                "username photo gender age"
              )
              .populate(
                "receiver",
                "username photo gender age"
              );

          // --------------------------------------------
          // SEND TO RECEIVER
          // --------------------------------------------

          io.to(
            `user:${receiverId}`
          ).emit(
            "new-message",
            populatedMessage
          );

          // --------------------------------------------
          // SEND TO SENDER
          // --------------------------------------------

          io.to(
            `user:${userId}`
          ).emit(
            "message-sent",
            populatedMessage
          );

          // --------------------------------------------
          // STOP TYPING AFTER MESSAGE
          // --------------------------------------------

          io.to(
            `user:${receiverId}`
          ).emit(
            "user-typing",
            {
              userId,
              connectionId:
                connectionId.toString(),
              typing: false,
            }
          );

          callback?.({
            success: true,
            message:
              populatedMessage,
          });
        } catch (error) {
          console.error(
            "SOCKET SEND MESSAGE ERROR:",
            error
          );

          callback?.({
            success: false,
            message:
              error.message ||
              "Failed to send message",
          });
        }
      }
    );

    // ==================================================
    // MESSAGE READ
    // ==================================================

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
            await messageModel.findById(
              messageId
            );

          if (!message) {
            return callback?.({
              success: false,
              message:
                "Message not found",
            });
          }

          // --------------------------------------------
          // ONLY RECEIVER CAN MARK READ
          // --------------------------------------------

          if (
            message.receiver?.toString() !==
            userId
          ) {
            return callback?.({
              success: false,
              message:
                "Only receiver can mark message as read",
            });
          }

          message.isRead = true;
          message.readAt = new Date();

          await message.save();

          // --------------------------------------------
          // INFORM SENDER
          // --------------------------------------------

          io.to(
            `user:${message.sender.toString()}`
          ).emit(
            "message-read",
            {
              messageId:
                message._id,
              readAt:
                message.readAt,
            }
          );

          callback?.({
            success: true,
          });
        } catch (error) {
          console.error(
            "MESSAGE READ ERROR:",
            error
          );

          callback?.({
            success: false,
            message:
              error.message ||
              "Failed to mark message as read",
          });
        }
      }
    );

    // ==================================================
    // SAFETY PROMPT
    // ==================================================

    socket.on(
      "safety-prompt",
      (data) => {
        try {
          const {
            receiverId,
            message,
          } = data || {};

          if (!receiverId) {
            return;
          }

          io.to(
            `user:${receiverId}`
          ).emit(
            "safety-prompt",
            {
              message:
                message ||
                "This conversation may contain harmful content.",
            }
          );
        } catch (error) {
          console.error(
            "SAFETY PROMPT SOCKET ERROR:",
            error
          );
        }
      }
    );

    // ==================================================
    // DISCONNECT
    // ==================================================

    socket.on(
      "disconnect",
      async (reason) => {
        console.log(
          "SOCKET DISCONNECTED:",
          userId,
          socket.id,
          reason
        );

        // --------------------------------------------
        // REMOVE THIS SOCKET
        // --------------------------------------------

        const becameOffline =
          removeOnlineUser(
            userId,
            socket.id
          );

        // --------------------------------------------
        // If another tab/device is still connected,
        // user is still ONLINE.
        // --------------------------------------------

        if (!becameOffline) {
          return;
        }

        // --------------------------------------------
        // LAST SEEN
        // --------------------------------------------

        const lastSeen =
          new Date();

        try {
          await userModel.findByIdAndUpdate(
            userId,
            {
              lastSeen,
            }
          );
        } catch (error) {
          console.error(
            "LAST SEEN UPDATE ERROR:",
            error
          );
        }

        // --------------------------------------------
        // INFORM EVERYONE
        // --------------------------------------------

        emitPresence(
          io,
          userId,
          false,
          lastSeen
        );
      }
    );
  });
};

// ======================================================
// EXPORT
// ======================================================

export default setupSocket;

