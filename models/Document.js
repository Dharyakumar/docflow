const mongoose = require("mongoose");

const DocumentSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  name: String,
  filePath: String,

  status: {
    type: String,
    enum: ["submitted", "forwarded", "approved", "rejected", "returned"],
    default: "submitted"
  },

  comment: String,
  commentBy: {
    type: String,
    enum: ["reviewer", "admin"]
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Document", DocumentSchema);
