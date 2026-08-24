const Connection = require("../models/Connection");


// ============================================================
// GET USER ID
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
// GET ALL ACTIVE CONNECTIONS
// ============================================================

const getConnections = async (
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

    const connections =
      await Connection.find({

        status: "active",

        $or: [
          {
            user1: userId,
          },
          {
            user2: userId,
          },
        ],

        removedBy: {
          $ne: userId,
        },

      })
        .populate(
          "user1",
          "username photo gender category"
        )
        .populate(
          "user2",
          "username photo gender category"
        )
        .sort({
          updatedAt: -1,
        });


    return res.status(200).json({
      success: true,
      connections,
    });

  } catch (error) {

    console.error(
      "Get connections error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to load connections",
    });
  }
};


// ============================================================
// GET SINGLE CONNECTION
// ============================================================

const getConnectionById =
  async (
    req,
    res
  ) => {

    try {

      const userId =
        getUserId(req);

      const {
        connectionId,
      } = req.params;


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
        await Connection.findOne({

          _id: connectionId,

          status: "active",

          $or: [
            {
              user1: userId,
            },
            {
              user2: userId,
            },
          ],

          removedBy: {
            $ne: userId,
          },

        })
          .populate(
            "user1",
            "username photo gender category"
          )
          .populate(
            "user2",
            "username photo gender category"
          );


      if (!connection) {
        return res.status(404).json({
          success: false,
          message:
            "Active connection not found",
        });
      }


      return res.status(200).json({
        success: true,
        connection,
      });

    } catch (error) {

      console.error(
        "Get connection error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to load connection",
      });
    }
  };


// ============================================================
// REMOVE CONNECTION
// ============================================================

const removeConnection =
  async (
    req,
    res
  ) => {

    try {

      const userId =
        getUserId(req);

      const {
        connectionId,
      } = req.params;


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
        await Connection.findOne({

          _id: connectionId,

          $or: [
            {
              user1: userId,
            },
            {
              user2: userId,
            },
          ],

        });


      if (!connection) {
        return res.status(404).json({
          success: false,
          message:
            "Connection not found",
        });
      }


      const alreadyRemoved =
        connection.removedBy?.some(
          (id) =>
            id.toString() ===
            userId.toString()
        );


      if (alreadyRemoved) {
        return res.status(200).json({
          success: true,
          message:
            "Connection already removed",
          connection,
        });
      }


      if (
        !Array.isArray(
          connection.removedBy
        )
      ) {
        connection.removedBy = [];
      }


      connection.removedBy.push(
        userId
      );


      connection.status =
        "inactive";

      connection.removedAt =
        new Date();


      await connection.save();


      return res.status(200).json({

        success: true,

        message:
          "Connection removed successfully",

        connectionId,

        removedBy:
          userId,

      });

    } catch (error) {

      console.error(
        "Remove connection error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to remove connection",
      });
    }
  };


// ============================================================
// CHECK CONNECTION STATUS
// ============================================================

const checkConnectionStatus =
  async (
    req,
    res
  ) => {

    try {

      const userId =
        getUserId(req);

      const {
        connectionId,
      } = req.params;


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
        await Connection.findOne({

          _id: connectionId,

          $or: [
            {
              user1: userId,
            },
            {
              user2: userId,
            },
          ],

        });


      if (!connection) {
        return res.status(404).json({
          success: false,
          message:
            "Connection not found",
        });
      }


      const isRemovedByMe =
        connection.removedBy?.some(
          (id) =>
            id.toString() ===
            userId.toString()
        ) || false;


      const isActive =
        connection.status ===
          "active" &&
        !isRemovedByMe;


      return res.status(200).json({

        success: true,

        connectionId,

        status:
          connection.status,

        isRemovedByMe,

        isActive,

      });

    } catch (error) {

      console.error(
        "Check connection status error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to check connection status",
      });
    }
  };


// ============================================================
// EXPORT
// ============================================================

module.exports = {

  getConnections,

  getConnectionById,

  removeConnection,

  checkConnectionStatus,

};