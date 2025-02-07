const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const session = require("express-session");

const userRouter = require("../routes/userRoutes");
const friendRouter = require("../routes/friendRoutes");
const messageRouter = require("../routes/messageRoutes");
const conversationRouter = require("../routes/conversationRoutes");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const usersOnline = new Map();

wss.on("connection", (ws, req) => {
  const userId = new URL(
    req.url,
    `http://${req.headers.host}`
  ).searchParams.get("userId");

  if (userId) {
    if (!usersOnline.has(userId)) {
      usersOnline.set(userId, new Set());
    }
    usersOnline.get(userId).add(ws);

    ws.on("close", () => {
      usersOnline.get(userId).delete(ws);
      if (usersOnline.get(userId).size === 0) {
        usersOnline.delete(userId);
      }
    });
  }
});

const broadcastToUsers = (userIds, event) => {
  userIds.forEach((userId) => {
    if (usersOnline.has(userId)) {
      usersOnline.get(userId).forEach((ws) => {
        ws.send(JSON.stringify(event));
      });
    }
  });
};

app.locals.wss = wss;
app.locals.broadcastToUsers = broadcastToUsers;

app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 },
    name: "fernandoalonso",
  })
);

app.use("/users", userRouter);
app.use("/friends", friendRouter);
app.use("/conversations/:conversationId/message", messageRouter);
app.use("/conversations", conversationRouter);

module.exports = { app, wss };
