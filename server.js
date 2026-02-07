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

/*************************************************
 * UPLOADS FOLDER
 *************************************************/
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

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
  role: String // student | reviewer | admin
});

const DocumentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  name: String,
  status: String, // submitted | forwarded | returned | approved
  comment: String,
  commentBy: String, // reviewer | admin
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
 * FILE UPLOAD (MULTER)
 *************************************************/
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
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
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.json({ success: false, message: "Missing fields" });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.json({ success: false, message: "User exists" });
    }

    const hashed = await bcrypt.hash(password, 10);

    await User.create({
      name,
      email,
      password: hashed,
      role
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

/* ---------- LOGIN ---------- */
app.post("/login", async (req, res) => {
  try {
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
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

/* ---------- LOGOUT ---------- */
app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

/* ---------- STUDENT UPLOAD ---------- */
app.post("/upload", requireLogin, upload.single("file"), async (req, res) => {
  if (req.session.user.role !== "student") {
    return res.status(403).json({ success: false });
  }

  await Document.create({
    user: req.session.user.id,
    name: req.file.originalname,
    status: "submitted"
  });

  res.json({ success: true });
});

/* ---------- GET DOCUMENTS ---------- */
app.get("/documents", requireLogin, async (req, res) => {
  const role = req.session.user.role;

  let docs;
  if (role === "student") {
    docs = await Document.find({ user: req.session.user.id });
  } else if (role === "reviewer") {
    docs = await Document.find({ status: "submitted" });
  } else {
    docs = await Document.find({ status: "forwarded" });
  }

  res.json(docs);
});

/* ---------- REVIEWER ACTIONS ---------- */
app.post("/forward/:id", requireLogin, async (req, res) => {
  if (req.session.user.role !== "reviewer") return res.sendStatus(403);

  await Document.findByIdAndUpdate(req.params.id, {
    status: "forwarded",
    comment: null,
    commentBy: null
  });

  res.json({ success: true });
});

app.post("/reviewer-reject/:id", requireLogin, async (req, res) => {
  if (req.session.user.role !== "reviewer") return res.sendStatus(403);

  await Document.findByIdAndUpdate(req.params.id, {
    status: "returned",
    comment: req.body.comment,
    commentBy: "reviewer"
  });

  res.json({ success: true });
});

/* ---------- ADMIN ACTIONS ---------- */
app.post("/approve/:id", requireLogin, async (req, res) => {
  if (req.session.user.role !== "admin") return res.sendStatus(403);

  await Document.findByIdAndUpdate(req.params.id, {
    status: "approved"
  });

  res.json({ success: true });
});

app.post("/reject/:id", requireLogin, async (req, res) => {
  if (req.session.user.role !== "admin") return res.sendStatus(403);

  await Document.findByIdAndUpdate(req.params.id, {
    status: "returned",
    comment: req.body.comment,
    commentBy: "admin"
  });

  res.json({ success: true });
});

// ===== TEMP USER CREATION (DELETE LATER) =====
app.get("/signup-test", async (req, res) => {
  try {
    const users = [
      {
        name: "Student One",
        email: "student@test.com",
        password: "1234",
        role: "student"
      },
      {
        name: "Reviewer One",
        email: "reviewer@test.com",
        password: "1234",
        role: "reviewer"
      },
      {
        name: "Admin One",
        email: "admin@test.com",
        password: "1234",
        role: "admin"
      }
    ];

    for (let u of users) {
      const exists = await User.findOne({ email: u.email });
      if (!exists) {
        const hashed = await bcrypt.hash(u.password, 10);
        await User.create({
          name: u.name,
          email: u.email,
          password: hashed,
          role: u.role
        });
      }
    }

    res.send("✅ Test users created. You can login now.");
  } catch (e) {
    console.error(e);
    res.status(500).send("Error creating users");
  }
});


/*************************************************
 * START SERVER
 *************************************************/
app.listen(PORT, () => {
  console.log("Server running on " + PORT);
});
