// 📦 Required modules and environment
require("dotenv").config();
const mongoUrl = process.env.MONGO_URI;
const dbName = process.env.MONGO_DB;

const express = require("express");
const http = require("http");
const session = require("express-session");
const { Server } = require("socket.io");
const sharedSession = require("express-socket.io-session");
const path = require("path");
const axios = require("axios");
const cors = require("cors");
const { MongoClient } = require("mongodb");
const crypto = require("crypto");
const bcrypt = require("bcrypt");

const SessionManager = require("./frontend/src/logic/SessionManager");
const { getCS2RankFromSteam } = require("./frontend/src/utils/steam");

// Setup server
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const initSocket = require("./sockets");


// Session middleware
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "frontend", "public")));
app.use(sessionMiddleware);
io.use(sharedSession(sessionMiddleware, { autoSave: true }));

// MongoDB connection
let db;
MongoClient.connect(mongoUrl, { useUnifiedTopology: true })
  .then((client) => {
    console.log("Connected to MongoDB");
    db = client.db(dbName);
    SessionManager.setDB(db);
    SessionManager.reset();
    initSocket(io, db);
  })
  .catch((err) => console.error("MongoDB connection error:", err));

// Middleware
function isAuthenticated(req, res, next) {
  if (req.session?.userId) return next();
  res.redirect("/login.html");
}

function isAdmin(req, res, next) {
  if (req.session?.role === 3) return next();
  return res.status(403).send("Forbidden");
}

const publicPaths = [
  "/login.html",
  "/register.html",
  "/api/login",
  "/api/register",
];
app.use((req, res, next) => {
  if (publicPaths.includes(req.path) || req.path.startsWith("/socket.io")) {
    return next();
  }
  isAuthenticated(req, res, next);
});

// Auth endpoints
app.get("/api/session-info", (req, res) => {
  if (!req.session?.userId) return res.status(401).json({ error: "Not logged in" });
  res.json({
    userId: req.session.userId,
    username: req.session.username,
    role: req.session.role,
  });
});

app.post("/api/register", async (req, res) => {
  try {
    const { username, password, steamId, name, birth_date, gender, address } = req.body;
    const token = crypto.randomBytes(20).toString("hex");
    const hashedPassword = await bcrypt.hash(password, 10);
    const cs2Rank = await getCS2RankFromSteam(steamId, 0, io);

    const person = { name, birth_date, gender, address, profile_picture: "" };
    const personResult = await db.collection("person").insertOne(person);

    const user = {
      username,
      password: hashedPassword,
      steamId,
      rank: cs2Rank,
      verification_token: token,
      is_verified: true,
      role: 1,
      person_id: personResult.insertedId,
    };

    await db.collection("users").insertOne(user);
    res.status(200).json({ message: "Registration successful!", rank: cs2Rank });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ error: "Registration failed. Please try again." });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await db.collection("users").findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid login" });
    }
    req.session.userId = user._id;
    req.session.username = user.username;
    req.session.role = user.role;
    res.json({ message: "Login successful", user });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login error" });
  }
});

// Admin panel
app.get("/admin", isAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, "/views/admin.html"));
});

app.post("/admin/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await db.collection("users").findOne({ username });
  if (!user || user.password !== password || user.role !== 3) {
    return res.status(403).send("Forbidden");
  }
  req.session.userId = user._id;
  req.session.username = user.username;
  req.session.role = user.role;
  req.session.isAdmin = true;
  res.redirect("/admin");
});

app.get("/admin/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login.html");
  });
});

// Matchmaking
app.post("/api/start-match", async (req, res) => {
  const { map, teamA, teamB } = req.body;
  try {
    const response = await axios.post(
      "https://dathost.net/api/0.1/cs2/matches",
      {
        game_server_id: process.env.DATHOST_SERVER_ID,
        map,
        team1: { name: "Team Alpha", players: teamA.map(p => ({ steam_id: p.steamId })) },
        team2: { name: "Team Beta", players: teamB.map(p => ({ steam_id: p.steamId })) },
      },
      {
        auth: {
          username: process.env.DATHOST_API_USERNAME,
          password: process.env.DATHOST_API_PASSWORD,
        },
      }
    );
    res.json({ message: "Match started", match: response.data });
  } catch (err) {
    console.error("Start match failed:", err);
    res.status(500).json({ error: "Match start failed" });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
