const express = require("express");
const multer = require("multer");
const cors = require("cors");
const { v4: uuid } = require("uuid");
const pdfParse = require("pdf-parse");
const fs = require("fs");
const axios = require("axios");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}


/* ================= USERS ================= */

let users = [
 { id:"student", password:"1234", role:"student" },
 { id:"reviewer", password:"1234", role:"reviewer" },
 { id:"admin", password:"1234", role:"admin" }
];

/* ================= DOCS ================= */

let documents = [];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const upload = multer({ storage });


/* ================= ROUTES ================= */

app.get("/",(req,res)=>{
 res.sendFile(path.join(__dirname,"public/index.html"));
});

/* ---- SIGNUP ---- */
app.post("/signup",(req,res)=>{
 const {id,password,role}=req.body;

 if(!id||!password||!role)
  return res.json({success:false,message:"Missing fields"});

 if(users.find(u=>u.id===id))
  return res.json({success:false,message:"User exists"});

 users.push({id,password,role});
 res.json({success:true});
});

/* ---- LOGIN ---- */
app.post("/login",(req,res)=>{
 const {id,password}=req.body;
 const u=users.find(x=>x.id===id&&x.password===password);
 if(!u) return res.json({success:false});
 res.json({success:true,role:u.role});
});

/* ---- STUDENT UPLOAD ---- */
app.post("/upload",upload.single("file"),async(req,res)=>{
 try{
  const data=await pdfParse(fs.readFileSync(req.file.path));
  const text=data.text.substring(0,4000);

  const r=await axios.post(
   "https://api.languagetool.org/v2/check",
   new URLSearchParams({text,language:"en-US"})
  );

  documents.push({
   id:uuid(),
   name:req.file.originalname,
   status:"submitted",
   errors:r.data.matches.length
  });

  res.json({success:true});
 }catch(e){
  console.log(e);
  res.json({success:false});
 }
});

/* ---- SHARED ---- */
app.get("/documents",(req,res)=>res.json(documents));

/* ---- REVIEWER ---- */
app.post("/forward/:id",(req,res)=>{
 const d = documents.find(x=>x.id===req.params.id);
 if(d){
   d.status="forwarded";
   d.comment = null;
 }
 res.json({success:true});
});


app.post("/reviewer-reject/:id",(req,res)=>{
 const d = documents.find(x=>x.id===req.params.id);
 if(d){
   d.status = "returned";
   d.comment = req.body.comment;
   d.commentBy = "reviewer";
 }
 res.json({success:true});
});


/* ---- ADMIN ---- */
app.post("/approve/:id",(req,res)=>{
 const d=documents.find(x=>x.id===req.params.id);
 if(d) d.status="approved";
 res.json({success:true});
});

app.post("/reject/:id",(req,res)=>{
 const d = documents.find(x=>x.id===req.params.id);
 if(d){
   d.status = "returned";
   d.comment = req.body.comment || "Rejected by Admin";
   d.commentBy = "admin";
 }
 res.json({success:true});
});




/* ================= START ================= */

app.listen(3000,()=>console.log("Server running on 3000"));

