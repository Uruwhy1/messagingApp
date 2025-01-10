const express = require("express");
const bcrypt = require("bcryptjs");

const validateString = require("../helpers/validateString");
const prisma = require("../prismaClient");

const router = express.Router();

router.post("/create", async (req, res) => {
  const { email, password, name } = req.body;

  // validate strings
  const nameValidated = validateString(name);
  const emailValidated = validateString(email);
  const passwordValidated = validateString(password, 6);

  if (!nameValidated || !emailValidated) {
    return res
      .status(400)
      .json({ error: "All fields are required and cannot be empty" });
  }

  if (!passwordValidated) {
    return res
      .status(400)
      .json({ error: "Password must be at least 6 characters long" });
  }

  // check existing user
  const existingUser = await prisma.user.findUnique({
    where: { email: emailValidated },
  });

  if (existingUser) {
    return res.status(409).json({ error: "Email is already in use" });
  }

  // handle resposne
  try {
    const hashedPassword = await bcrypt.hash(passwordValidated, 10);

    const newUser = await prisma.user.create({
      data: {
        email: emailValidated,
        password: hashedPassword,
        name: nameValidated,
      },
    });

    const { password: _, ...userWithoutPassword } = newUser;
    res.status(201).json(userWithoutPassword);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create user" });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  console.log(email, password);
  // validate stuff
  const emailValidated = validateString(email);
  const passwordValidated = validateString(password, 6);

  if (!emailValidated || !passwordValidated) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email: emailValidated },
    });

    if (!existingUser) {
      return res.status(404).json({ error: "User not found." });
    }

    const passwordMatch = await bcrypt.compare(
      passwordValidated,
      existingUser.password
    );

    if (!passwordMatch) {
      return res.status(401).json({ error: "Wrong password." });
    }

    req.session.user = {
      id: existingUser.id,
      email: existingUser.email,
      name: existingUser.name,
    };

    res
      .status(200)
      .json({ message: "Login successful.", user: req.session.user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "An error occurred during login." });
  }
});

router.get("/session", (req, res) => {
  if (req.session && req.session.user) {
    return res.status(200).json({ user: req.session.user });
  }

  return res.status(401).json({ error: "No active session." });
});

router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to log out." });
    }

    res.clearCookie("fernandoalonso");
    res.status(200).json({ message: "Logged out successfully." });
  });
});

router.get("/friends/:userId", async (req, res) => {
  const userId = req.params.userId;

  if (isNaN(+userId) || +userId <= 0) {
    return res.status(400).json({ error: "User ID must be a valid number." });
  }

  try {
    const user = await prisma.user.findFirst({
      where: { id: +userId },
      select: { name: true },
    });

    if (!user) {
      return res.status(404).json({
        error: "User not found.",
      });
    }

    const friends = await prisma.user.findFirst({
      where: { id: +userId },
      select: {
        friends: {
          select: {
            name: true,
            id: true,
          },
        },
      },
    });

    return res.status(200).json(friends);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Something went wrong while fetching friends.",
    });
  }
});

module.exports = router;
