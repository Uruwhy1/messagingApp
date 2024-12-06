const express = require("express");
const { PrismaClient } = require("@prisma/client");

const router = express.Router();
const prisma = new PrismaClient();

router.post("/send", async (req, res) => {
  const { senderId, receiverId } = req.body;

  if (senderId === receiverId) {
    return res
      .status(400)
      .json({ error: "Cannot send a friend request to yourself" });
  }

  try {
    const existingRequest = await prisma.friendRequest.findFirst({
      where: {
        senderId,
        receiverId,
        status: "pending",
      },
    });

    if (existingRequest) {
      return res.status(409).json({ error: "Friend request already sent" });
    }

    await prisma.friendRequest.create({
      data: {
        senderId,
        receiverId,
      },
    });

    res.status(201).json({ message: "Friend request sent" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to send friend request" });
  }
});

router.post("/accept", async (req, res) => {
  const { requestId } = req.body;

  try {
    const request = await prisma.friendRequest.findUnique({
      where: { id: requestId },
    });

    if (!request || request.status !== "pending") {
      return res
        .status(404)
        .json({ error: "Friend request not found or already handled" });
    }

    await prisma.$transaction([
      prisma.friendRequest.update({
        where: { id: requestId },
        data: { status: "accepted" },
      }),
      prisma.user.update({
        where: { id: request.senderId },
        data: {
          friends: {
            connect: { id: request.receiverId },
          },
        },
      }),
      prisma.user.update({
        where: { id: request.receiverId },
        data: {
          friends: {
            connect: { id: request.senderId },
          },
        },
      }),
    ]);

    res.status(200).json({ message: "Friend request accepted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to accept friend request" });
  }
});

router.post("/reject", async (req, res) => {
  const { requestId } = req.body;

  try {
    const request = await prisma.friendRequest.findUnique({
      where: { id: requestId },
    });

    if (!request || request.status !== "pending") {
      return res
        .status(404)
        .json({ error: "Friend request not found or already handled" });
    }

    await prisma.friendRequest.update({
      where: { id: requestId },
      data: { status: "rejected" },
    });

    res.status(200).json({ message: "Friend request rejected" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to reject friend request" });
  }
});

router.get("/listRequests/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const requests = await prisma.friendRequest.findMany({
      where: {
        OR: [{ senderId: parseInt(userId) }, { receiverId: parseInt(userId) }],
      },
      include: {
        sender: true,
        receiver: true,
      },
    });

    res.status(200).json(requests);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch friend requests" });
  }
});

module.exports = router;
