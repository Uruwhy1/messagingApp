const prisma = require("../prismaClient.js");
const request = require("supertest");

const { app } = require("./serverTests");

describe("Conversations Routes", () => {
  let user1, user2, user3;

  beforeAll(async () => {
    user1 = await prisma.user.create({
      data: {
        email: "user1@example.com",
        password: "password1",
        name: "User 1",
      },
    });

    user2 = await prisma.user.create({
      data: {
        email: "user2@example.com",
        password: "password2",
        name: "User 2",
      },
    });

    user3 = await prisma.user.create({
      data: {
        email: "user3@example.com",
        password: "password3",
        name: "User 3",
      },
    });

    user4 = await prisma.user.create({
      data: {
        email: "user4@example.com",
        password: "password4",
        name: "Friendless User",
      },
    });

    await prisma.user.update({
      where: { id: user1.id },
      data: {
        friends: {
          connect: [{ id: user2.id }, { id: user3.id }],
        },
      },
    });

    await prisma.user.update({
      where: { id: user2.id },
      data: {
        friends: {
          connect: [{ id: user1.id }],
        },
      },
    });

    await prisma.user.update({
      where: { id: user3.id },
      data: {
        friends: {
          connect: [{ id: user1.id }],
        },
      },
    });
  });

  afterAll(async () => {
    await prisma.$queryRaw`TRUNCATE TABLE "ConversationUser" RESTART IDENTITY CASCADE;`;
    await prisma.$queryRaw`TRUNCATE TABLE "Conversation" RESTART IDENTITY CASCADE;`;
    await prisma.$queryRaw`TRUNCATE TABLE "User" RESTART IDENTITY CASCADE;`;
    await prisma.$queryRaw`TRUNCATE TABLE "FriendRequest" RESTART IDENTITY CASCADE;`;
    await prisma.$disconnect();
  });

  describe("Creating Conversations", () => {
    describe("Valid Requests", () => {
      it("should create a new conversation and add users to it", async () => {
        const response = await request(app)
          .post("/conversations/create")
          .send({
            userIds: [user1.id, user2.id],
            adminId: user1.id,
          });

        expect(response.status).toBe(201);
      });
    });

    describe("Invalid Requests", () => {
      it("should fail to create a conversation with invalid user IDs", async () => {
        const response = await request(app)
          .post("/conversations/create")
          .send({
            userIds: [user1.id, "Xd"],
            adminId: user1.id,
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("All user IDs must be valid numbers.");
      });

      it("should fail to create a conversation if users are not friends", async () => {
        const response = await request(app)
          .post("/conversations/create")
          .send({
            userIds: [user1.id, user4.id],
            adminId: user1.id,
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe(
          "All users in the conversation must be friends with the admin."
        );
      });
      it("should fail to create a conversation with non-existant user IDs", async () => {
        const response = await request(app)
          .post("/conversations/create")
          .send({
            userIds: [user1.id, -1],
            adminId: user1.id,
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("One or more users not found.");
      });

      it("should fail to create a conversation without an admin ID", async () => {
        const response = await request(app)
          .post("/conversations/create")
          .send({
            userIds: [user1.id, user2.id],
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe(
          "Admin ID must be one of the users in the conversation."
        );
      });

      it("should fail to create a conversation with an empty array", async () => {
        const response = await request(app).post("/conversations/create").send({
          userIds: [],
          adminId: user1.id,
        });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe(
          "A conversation must include at least two users."
        );
      });

      it("should fail to create a conversation when admin is not part of users", async () => {
        const response = await request(app)
          .post("/conversations/create")
          .send({
            userIds: [user2.id, user3.id],
            adminId: user1.id,
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe(
          "Admin ID must be one of the users in the conversation."
        );
      });

      it("should fail to create a conversation without a users array", async () => {
        const response = await request(app).post("/conversations/create").send({
          adminId: user1.id,
        });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe(
          "A conversation must include at least two users."
        );
      });
    });
  });

  describe("Fetching by User", () => {
    beforeAll(async () => {
      await prisma.$queryRaw`TRUNCATE TABLE "ConversationUser" RESTART IDENTITY CASCADE;`;
      await prisma.$queryRaw`TRUNCATE TABLE "Conversation" RESTART IDENTITY CASCADE;`;

      await request(app)
        .post("/conversations/create")
        .send({
          userIds: [user1.id, user2.id],
          adminId: user1.id,
        });
    });

    describe("Valid Requests", () => {
      it("should fetch user conversations", async () => {
        const response = await request(app).get(
          `/conversations/user/${user1.id}`
        );

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(1);
      });

      it("should return an empty array if the user has no conversations", async () => {
        const response = await request(app).get(
          `/conversations/user/${user3.id}`
        );

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(0);
      });
    });

    describe("Invalid Requests", () => {
      it("should fail with a non-numeric userId", async () => {
        const response = await request(app).get(`/conversations/user/meow`);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Invalid user ID");
      });

      it("should fail when the user does not exist", async () => {
        const response = await request(app).get(`/conversations/user/-1`);

        expect(response.status).toBe(404);
        expect(response.body.error).toBe("User not found");
      });
    });
  });

  describe("Fetching Specific Conversation", () => {
    let conversation, message1, message2;

    beforeAll(async () => {
      await prisma.$queryRaw`TRUNCATE TABLE "ConversationUser" RESTART IDENTITY CASCADE;`;
      await prisma.$queryRaw`TRUNCATE TABLE "Conversation" RESTART IDENTITY CASCADE;`;
      await prisma.$queryRaw`TRUNCATE TABLE "Message" RESTART IDENTITY CASCADE;`;

      conversation = await prisma.conversation.create({
        data: {
          admin: { connect: { id: user1.id } },
          users: {
            create: [{ userId: user1.id }, { userId: user2.id }],
          },
        },
      });

      message1 = await prisma.message.create({
        data: {
          content: "Hello",
          authorId: user1.id,
          conversationId: conversation.id,
        },
      });

      message2 = await prisma.message.create({
        data: {
          content: "Hi there",
          authorId: user2.id,
          conversationId: conversation.id,
        },
      });
    });

    afterAll(async () => {
      await prisma.$queryRaw`TRUNCATE TABLE "Message" RESTART IDENTITY CASCADE;`;
      await prisma.$queryRaw`TRUNCATE TABLE "ConversationUser" RESTART IDENTITY CASCADE;`;
      await prisma.$queryRaw`TRUNCATE TABLE "Conversation" RESTART IDENTITY CASCADE;`;
    });

    describe("Valid Requests", () => {
      it("should fetch a conversation with its details", async () => {
        const response = await request(app).get(
          `/conversations/${conversation.id}`
        );

        expect(response.status).toBe(200);
        expect(response.body.messages.length).toBe(2);
        expect(response.body.id).toBe(conversation.id);
      });

      it("should return messages in ascending order by date", async () => {
        const response = await request(app).get(
          `/conversations/${conversation.id}`
        );

        expect(response.status).toBe(200);
        expect(response.body.messages[0].content).toBe("Hello");
        expect(response.body.messages[1].content).toBe("Hi there");
      });
    });

    describe("Invalid Requests", () => {
      it("should return 400 for invalid conversation ID", async () => {
        const response = await request(app).get("/conversations/invalid");

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Invalid conversation ID");
      });

      it("should return 404 for non-existent conversation", async () => {
        const response = await request(app).get("/conversations/9999");

        expect(response.status).toBe(404);
        expect(response.body.error).toBe("Conversation not found");
      });
    });
  });

  describe("Deleting User from Conversation", () => {
    let conversationId;
    beforeEach(async () => {
      await prisma.$queryRaw`TRUNCATE TABLE "ConversationUser" RESTART IDENTITY CASCADE;`;
      await prisma.$queryRaw`TRUNCATE TABLE "Conversation" RESTART IDENTITY CASCADE;`;

      const createdConversation = await request(app)
        .post("/conversations/create")
        .send({
          userIds: [user1.id, user2.id],
          adminId: user1.id,
        });

      conversationId = createdConversation.body;
    });

    describe("Valid Requests", () => {
      it("admin should be able to remove users", async () => {
        const response = await request(app)
          .delete(`/conversations/${conversationId}/users/${user2.id}`)
          .send({
            requestId: user1.id,
          });

        expect(response.status).toBe(200);
      });

      it("user should be able to leave", async () => {
        const response = await request(app)
          .delete(`/conversations/${conversationId}/users/${user2.id}`)
          .send({
            requestId: user2.id,
          });

        expect(response.status).toBe(200);
      });
    });

    describe("Invalid Requests", () => {
      it("should not be able to remove other user if not admin", async () => {
        const response = await request(app)
          .delete(`/conversations/${conversationId}/users/${user1.id}`)
          .send({
            requestId: user2.id,
          });

        expect(response.status).toBe(403);
      });

      it("invalid userId", async () => {
        const response = await request(app)
          .delete(`/conversations/${conversationId}/users/-1`)
          .send({
            requestId: user2.id,
          });

        const response2 = await request(app)
          .delete(`/conversations/${conversationId}/users/asdsad`)
          .send({
            requestId: user2.id,
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe(
          "User is not part of this conversation."
        );

        expect(response2.status).toBe(400);
        expect(response2.body.error).toBe("IDs should be integers.");
      });
    });
  });
});
