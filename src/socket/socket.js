const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Message = require("../models/Message");
const Connection = require("../models/Connection");
const Evidence = require("../models/Evidence");

const {
  detectSafety,
} = require("../utils/safetyDetector");
// ============================================================
// GET SOCKET TOKEN
// ============================================================

const getSocketToken = (
  socket
) => {

  // ------------------------------------------
  // TOKEN FROM SOCKET AUTH
  // ------------------------------------------

  if (
    socket.handshake.auth?.token
  ) {
    return socket.handshake.auth.token;
  }

  // ------------------------------------------
  // TOKEN FROM COOKIE
  // ------------------------------------------

  const cookieHeader =
    socket.handshake.headers?.cookie;

  if (!cookieHeader) {
    return null;
  }

  const tokenCookie =
    cookieHeader
      .split(";")
      .map(
        (item) =>
          item.trim()
      )
      .find(
        (item) =>
          item.startsWith(
            "token="
          )
      );

  if (!tokenCookie) {
    return null;
  }

  return decodeURIComponent(
    tokenCookie.substring(
      "token=".length
    )
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

  // ----------------------------------------------------------
  // FIRST: TRY THE CONNECTION ID SENT BY THE CLIENT.
  // ----------------------------------------------------------

  let connection =
    await Connection.findOne({

      _id:
        connectionId,

      status:
        "active",

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

      removedBy: {
        $ne:
          userId,
      },
    });

  // ----------------------------------------------------------
  // FALLBACK: FIND THE CURRENT ACTIVE CONNECTION BY USERS.
  // ----------------------------------------------------------
  // Handles a stale connectionId after:
  // remove connection -> request again -> accept request.

  if (!connection && receiverId) {

    connection =
      await Connection.findOne({

        status:
          "active",

        $or: [
          {
            user1:
              userId,

            user2:
              receiverId,
          },
          {
            user1:
              receiverId,

            user2:
              userId,
          },
        ],

        removedBy: {
          $ne:
            userId,
        },
      });
  }

  if (!connection) {
    return null;
  }

  // ------------------------------------------
  // CHECK RECEIVER IS ALSO PARTICIPANT
  // ------------------------------------------

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

const createAutomaticEvidence =
  async ({
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

          connection:
            connection._id,

          savedBy:
            receiver,

          status: {
            $in: [
              "saved",
              "reported",
            ],
          },
        });

      // ------------------------------------------
      // EXISTING EVIDENCE
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

          await evidence.save();
        }

        return evidence;
      }

      // ------------------------------------------
      // FIND REPORTED USER
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

          connection:
            connection._id,

          savedBy:
            receiver,

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
// GET OTHER USERS FROM ACTIVE CONNECTIONS
// ============================================================

const getConnectedUserIds =
  async (userId) => {

    try {

      const connections =
        await Connection.find({

          status:
            "active",

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

          removedBy: {
            $ne:
              userId,
          },
        }).select(
          "user1 user2"
        );

      const userIds =
        new Set();

      for (
        const connection
        of connections
      ) {

        const otherUserId =
          connection.user1.toString() ===
          userId.toString()

            ? connection.user2.toString()

            : connection.user1.toString();

        userIds.add(
          otherUserId
        );
      }

      return [
        ...userIds,
      ];

    } catch (error) {

      console.error(
        "Get connected users error:",
        error
      );

      return [];
    }
  };


// ============================================================
// EMIT PRESENCE TO CONNECTED USERS
// ============================================================

const emitPresenceToConnections =
  async (
    io,
    userId,
    isOnline,
    lastSeen = null
  ) => {

    try {

      const connectedUserIds =
        await getConnectedUserIds(
          userId
        );

      for (
        const connectedUserId
        of connectedUserIds
      ) {

        io.to(
          `user:${connectedUserId}`
        ).emit(
          "user-presence",
          {
            userId:
              userId.toString(),

            isOnline,

            lastSeen,
          }
        );
      }

    } catch (error) {

      console.error(
        "Presence emit error:",
        error
      );
    }
  };


// ============================================================
// SEND CURRENT PRESENCE OF CONNECTED USERS TO A NEW SOCKET
// ============================================================

const emitCurrentPresenceToUser =
  async (
    io,
    userId,
    socket
  ) => {

    try {

      const connectedUserIds =
        await getConnectedUserIds(
          userId
        );

      if (
        connectedUserIds.length === 0
      ) {
        return;
      }

      const users =
        await User.find({
          _id: {
            $in: connectedUserIds,
          },
        }).select(
          "_id isOnline lastSeen"
        );

      for (
        const user
        of users
      ) {

        socket.emit(
          "user-presence",
          {
            userId:
              user._id.toString(),

            isOnline:
              Boolean(
                user.isOnline
              ),

            lastSeen:
              user.lastSeen ||
              null,
          }
        );
      }

    } catch (error) {

      console.error(
        "Initial presence error:",
        error
      );
    }
  };


// ============================================================
// CHECK IF USER STILL HAS ACTIVE SOCKET
// ============================================================

const hasActiveSocket =
  async (
    io,
    userId
  ) => {

    try {

      const sockets =
        await io
          .in(
            `user:${userId}`
          )
          .fetchSockets();

      return (
        sockets.length > 0
      );

    } catch (error) {

      console.error(
        "Active socket check error:",
        error
      );

      return false;
    }
  };


// ============================================================
// INITIALIZE SOCKET
// ============================================================

const initializeSocket =
  (io) => {

    // ========================================================
    // SOCKET AUTHENTICATION
    // ========================================================

    io.use(
      async (
        socket,
        next
      ) => {

        try {

          const token =
            getSocketToken(
              socket
            );

          if (!token) {

            return next(
              new Error(
                "Authentication required"
              )
            );
          }

          // ------------------------------------------
          // VERIFY JWT
          // ------------------------------------------

          const decoded =
            jwt.verify(
              token,
              process.env.JWT_SECRET
            );

          const userId =
            decoded.userId;

          if (!userId) {

            return next(
              new Error(
                "Invalid authentication token"
              )
            );
          }

          // ------------------------------------------
          // CHECK USER STILL EXISTS
          // ------------------------------------------
          //
          // Important for deleted accounts.
          // ------------------------------------------

          const user =
            await User.findById(
              userId
            ).select("_id");

          if (!user) {

            return next(
              new Error(
                "User account not found"
              )
            );
          }

          socket.userId =
            user._id;

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
      }
    );


    // ========================================================
    // SOCKET CONNECTION
    // ========================================================

    io.on(
      "connection",
      async (
        socket
      ) => {

        const userId =
          socket.userId.toString();

        console.log(
          "Socket connected:",
          userId
        );

        // ------------------------------------------
        // JOIN USER ROOM
        // ------------------------------------------

        socket.join(
          `user:${userId}`
        );

        // ------------------------------------------
        // MARK USER ONLINE
        // ------------------------------------------

        await User.findByIdAndUpdate(
          userId,
          {
            isOnline:
              true,

            lastSeen:
              null,
          }
        );

        // ------------------------------------------
        // NOTIFY CONNECTED USERS
        // ------------------------------------------

        await emitPresenceToConnections(
          io,
          userId,
          true,
          null
        );

        // ------------------------------------------
        // SEND CURRENT STATUS OF ALL CONNECTIONS
        // ------------------------------------------

        await emitCurrentPresenceToUser(
          io,
          userId,
          socket
        );


        // ======================================================
        // GET CURRENT PRESENCE
        // ======================================================

        socket.on(
          "get-user-presence",
          async (data, callback) => {
            try {
              const requestedUserId =
                data?.userId ||
                data?.receiverId ||
                null;

              if (!requestedUserId) {
                return callback?.({
                  success: false,
                  message: "User ID is required",
                });
              }

              const requestedUser =
                await User.findById(
                  requestedUserId
                ).select(
                  "_id isOnline lastSeen"
                );

              if (!requestedUser) {
                return callback?.({
                  success: false,
                  message: "User not found",
                });
              }

              socket.emit(
                "user-presence",
                {
                  userId: requestedUser._id.toString(),
                  isOnline: Boolean(
                    requestedUser.isOnline
                  ),
                  lastSeen:
                    requestedUser.lastSeen || null,
                }
              );

              return callback?.({
                success: true,
              });
            } catch (error) {
              console.error(
                "Get user presence error:",
                error
              );

              return callback?.({
                success: false,
                message: "Failed to get user presence",
              });
            }
          }
        );


        // ======================================================
        // TYPING START
        // ======================================================

        socket.on(
          "typing-start",
          async (
            data,
            callback
          ) => {

            try {

              const {
                connectionId,
                receiver: receiverValue,
                receiverId,
              } =
                data || {};

              const receiver =
                receiverValue ||
                receiverId;

              if (
                !connectionId ||
                !receiver
              ) {

                return callback?.({
                  success:
                    false,

                  message:
                    "Connection ID and receiver are required",
                });
              }

              // ------------------------------------------
              // VERIFY CONNECTION
              // ------------------------------------------

              const connection =
                await getConnection(
                  connectionId,
                  userId,
                  receiver
                );

              if (!connection) {

                return callback?.({
                  success:
                    false,

                  message:
                    "Active connection not found",
                });
              }

              // ------------------------------------------
              // SEND TYPING EVENT
              // ------------------------------------------

              io.to(
                `user:${receiver.toString()}`
              ).emit(
                "user-typing",
                {
                  connectionId:
                    connection._id.toString(),

                  userId:
                    userId,

                  senderId:
                    userId,

                  isTyping:
                    true,
                }
              );

              return callback?.({
                success:
                  true,
              });

            } catch (error) {

              console.error(
                "Typing start error:",
                error
              );

              return callback?.({
                success:
                  false,

                message:
                  "Failed to send typing status",
              });
            }
          }
        );


        // ======================================================
        // TYPING STOP
        // ======================================================

        socket.on(
          "typing-stop",
          async (
            data,
            callback
          ) => {

            try {

              const {
                connectionId,
                receiver: receiverValue,
                receiverId,
              } =
                data || {};

              const receiver =
                receiverValue ||
                receiverId;

              if (
                !connectionId ||
                !receiver
              ) {

                return callback?.({
                  success:
                    false,

                  message:
                    "Connection ID and receiver are required",
                });
              }

              // ------------------------------------------
              // VERIFY CONNECTION
              // ------------------------------------------

              const connection =
                await getConnection(
                  connectionId,
                  userId,
                  receiver
                );

              if (!connection) {

                return callback?.({
                  success:
                    false,

                  message:
                    "Active connection not found",
                });
              }

              // ------------------------------------------
              // SEND STOP TYPING
              // ------------------------------------------

              io.to(
                `user:${receiver.toString()}`
              ).emit(
                "user-typing",
                {
                  connectionId:
                    connection._id.toString(),

                  userId:
                    userId,

                  senderId:
                    userId,

                  isTyping:
                    false,
                }
              );

              return callback?.({
                success:
                  true,
              });

            } catch (error) {

              console.error(
                "Typing stop error:",
                error
              );

              return callback?.({
                success:
                  false,

                message:
                  "Failed to stop typing status",
              });
            }
          }
        );


        // ======================================================
        // SEND MESSAGE
        // ======================================================

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
                receiverId,
                text,
                replyTo,
              } =
                data || {};

              // Support both payload names used by older/newer clients.
              const targetReceiver = receiver || receiverId;

              // ------------------------------------------
              // VALIDATION
              // ------------------------------------------

              if (!connectionId) {

                return callback?.({
                  success:
                    false,

                  message:
                    "Connection ID is required",
                });
              }

              if (!targetReceiver) {

                return callback?.({
                  success:
                    false,

                  message:
                    "Receiver is required",
                });
              }

              if (
                !text ||
                !text.trim()
              ) {

                return callback?.({
                  success:
                    false,

                  message:
                    "Message cannot be empty",
                });
              }

              if (
                userId ===
                targetReceiver.toString()
              ) {

                return callback?.({
                  success:
                    false,

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
                  success:
                    false,

                  message:
                    "Active connection not found",
                });
              }

              // Never persist a stale client connectionId/receiver pair.
              // getConnection() may have resolved the current active connection
              // after a remove -> request -> accept cycle.
              const actualConnectionId = connection._id;
              const actualReceiverId =
                connection.user1.toString() === userId.toString()
                  ? connection.user2.toString()
                  : connection.user1.toString();

              const cleanText =
                text.trim();

              let replyMessageId = null;
              let replyPreview = null;

              if (replyTo) {
                const original = await Message.findOne({
                  _id: replyTo,
                  connection: actualConnectionId,
                  $or: [{ sender:userId }, { receiver:userId }],
                });
                if (!original) {
                  return callback?.({ success:false, message:"Reply message not found" });
                }
                replyMessageId = original._id;
                replyPreview = original.deletedForEveryone ? "Message deleted" : original.text.slice(0,500);
              }

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

                  deliveredAt:
                    null,

                  edited: false,
                  editedAt: null,
                  deletedForEveryone: false,
                  deletedAt: null,
                  deletedFor: [],
                  replyTo: replyMessageId,
                  replyPreview,

                  expiresAt:
                    null,

                  isFlagged,

                  isSavedAsEvidence,
                });

              // ------------------------------------------
              // AUTOMATIC EVIDENCE
              // ------------------------------------------

              let evidence =
                null;

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
              // STOP TYPING AUTOMATICALLY
              // ------------------------------------------

              io.to(
                `user:${actualReceiverId.toString()}`
              ).emit(
                "user-typing",
                {
                  connectionId:
                    connection._id.toString(),

                  userId:
                    userId,

                  isTyping:
                    false,
                }
              );

              // ------------------------------------------
              // SEND MESSAGE TO RECEIVER
              // ------------------------------------------

              io.to(
                `user:${actualReceiverId.toString()}`
              ).emit(
                "new-message",
                message
              );

              // ------------------------------------------
              // SAFETY PROMPT
              // ------------------------------------------

              if (isFlagged) {

                io.to(
                  `user:${actualReceiverId.toString()}`
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
                success:
                  true,

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
                success:
                  false,

                message:
                  "Failed to send message",
              });
            }
          }
        );


        // ======================================================
        // MARK CONNECTION READ
        // ======================================================
        socket.on("mark-connection-read", async (data, callback) => {
          try {
            const { connectionId } = data || {};
            if (!connectionId) return callback?.({success:false, message:"Connection ID is required"});
            const connection = await getConnection(connectionId, userId);
            if (!connection) return callback?.({success:false, message:"Connection no longer active"});
            const unread = await Message.find({ connection:connectionId, receiver:userId, isRead:false });
            const readAt = new Date();
            for (const message of unread) {
              message.isRead = true;
              if (!message.deliveredAt) message.deliveredAt = readAt;
              message.readAt = readAt;
              message.expiresAt = message.isSavedAsEvidence ? null : new Date(readAt.getTime() + 10*60*1000);
              await message.save();
              io.to(`user:${message.sender.toString()}`).emit("message-read", { messageId:message._id, readAt });
            }
            callback?.({success:true, modifiedCount:unread.length});
          } catch (error) {
            console.error("Mark connection read error:", error);
            callback?.({success:false, message:"Failed to mark messages as read"});
          }
        });

        // ======================================================
        // MESSAGE READ
        // ======================================================

        socket.on(
          "message-read",
          async (
            data,
            callback
          ) => {

            try {

              const {
                messageId,
              } =
                data || {};

              if (!messageId) {

                return callback?.({
                  success:
                    false,

                  message:
                    "Message ID is required",
                });
              }

              // ------------------------------------------
              // FIND UNREAD MESSAGE
              // ------------------------------------------

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
                  success:
                    false,

                  message:
                    "Unread message not found",
                });
              }

              // ------------------------------------------
              // CONNECTION CHECK
              // ------------------------------------------

              const connection =
                await getConnection(
                  message.connection,
                  userId
                );

              if (!connection) {

                return callback?.({
                  success:
                    false,

                  message:
                    "Connection no longer active",
                });
              }

              // ------------------------------------------
              // READ TIME
              // ------------------------------------------

              const readAt =
                new Date();

              message.isRead =
                true;

              if (!message.deliveredAt) {
                message.deliveredAt = readAt;
              }

              message.readAt =
                readAt;

              // ------------------------------------------
              // EXPIRATION
              // ------------------------------------------

              if (
                message.isSavedAsEvidence
              ) {

                message.expiresAt =
                  null;

              } else {

                message.expiresAt =
                  new Date(
                    readAt.getTime() +
                    10 *
                    60 *
                    1000
                  );
              }

              await message.save();

              // ------------------------------------------
              // NOTIFY SENDER
              // ------------------------------------------

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
                success:
                  true,

                message,
              });

            } catch (error) {

              console.error(
                "Message read error:",
                error
              );

              return callback?.({
                success:
                  false,

                message:
                  "Failed to mark message as read",
              });
            }
          }
        );


        
        // ======================================================
        // MESSAGE DELIVERED
        // ======================================================
        socket.on("message-delivered", async (data, callback) => {
          try {
            const { messageId } = data || {};
            if (!messageId) return callback?.({success:false, message:"Message ID is required"});
            const message = await Message.findOne({ _id:messageId, receiver:userId });
            if (!message) return callback?.({success:false, message:"Message not found"});
            const deliveredAt = message.deliveredAt || new Date();
            if (!message.deliveredAt) { message.deliveredAt = deliveredAt; await message.save(); }
            io.to(`user:${message.sender.toString()}`).emit("message-delivered", { messageId:message._id, deliveredAt });
            callback?.({success:true, deliveredAt});
          } catch (error) {
            console.error("Message delivery error:", error);
            callback?.({success:false, message:"Failed to mark message delivered"});
          }
        });

        // ======================================================
        // EDIT MESSAGE
        // ======================================================
        socket.on("edit-message", async (data, callback) => {
          try {
            const { messageId, text } = data || {};
            const cleanText = text?.trim();
            if (!messageId || !cleanText) return callback?.({success:false, message:"Message ID and text are required"});
            const message = await Message.findOne({ _id:messageId, sender:userId });
            if (!message) return callback?.({success:false, message:"Message not found"});
            if (message.isSavedAsEvidence) return callback?.({success:false, message:"Evidence message cannot be edited"});
            if (message.deletedForEveryone) return callback?.({success:false, message:"Deleted message cannot be edited"});
            if (Date.now() - new Date(message.createdAt).getTime() > 15*60*1000) return callback?.({success:false, message:"Messages can only be edited for 15 minutes"});
            message.text = cleanText;
            message.edited = true;
            message.editedAt = new Date();
            await message.save();
            io.to(`user:${message.receiver.toString()}`).emit("message-edited", message);
            socket.emit("message-edited", message);
            callback?.({success:true, message});
          } catch (error) {
            console.error("Socket edit error:", error);
            callback?.({success:false, message:"Failed to edit message"});
          }
        });

        // ======================================================
        // DELETE MESSAGE
        // ======================================================
        socket.on("delete-message", async (data, callback) => {
          try {
            const { messageId, mode = "me" } = data || {};
            if (!messageId) return callback?.({success:false, message:"Message ID is required"});
            const message = await Message.findOne({ _id:messageId, $or:[{sender:userId},{receiver:userId}] });
            if (!message) return callback?.({success:false, message:"Message not found"});
            if (message.isSavedAsEvidence) return callback?.({success:false, message:"Evidence message cannot be deleted"});
            if (mode === "everyone") {
              if (message.sender.toString() !== userId.toString()) return callback?.({success:false, message:"Only the sender can delete for everyone"});
              if (Date.now() - new Date(message.createdAt).getTime() > 15*60*1000) return callback?.({success:false, message:"Messages can only be deleted for everyone for 15 minutes"});
              message.deletedForEveryone = true;
              message.deletedAt = new Date();
              message.text = "This message was deleted";
              message.edited = false;
              await message.save();
              io.to(`user:${message.receiver.toString()}`).emit("message-deleted", { messageId:message._id, mode:"everyone", message });
              socket.emit("message-deleted", { messageId:message._id, mode:"everyone", message });
            } else {
              if (!message.deletedFor.some(id => id.toString() === userId.toString())) message.deletedFor.push(userId);
              await message.save();
              socket.emit("message-deleted", { messageId:message._id, mode:"me", userId });
            }
            callback?.({success:true, message, mode});
          } catch (error) {
            console.error("Socket delete error:", error);
            callback?.({success:false, message:"Failed to delete message"});
          }
        });

// ======================================================
        // DISCONNECT
        // ======================================================

        socket.on(
          "disconnect",
          async () => {

            console.log(
              "Socket disconnected:",
              userId
            );

            try {

              // ------------------------------------------
              // IMPORTANT:
              // Agar same user ki doosri tab/socket
              // abhi connected hai to offline mat karo.
              // ------------------------------------------

              const stillOnline =
                await hasActiveSocket(
                  io,
                  userId
                );

              if (
                stillOnline
              ) {
                return;
              }

              // ------------------------------------------
              // MARK OFFLINE
              // ------------------------------------------

              const lastSeen =
                new Date();

              const updatedUser =
                await User.findByIdAndUpdate(
                  userId,
                  {
                    isOnline:
                      false,

                    lastSeen,
                  },
                  {
                    new:
                      true,
                  }
                );

              if (!updatedUser) {
                return;
              }

              // ------------------------------------------
              // NOTIFY CONNECTED USERS
              // ------------------------------------------

              await emitPresenceToConnections(
                io,
                userId,
                false,
                lastSeen
              );

            } catch (error) {

              console.error(
                "Socket disconnect presence error:",
                error
              );
            }
          }
        );
      }
    );
  };


module.exports = {
  initializeSocket,
};