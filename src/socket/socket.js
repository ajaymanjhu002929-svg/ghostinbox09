const jwt =
  require("jsonwebtoken");

const User =
  require("../models/User");

const Message =
  require("../models/Message");

const Connection =
  require("../models/Connection");

const Evidence =
  require("../models/Evidence");

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

  const connection =
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
                receiver,
              } =
                data || {};

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
                receiver,
              } =
                data || {};

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
                text,
              } =
                data || {};

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

              if (!receiver) {

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
                receiver.toString()
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
                `user:${receiver.toString()}`
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