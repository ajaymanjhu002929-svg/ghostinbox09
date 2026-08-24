const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

const User = require("../models/User");

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },

    async (accessToken, refreshToken, profile, done) => {
      try {
        const googleId = profile.id;

        const email = profile.emails?.[0]?.value;

        const username = profile.displayName || "";

        const photo = profile.photos?.[0]?.value || "";

        let user = await User.findOne({
          googleId,
        });

        // Existing Google user
        if (user) {
          return done(null, user);
        }

        // New Google user
        user = await User.create({
          googleId,
          email,
          username,
          photo,
          isProfileComplete: false,
        });

        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

module.exports = passport;