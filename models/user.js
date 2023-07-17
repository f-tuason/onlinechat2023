const mongoose = require("mongoose");

const user = new mongoose.Schema({
  googleId: String,
  firstName: String,
  lastName: String,
  email: String,
  password: String,
  image: String
});

module.exports = mongoose.model("User", user);