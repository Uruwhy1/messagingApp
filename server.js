const express = require("express");
const userRouter = require("./routes/userRoutes");
const friendRouter = require("./routes/friendRoutes");
const app = express();

app.use(express.json());

app.use("/users", userRouter);
app.use("/friends", friendRouter);

module.exports = app;
