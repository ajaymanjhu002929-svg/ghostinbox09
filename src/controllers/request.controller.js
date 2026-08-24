const Request = require("../models/Request");
const User = require("../models/User");
const Connection = require("../models/Connection");

// ============================================================
// SEND REQUEST
// ============================================================

const sendRequest = async (req, res) => {
  try {
    const senderId = req.userId;
    const { receiverId } = req.body;

    // --------------------------------------------------------
    // VALIDATION
    // --------------------------------------------------------

    if (!senderId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!receiverId) {
      return res.status(400).json({
        success: false,
        message: "Receiver ID is required",
      });
    }

    if (
      senderId.toString() ===
      receiverId.toString()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "You cannot send request to yourself",
      });
    }

    // --------------------------------------------------------
    // CHECK RECEIVER
    // --------------------------------------------------------

    const receiver =
      await User.findById(receiverId);

    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // ========================================================
    // CHECK EXISTING CONNECTION
    // ========================================================

    const existingConnection =
      await Connection.findOne({
        $or: [
          {
            user1: senderId,
            user2: receiverId,
          },
          {
            user1: receiverId,
            user2: senderId,
          },
        ],
      });

    // --------------------------------------------------------
    // ACTIVE CONNECTION
    // --------------------------------------------------------

    if (
      existingConnection &&
      existingConnection.status === "active"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "You are already connected with this user",
      });
    }

    // ========================================================
    // CHECK EXISTING REQUEST
    // ========================================================

    const existingRequest =
      await Request.findOne({
        $or: [
          {
            sender: senderId,
            receiver: receiverId,
          },
          {
            sender: receiverId,
            receiver: senderId,
          },
        ],
      }).sort({
        updatedAt: -1,
      });

    // ========================================================
    // EXISTING REQUEST FOUND
    // ========================================================

    if (existingRequest) {

      // ------------------------------------------------------
      // PENDING REQUEST
      // ------------------------------------------------------

      if (
        existingRequest.status ===
        "pending"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "A request is already pending",
        });
      }

      // ------------------------------------------------------
      // ACCEPTED REQUEST
      // ------------------------------------------------------
      //
      // Agar accepted request hai aur connection
      // inactive hai, to iska matlab connection
      // pehle remove kiya gaya tha.
      //
      // Is situation me SAME request record ko
      // dobara pending bana denge.
      //

      if (
        existingRequest.status ===
        "accepted"
      ) {

        if (
          existingConnection &&
          existingConnection.status ===
            "inactive"
        ) {

          existingRequest.sender =
            senderId;

          existingRequest.receiver =
            receiverId;

          existingRequest.status =
            "pending";

          await existingRequest.save();

          await existingRequest.populate([
            {
              path: "sender",
              select:
                "username photo gender category about interests",
            },
            {
              path: "receiver",
              select:
                "username photo gender category about interests",
            },
          ]);

          return res.status(201).json({
            success: true,
            message:
              "Request sent successfully",
            request:
              existingRequest,
          });
        }

        // ----------------------------------------------------
        // ACCEPTED BUT NO INACTIVE CONNECTION
        // ----------------------------------------------------

        return res.status(400).json({
          success: false,
          message:
            "This request has already been accepted",
        });
      }

      // ------------------------------------------------------
      // REJECTED REQUEST
      // ------------------------------------------------------
      //
      // Rejected request ko dobara pending kar sakte hain.
      //

      if (
        existingRequest.status ===
        "rejected"
      ) {

        existingRequest.sender =
          senderId;

        existingRequest.receiver =
          receiverId;

        existingRequest.status =
          "pending";

        await existingRequest.save();

        await existingRequest.populate([
          {
            path: "sender",
            select:
              "username photo gender category about interests",
          },
          {
            path: "receiver",
            select:
              "username photo gender category about interests",
          },
        ]);

        return res.status(201).json({
          success: true,
          message:
            "Request sent successfully",
          request:
            existingRequest,
        });
      }
    }

    // ========================================================
    // CREATE BRAND NEW REQUEST
    // ========================================================

    const request =
      await Request.create({
        sender: senderId,
        receiver: receiverId,
        status: "pending",
      });

    // ========================================================
    // POPULATE USERS
    // ========================================================

    await request.populate([
      {
        path: "sender",
        select:
          "username photo gender category about interests",
      },
      {
        path: "receiver",
        select:
          "username photo gender category about interests",
      },
    ]);

    // ========================================================
    // RESPONSE
    // ========================================================

    return res.status(201).json({
      success: true,
      message:
        "Request sent successfully",
      request,
    });

  } catch (error) {

    console.error(
      "Send request error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to send request",
    });
  }
};


// ============================================================
// GET MY REQUESTS
// ============================================================

const getMyRequests = async (
  req,
  res
) => {
  try {
    const userId = req.userId;

    // ========================================================
    // RECEIVED REQUESTS
    // ========================================================

    const receivedRequests =
      await Request.find({
        receiver: userId,
        status: "pending",
      })
        .populate(
          "sender",
          "username photo gender category about interests"
        )
        .sort({
          createdAt: -1,
        });

    // ========================================================
    // SENT REQUESTS
    // ========================================================

    const sentRequests =
      await Request.find({
        sender: userId,
      })
        .populate(
          "receiver",
          "username photo gender category about interests"
        )
        .sort({
          createdAt: -1,
        });

    // ========================================================
    // RECEIVED NORMALIZE
    // ========================================================

    const received =
      receivedRequests.map(
        (request) => ({
          _id: request._id,

          type: "received",

          user: request.sender,

          status: request.status,

          createdAt:
            request.createdAt,

          updatedAt:
            request.updatedAt,
        })
      );

    // ========================================================
    // SENT REQUESTS
    // ========================================================
    //
    // IMPORTANT:
    //
    // Accepted request tabhi history me dikhegi
    // jab actual connection active ho.
    //
    // Agar connection remove ho gaya hai:
    //
    // status = inactive
    //
    // to old accepted request hide ho jayegi.
    //

    const sent = [];

    for (
      const request of sentRequests
    ) {

      if (
        request.status ===
        "accepted"
      ) {

        const connection =
          await Connection.findOne({
            $or: [
              {
                user1: userId,
                user2:
                  request.receiver._id,
              },
              {
                user1:
                  request.receiver._id,
                user2: userId,
              },
            ],
          });

        // ----------------------------------------------
        // ACTIVE CONNECTION
        // ----------------------------------------------

        if (
          connection &&
          connection.status ===
            "active"
        ) {
          sent.push({
            _id: request._id,

            type: "sent",

            user:
              request.receiver,

            status:
              request.status,

            createdAt:
              request.createdAt,

            updatedAt:
              request.updatedAt,
          });
        }

        // ----------------------------------------------
        // INACTIVE CONNECTION
        // ----------------------------------------------
        //
        // Don't add old accepted request.
        //

        continue;
      }

      // ====================================================
      // PENDING / REJECTED
      // ====================================================

      sent.push({
        _id: request._id,

        type: "sent",

        user:
          request.receiver,

        status:
          request.status,

        createdAt:
          request.createdAt,

        updatedAt:
          request.updatedAt,
      });
    }

    // ========================================================
    // COMBINE
    // ========================================================

    const requests = [
      ...received,
      ...sent,
    ].sort(
      (a, b) =>
        new Date(b.createdAt) -
        new Date(a.createdAt)
    );

    // ========================================================
    // RESPONSE
    // ========================================================

    return res.status(200).json({
      success: true,

      count:
        requests.length,

      requests,
    });

  } catch (error) {

    console.error(
      "Get my requests error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to get requests",
    });
  }
};


// ============================================================
// GET INCOMING REQUESTS
// ============================================================

const getIncomingRequests =
  async (req, res) => {
    try {
      const userId = req.userId;

      const requests =
        await Request.find({
          receiver: userId,
          status: "pending",
        })
          .populate(
            "sender",
            "username photo gender category about interests"
          )
          .sort({
            createdAt: -1,
          });

      return res.status(200).json({
        success: true,
        requests,
      });

    } catch (error) {

      console.error(
        "Get incoming requests error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to get requests",
      });
    }
  };


// ============================================================
// ACCEPT REQUEST
// ============================================================

const acceptRequest =
  async (req, res) => {
    try {
      const userId = req.userId;
      const { requestId } =
        req.params;

      // ======================================================
      // FIND PENDING REQUEST
      // ======================================================

      const request =
        await Request.findOne({
          _id: requestId,

          receiver: userId,

          status: "pending",
        });

      if (!request) {
        return res.status(404).json({
          success: false,
          message:
            "Request not found",
        });
      }

      // ======================================================
      // USER IDS
      // ======================================================

      const senderId =
        request.sender;

      const receiverId =
        request.receiver;

      // ======================================================
      // FIND EXISTING CONNECTION
      // ======================================================

      let connection =
        await Connection.findOne({
          $or: [
            {
              user1: senderId,
              user2: receiverId,
            },
            {
              user1: receiverId,
              user2: senderId,
            },
          ],
        });

      // ======================================================
      // CREATE OR REACTIVATE CONNECTION
      // ======================================================

      if (!connection) {

        connection =
          await Connection.create({
            user1: senderId,

            user2: receiverId,

            status: "active",

            removedBy: [],

            removedAt: null,
          });

      } else {

        // ----------------------------------------------------
        // OLD CONNECTION
        // ----------------------------------------------------

        connection.status =
          "active";

        connection.removedBy = [];

        connection.removedAt =
          null;

        await connection.save();
      }

      // ======================================================
      // UPDATE REQUEST
      // ======================================================

      request.status =
        "accepted";

      await request.save();

      // ======================================================
      // POPULATE REQUEST
      // ======================================================

      await request.populate([
        {
          path: "sender",
          select:
            "username photo gender category about interests",
        },
        {
          path: "receiver",
          select:
            "username photo gender category about interests",
        },
      ]);

      // ======================================================
      // POPULATE CONNECTION
      // ======================================================

      await connection.populate([
        {
          path: "user1",
          select:
            "username photo gender category about interests",
        },
        {
          path: "user2",
          select:
            "username photo gender category about interests",
        },
      ]);

      // ======================================================
      // RESPONSE
      // ======================================================

      return res.status(200).json({
        success: true,

        message:
          "Request accepted and connection created",

        request,

        connection,
      });

    } catch (error) {

      console.error(
        "Accept request error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Failed to accept request",

        error:
          error.message,
      });
    }
  };


// ============================================================
// REJECT REQUEST
// ============================================================

const rejectRequest =
  async (req, res) => {
    try {
      const userId = req.userId;

      const { requestId } =
        req.params;

      // ======================================================
      // FIND REQUEST
      // ======================================================

      const request =
        await Request.findOne({
          _id: requestId,

          receiver: userId,

          status: "pending",
        });

      if (!request) {
        return res.status(404).json({
          success: false,

          message:
            "Request not found",
        });
      }

      // ======================================================
      // REJECT
      // ======================================================

      request.status =
        "rejected";

      await request.save();

      // ======================================================
      // RESPONSE
      // ======================================================

      return res.status(200).json({
        success: true,

        message:
          "Request rejected",

        request,
      });

    } catch (error) {

      console.error(
        "Reject request error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Failed to reject request",
      });
    }
  };


// ============================================================
// EXPORT
// ============================================================

module.exports = {
  sendRequest,
  getMyRequests,
  getIncomingRequests,
  acceptRequest,
  rejectRequest,
};