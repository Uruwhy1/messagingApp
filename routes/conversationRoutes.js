const express = require("express");
const { PrismaClient } = require("@prisma/client");
const authenticateUser = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

router.post("/create", authenticateUser, async (req, res) => {
  let { userIds, name, picture } = req.body;
  const adminId = req.user.id;
  if (!Array.isArray(userIds) || userIds.length < 2) {
    return res
      .status(400)
      .json({ error: "A conversation must include at least two users." });
  }

  if (!userIds.every((id) => typeof id === "number" && !isNaN(id))) {
    return res
      .status(400)
      .json({ error: "All user IDs must be valid numbers." });
  }

  if (!userIds.includes(adminId)) {
    userIds.push(adminId);
  }

  if (!name) {
    name = "";
  } else {
    name = name.toString();
  }

  if (!picture) {
    picture = "";
  } else {
    picture = picture.toString();
  }

  try {
    const existingUsers = await prisma.user.findMany({
      where: { id: { in: userIds } },
    });

    if (existingUsers.length !== userIds.length) {
      return res.status(400).json({ error: "One or more users not found." });
    }

    const adminWithFriends = await prisma.user.findUnique({
      where: { id: adminId },
      include: { friends: { select: { id: true } } },
    });

    if (!adminWithFriends) {
      return res.status(404).json({ error: "Admin user not found." });
    }

    const adminFriendIds = adminWithFriends.friends.map((friend) => friend.id);

    const nonAdminUserIds = userIds.filter((id) => id !== adminId);
    const areAllFriends = nonAdminUserIds.every((id) =>
      adminFriendIds.includes(id)
    );

    if (!areAllFriends) {
      return res.status(400).json({
        error: "All users in the conversation must be friends with the admin.",
      });
    }

    // do not allow duplicate chats (with two people)
    if (userIds.length == 2) {
      const existingConversation = await prisma.conversation.findFirst({
        where: {
          users: {
            every: {
              userId: { in: userIds },
            },
          },
        },
        include: {
          users: {
            select: name,
          },
        },
      });

      if (existingConversation?.users?.length == 2) {
        return res.status(400).json({
          error: "Existing conversation.",
        });
      }
    }

    const conversation = await prisma.conversation.create({
      data: {
        admin: { connect: { id: adminId } },
        users: {
          create: userIds.map((userId) => ({
            user: { connect: { id: userId } },
          })),
        },
        name: name,
        picture: picture,
      },
      include: {
        users: {
          select: {
            user: {
              select: {
                id: true,
                name: true,
                picture: true,
              },
            },
          },
        },
        messages: {},
      },
    });

    const response = formatConversation(conversation, false);

    const broadcastToUsers = req.app.locals.broadcastToUsers;
    const stringIds = conversation.users.map((cu) => cu.user.id.toString());

    broadcastToUsers(stringIds, {
      type: "NEW_CONVERSATION",
      data: response,
    });

    return res.status(201).json(conversation.id);
  } catch (error) {
    console.error("Failed to create conversation:", error);
    res
      .status(500)
      .json({ error: "An error occurred while creating the conversation." });
  }
});

router.delete(
  "/:conversationId/users/:userId",
  authenticateUser,
  async (req, res) => {
    const { conversationId, userId } = req.params;
    const requestId = req.user.id;

    if (isNaN(+conversationId) || isNaN(+requestId) || isNaN(+userId)) {
      return res.status(400).json({ error: "IDs should be integers." });
    }

    try {
      const conversation = await prisma.conversation.findUnique({
        where: { id: parseInt(conversationId) },
        select: {
          id: true,
          adminId: true,
          users: {
            select: {
              userId: true,
            },
          },
        },
      });

      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found." });
      }

      const isUserInConversation = conversation.users.some(
        (user) => user.userId === parseInt(userId)
      );

      if (!isUserInConversation) {
        return res
          .status(400)
          .json({ error: "User is not part of this conversation." });
      }

      if (
        conversation.adminId !== parseInt(requestId) &&
        parseInt(requestId) !== parseInt(userId)
      ) {
        return res.status(403).json({
          error: "Only the admin or the user themselves can remove users.",
        });
      }

      await prisma.conversationUser.deleteMany({
        where: {
          conversationId: parseInt(conversationId),
          userId: parseInt(userId),
        },
      });

      res.status(200).json({ message: "User removed from the conversation." });
    } catch (error) {
      console.error("Error removing user from conversation:", error);
      res.status(500).json({ error: "Internal server error." });
    }
  }
);

router.get("/user/:userId", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);

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
            userId: userId,
          },
        },
      },
      include: {
        _count: {
          select: {
            messages: true,
          },
        },
        messages: {
          take: 1,
          orderBy: {
            date: "desc",
          },
          include: {
            author: true,
          },
        },
        users: {
          include: {
            user: {
              select: { name: true, id: true, picture: true },
            },
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    const response = conversations.map((conversation) =>
      formatConversation(conversation)
    );
    return res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching user conversations:", error);
    return res.status(500).json({ error: "Internal server error" });
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
          include: {
            user: {
              select: { name: true, id: true, picture: true },
            },
          },
        },
        messages: {
          orderBy: { date: "asc" },
          include: {
            author: true,
          },
        },
      },
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    res.json(formatConversation(conversation, true));
  } catch (error) {
    console.error("Error fetching conversation:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

function formatConversation(conversation, includeAllMessages = false) {
  const baseStructure = {
    id: conversation.id,
    title: conversation.name,
    picture: conversation.picture,
    updatedAt: conversation.updatedAt,
    users: conversation.users.map((u) => u.user),
  };

  if (includeAllMessages) {
    return {
      ...baseStructure,
      messages: conversation.messages.map((message) => ({
        content: message.content,
        createdAt: message.date,
        authorId: message.authorId,
        id: message.id,
      })),
    };
  }

  const lastMessage = conversation.messages[0] || null;
  return {
    ...baseStructure,
    lastMessage: lastMessage
      ? {
          content: lastMessage.content,
          createdAt: lastMessage.date,
          user: {
            name: lastMessage.author.name,
            id: lastMessage.authorId,
          },
        }
      : null,
  };
}

module.exports = router;
