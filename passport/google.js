const GoogleStrategy   = require('passport-google-oauth20').Strategy;
const User = require('../models/user');

function initialize(passport) {
  passport.use(new GoogleStrategy(
    {
      clientID      : process.env.GOOGLE_ID,
      clientSecret  : process.env.GOOGLE_SECRET,
      callbackURL   : 'http://localhost:3000/auth/google/callback',
    }, async (accessToken, refreshToken, profile, done) => {
      let newUser = {
        googleId: profile.id,
        firstName: profile.name.givenName,
        lastName: profile.name.familyName,
        image: profile.photos[0].value,
      };
      try {
        let user = await User.findOne({ googleId: profile.id });
        if (!user) {
          console.log('user not found, creating a new user');
          let user = await User.create(newUser);
          return done(null, user);
        }
        console.log('user found')
        console.log(user);
        return done(null, user);
      } catch(err) {
        console.log('an error occured')
        return done(err);
      }
    }));
  passport.serializeUser((user, done) => { console.log('su', user); return done(null, user) });
  passport.deserializeUser((user, done) => { console.log('du', user); return done(null, user) });
}

module.exports = initialize;