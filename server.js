const express = require("express");
const multer = require("multer");
const mongoose = require("mongoose");
const session = require("express-session");
const path = require("path");

const app = express();

// --- CONFIG ---
const MONGO_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/peopleDB";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "yourpassword";

// --- DB ---
mongoose.connect(MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("Mongo error:", err));

const Person = mongoose.model("Person", {
  name: String,
  email: String,
  comment: String,
  picture: String,
  createdAt: { type: Date, default: Date.now }
});

// --- MIDDLEWARE ---
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

app.use(session({
  secret: "secret-key",
  resave: false,
  saveUninitialized: true
}));

// --- FILE UPLOAD ---
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// --- ROUTES ---

// Public form
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Add entry
app.post("/add", upload.single("picture"), async (req, res) => {
  await Person.create({
    name: req.body.name,
    email: req.body.email,
    comment: req.body.comment,
    picture: req.file.filename
  });
  res.send("<p>Submitted!</p><a href='/'>Back</a>");
});

// Login
app.get("/login", (req, res) => {
  res.send(`
    <h2>Admin Login</h2>
    <form method="POST" action="/login">
      <input type="password" name="password" placeholder="Password" required>
      <button>Login</button>
    </form>
  `);
});

app.post("/login", (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) {
    req.session.admin = true;
    res.redirect("/admin");
  } else {
    res.send("Wrong password");
  }
});

// Protect admin routes
function requireAdmin(req, res, next) {
  if (req.session.admin) return next();
  res.redirect("/login");
}

// Admin panel
app.get("/admin", requireAdmin, async (req, res) => {
  const people = await Person.find().sort({ createdAt: -1 });

  let html = `
    <html>
    <head>
      <link rel="stylesheet" href="/admin.css">
      <title>Admin Panel</title>
    </head>
    <body>
      <h1>Admin Panel</h1>
  `;

  people.forEach(p => {
    html += `
      <div class="card">
        <p><strong>${p.name}</strong> (${p.email})</p>
        <img src="/uploads/${p.picture}" width="120">
        <p>${p.comment}</p>
        <form method="POST" action="/delete/${p._id}">
          <button>Delete</button>
        </form>
      </div>
    `;
  });

  html += "</body></html>";
  res.send(html);
});

// Delete entry
app.post("/delete/:id", requireAdmin, async (req, res) => {
  await Person.findByIdAndDelete(req.params.id);
  res.redirect("/admin");
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Running on " + PORT));
