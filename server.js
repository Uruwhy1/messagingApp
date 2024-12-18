const express = require("express");
const session = require("express-session");

const userRouter = require("./routes/userRoutes");
const friendRouter = require("./routes/friendRoutes");
const messageRouter = require("./routes/messageRoutes");
const conversationRouter = require("./routes/conversationRoutes");

const app = express();

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

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

module.exports = app;
