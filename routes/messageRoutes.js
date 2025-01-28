const express = require("express");
const { PrismaClient } = require("@prisma/client");

const router = express.Router({ mergeParams: true });
const prisma = new PrismaClient();

router.post("/", async (req, res) => {
  let { conversationId } = req.params;
  let { content } = req.body;
  let authorId = req.headers["userid"];

  try {
    if (!authorId || !conversationId || !content) {
      console.log(content, authorId, conversationId);
      return res.status(400).json({ error: "Missing required fields" });
    }

    authorId = +authorId;
    conversationId = +conversationId;

    if (isNaN(authorId) || isNaN(conversationId)) {
      return res.status(400).json({ error: "ID should be a number." });
    }

    const user = await prisma.user.findUnique({
      where: { id: authorId },
    });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { users: true },
    });
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const isUserInConversation = conversation.users.some(
      (cu) => cu.userId === authorId
    );
    if (!isUserInConversation) {
      return res.status(403).json({ error: "User not in this conversation" });
    }

    const newMessage = await prisma.message.create({
      data: {
        content,
        authorId,
        conversationId,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const userIds = conversation.users.map((cu) => cu.userId.toString());
    const broadcastToUsers = req.app.locals.broadcastToUsers;

    const response = {
      id: newMessage.id,
      content: newMessage.content,
      createdAt: newMessage.date,
      authorId: newMessage.author.id,
      authorName: newMessage.author.name,
      conversation: newMessage.conversationId,
    };

    broadcastToUsers(userIds, {
      type: "NEW_MESSAGE",
      data: { conversationId, message: response },
    });

    res.status(201).json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

module.exports = router;
