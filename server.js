const express = require("express");
const multer = require("multer");
const cors = require("cors");
const { v4: uuid } = require("uuid");
const axios = require("axios");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

let documents = [];

// Multer setup (stores files in uploads/)
const upload = multer({ dest: "uploads/" });

// Home page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

// Student upload
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.json({ success: false });
    }

    console.log("Uploaded:", req.file.originalname);

    // Simple placeholder text for AI (you can improve later)
    const text = "This is a sample document text for grammar checking.";

    const response = await axios.post(
      "https://api.languagetool.org/v2/check",
      new URLSearchParams({
        text,
        language: "en-US"
      })
    );

    const errors = response.data.matches.length;
    const score = Math.max(100 - errors * 5, 0);

    documents.push({
      id: uuid(),
      name: req.file.originalname,
      status: "submitted",
      score,
      errors
    });

    res.json({ success: true });
  } catch (e) {
    console.log(e);
    res.json({ success: false });
  }
});

// Get all documents
app.get("/documents", (req, res) => {
  res.json(documents);
});

// Reviewer forward
app.post("/forward/:id", (req, res) => {
  const d = documents.find(x => x.id === req.params.id);
  if (d) d.status = "forwarded";
  res.json({ success: true });
});

// Reviewer reject
app.post("/reviewer-reject/:id", (req, res) => {
  const d = documents.find(x => x.id === req.params.id);
  if (d) d.status = "rejected";
  res.json({ success: true });
});

// Admin approve
app.post("/approve/:id", (req, res) => {
  const d = documents.find(x => x.id === req.params.id);
  if (d && d.status === "forwarded") d.status = "approved";
  res.json({ success: true });
});

// Admin reject
app.post("/reject/:id", (req, res) => {
  const d = documents.find(x => x.id === req.params.id);
  if (d && d.status === "forwarded") d.status = "rejected";
  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on " + PORT));
