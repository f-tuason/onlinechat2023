const LocalStrategy = require("passport-local").Strategy;
const User = require("../models/user");
const bcrypt = require("bcrypt");

function initialize(passport) {
  passport.use(new LocalStrategy({ usernameField: "email" }, async (username, password, done) => {
    try {
      let user = await User.findOne({ email: username });
      if (!user) {
        console.log('User not found!'); 
        return done(null, false);
      }
      let peq = await bcrypt.compare(password, user.password);
      if (!peq) {
        console.log('Passwords not equal');
        return done(null, false);
      }
      console.log('Successfully authenticated');
      return done(null, user);
    } catch(err) {
      console.log('An error occured');
      return done(err);
    }
  }));
  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user, done) => done(null, user));
};

module.exports = initialize;
