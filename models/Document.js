const mongoose = require("mongoose");

const DocumentSchema = new mongoose.Schema({
  name: String,
  filePath: String,

  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  status: {
    type: String,
    enum: [
      "submitted",
      "forwarded",
      "reviewer_returned",
      "reviewer_approved",
      "admin_approved",
      "admin_rejected"
    ],
    default: "submitted"
  },

  reviewerComment: String,
  adminComment: String,

  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Document", DocumentSchema);
