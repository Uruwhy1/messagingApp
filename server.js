const express = require("express");
const session = require("express-session");
const http = require("http");
const WebSocket = require("ws");
const cors = require("cors");

const userRouter = require("./routes/userRoutes");
const friendRouter = require("./routes/friendRoutes");
const messageRouter = require("./routes/messageRoutes");
const conversationRouter = require("./routes/conversationRoutes");

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

    broadcastToUsers([...usersOnline.keys()], {
      type: "USER_STATUS_CHANGE",
      data: {
        userId: userId,
        status: "online",
      },
    });

    ws.send(
      JSON.stringify({
        type: "INITIAL_STATUS",
        data: {
          onlineUsers: [...usersOnline.keys()],
        },
      })
    );

    ws.on("close", () => {
      usersOnline.get(userId).delete(ws);
      if (usersOnline.get(userId).size === 0) {
        usersOnline.delete(userId);
        broadcastToUsers([...usersOnline.keys()], {
          type: "USER_STATUS_CHANGE",
          data: {
            userId: userId,
            status: "offline",
          },
        });
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

const allowedOrigins = process.env.FRONTEND;

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 1000 * 60 * 60 * 24,
      httpOnly: true,
    },
    name: "fernandoalonso",
  })
);

app.use("/users", userRouter);
app.use("/friends", friendRouter);
app.use("/conversations/:conversationId/message", messageRouter);
app.use("/conversations", conversationRouter);
app.get("/users/online", (req, res) => {
  res.json({
    onlineUsers: [...usersOnline.keys()],
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

module.exports = { app, wss };
