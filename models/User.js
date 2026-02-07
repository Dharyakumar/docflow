const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,   // (plain for now – we’ll hash later)
  role: {
    type: String,
    enum: ["student", "reviewer", "admin"],
    default: "student"
  }
});

module.exports = mongoose.model("User", UserSchema);
