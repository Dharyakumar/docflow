/*************************************************
 * REQUIREMENTS
 *************************************************/
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const session = require("express-session");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

/*************************************************
 * APP INIT
 *************************************************/
const app = express();
const PORT = 3000;

/*************************************************
 * MIDDLEWARE
 *************************************************/
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: "docflow_secret_key",
    resave: false,
    saveUninitialized: false
  })
);

app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));


/*************************************************
 * UPLOADS FOLDER
 *************************************************/
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

/*************************************************
 * MONGODB CONNECTION
 *************************************************/
mongoose
  .connect("mongodb+srv://dharya:dharya@cluster0.2gwg1jt.mongodb.net/docflow")
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB error:", err));

/*************************************************
 * MODELS
 *************************************************/
const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: { type: String, enum: ["student", "reviewer", "admin"] }
});

const DocumentSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  filename: String,
  filePath: String,
  status: {
    type: String,
    enum: [
      "submitted",
      "reviewer_approved",
      "reviewer_rejected",
      "admin_approved",
      "admin_rejected"
    ],
    default: "submitted"
  },
  comment: String,
  commentBy: String,
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model("User", UserSchema);
const Document = mongoose.model("Document", DocumentSchema);

/*************************************************
 * AUTH MIDDLEWARE
 *************************************************/
function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ success: false });
  }
  next();
}

/*************************************************
 * FILE UPLOAD
 *************************************************/
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname)
});
const upload = multer({ storage });

/*************************************************
 * ROUTES
 *************************************************/

/* ---------- HOME ---------- */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

/* ---------- SIGNUP ---------- */
app.post("/signup", async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role)
    return res.json({ success: false });

  const exists = await User.findOne({ email });
  if (exists) return res.json({ success: false });

  const hashed = await bcrypt.hash(password, 10);
  await User.create({ name, email, password: hashed, role });

  res.json({ success: true });
});

/* ---------- LOGIN ---------- */
app.post("/login", async (req, res) => {
  const { email, password, role } = req.body;

  const user = await User.findOne({ email, role });
  if (!user) return res.json({ success: false });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.json({ success: false });

  req.session.user = {
    id: user._id,
    role: user.role,
    email: user.email,
    name: user.name
  };

  res.json({ success: true, role: user.role });
});

/* ---------- STUDENT UPLOAD ---------- */
app.post("/upload", requireLogin, upload.single("file"), async (req, res) => {
  if (req.session.user.role !== "student")
    return res.sendStatus(403);

  const doc = await Document.create({
    studentId: req.session.user.id,
    filename: req.file.originalname,
    filePath: req.file.path
  });

  res.json({ success: true, doc });
});

/* ---------- GET DOCUMENTS ---------- */
app.get("/documents", requireLogin, async (req, res) => {
  const { role, id } = req.session.user;
  let docs = [];

  if (role === "student") {
    // Student sees ALL their docs + feedback
    docs = await Document.find({ studentId: id })
      .sort({ createdAt: -1 });
  }

  if (role === "reviewer") {
    // Reviewer sees only fresh submissions
    docs = await Document.find({ status: "submitted" })
      .sort({ createdAt: -1 });
  }

  if (role === "admin") {
    // Admin sees only reviewer-approved
    docs = await Document.find({ status: "forwarded" })
      .sort({ createdAt: -1 });
  }

  res.json(docs);
});

/* ---------- REVIEWER ACTIONS ---------- */
app.post("/forward/:id", requireLogin, async (req, res) => {
  if (req.session.user.role !== "reviewer") {
    return res.sendStatus(403);
  }

  await Document.findByIdAndUpdate(req.params.id, {
    status: "forwarded",
    comment: null,
    commentBy: null
  });

  res.json({ success: true });
});

app.post("/reviewer/approve/:id", requireLogin, async (req, res) => {
  if (req.session.user.role !== "reviewer")
    return res.sendStatus(403);

  await Document.findByIdAndUpdate(req.params.id, {
    status: "reviewer_approved",
    comment: null,
    commentBy: null
  });

  res.json({ success: true });
});

app.post("/reviewer/reject/:id", requireLogin, async (req, res) => {
  if (req.session.user.role !== "reviewer")
    return res.sendStatus(403);

  await Document.findByIdAndUpdate(req.params.id, {
    status: "reviewer_rejected",
    comment: req.body.comment,
    commentBy: "reviewer"
  });

  res.json({ success: true });
});

/* ---------- ADMIN ACTIONS ---------- */
app.post("/admin/approve/:id", requireLogin, async (req, res) => {
  if (req.session.user.role !== "admin")
    return res.sendStatus(403);

  await Document.findByIdAndUpdate(req.params.id, {
    status: "admin_approved",
    comment: null,
    commentBy: null
  });

  res.json({ success: true });
});

app.post("/admin/reject/:id", requireLogin, async (req, res) => {
  if (req.session.user.role !== "admin")
    return res.sendStatus(403);

  await Document.findByIdAndUpdate(req.params.id, {
    status: "admin_rejected",
    comment: req.body.comment,
    commentBy: "admin"
  });

  res.json({ success: true });
});

/*************************************************
 * START SERVER
 *************************************************/
app.listen(PORT, () => {
  console.log("Server running on " + PORT);
});
