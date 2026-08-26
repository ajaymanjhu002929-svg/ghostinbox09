const User = require("../models/User");

// ==========================================
// DISCOVER USERS
// ==========================================
//
// Supported filters:
//   /api/discover
//   /api/discover?category=all
//   /api/discover?category=loyal
//   /api/discover?category=casual
//   /api/discover?search=ajay
//   /api/discover?search=ajay&category=loyal
//
// The frontend can therefore show All / Loyal / Casual
// without changing the existing profile model or routes.
// ==========================================

const getDiscoverUsers = async (req, res) => {
  try {
    // ==========================================
    // CURRENT USER
    // ==========================================

    const currentUser = await User.findById(req.userId);

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // ==========================================
    // QUERY VALUES
    // ==========================================

    const search = req.query.search?.trim() || "";
    const requestedCategory =
      req.query.category?.trim().toLowerCase() || "all";

    // ==========================================
    // CATEGORY VALIDATION
    // ==========================================

    const allowedCategories = [
      "all",
      "loyal",
      "casual",
    ];

    if (!allowedCategories.includes(requestedCategory)) {
      return res.status(400).json({
        success: false,
        message: "Invalid discover category",
      });
    }

    // ==========================================
    // BASE QUERY
    // ==========================================

    const query = {
      // Never show the current user.
      _id: {
        $ne: req.userId,
      },

      // Only completed profiles are discoverable.
      isProfileComplete: true,
    };

    // ==========================================
    // CATEGORY FILTER
    // ==========================================
    //
    // ALL    -> no category restriction
    // LOYAL  -> only loyal profiles
    // CASUAL -> only casual profiles
    //
    // This replaces the old behaviour where the backend
    // always forced the current user's category.
    // ==========================================

    if (requestedCategory !== "all") {
      query.category = requestedCategory;
    }

    // ==========================================
    // USERNAME SEARCH
    // ==========================================

    if (search) {
      const escapedSearch = search.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      query.username = {
        $regex: `^${escapedSearch}`,
        $options: "i",
      };
    }

    // ==========================================
    // FIND USERS
    // ==========================================
    // Online users are returned first. The rest are
    // ordered by newest profile without changing the
    // actual data returned to the frontend.
    // ==========================================

    const users = await User.find(query)
      .select(
        "_id username photo gender age category about interests lookingFor qualities isOnline lastSeen createdAt"
      )
      .sort({
        isOnline: -1,
        createdAt: -1,
      })
      .limit(20);

    // ==========================================
    // RESPONSE
    // ==========================================

    return res.status(200).json({
      success: true,
      count: users.length,
      category: requestedCategory,
      users,
    });
  } catch (error) {
    console.error(
      "Discover users error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch discover users",
    });
  }
};

module.exports = {
  getDiscoverUsers,
};
