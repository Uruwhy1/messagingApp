const express = require("express");
const { PrismaClient } = require("@prisma/client");

const router = express.Router();
const prisma = new PrismaClient();

router.post("/create", async (req, res) => {
  const { userIds } = req.body;

  if (!Array.isArray(userIds) || userIds.length < 2) {
    return res
      .status(400)
      .json({ error: "A conversation must include at least two users." });
  }

  try {
    const existingUsers = await prisma.user.findMany({
      where: { id: { in: userIds } },
    });

    if (existingUsers.length !== userIds.length) {
      return res.status(400).json({ error: "One or more users not found." });
    }

    const conversation = await prisma.conversation.create({
      data: {
        users: {
          create: userIds.map((userId) => ({
            user: { connect: { id: userId } },
          })),
        },
      },
    });

    res.status(201).json(conversation.id);
  } catch (error) {
    console.error("Failed to create conversation:", error);
    res
      .status(500)
      .json({ error: "An error occurred while creating the conversation." });
  }
});

router.get("/user/:userId", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);

    if (isNaN(userId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const userExists = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!userExists) {
      return res.status(404).json({ error: "User not found" });
    }

    const conversations = await prisma.conversation.findMany({
      where: {
        users: {
          some: {
            id: userId,
          },
        },
      },
      include: {
        users: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    res.json(conversations);
  } catch (error) {
    console.error("Error fetching user conversations:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:conversationId", async (req, res) => {
  try {
    const conversationId = parseInt(req.params.conversationId);

    if (isNaN(conversationId)) {
      return res.status(400).json({ error: "Invalid conversation ID" });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        users: {
          select: {
            id: true,
            name: true,
          },
        },
        messages: {
          orderBy: { date: "asc" },
          take: 20,
          select: {
            id: true,
            content: true,
            authorId: true,
            date: true,
          },
        },
      },
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    res.json(conversation);
  } catch (error) {
    console.error("Error fetching conversation:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
