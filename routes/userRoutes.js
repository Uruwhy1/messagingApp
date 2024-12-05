const express = require("express");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const router = express.Router();
const prisma = new PrismaClient();
const validateString = require("../helpers/validateString");

router.post("/createUser", async (req, res) => {
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

module.exports = router;
