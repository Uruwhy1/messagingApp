const request = require("supertest");
const prisma = require("../prismaClient.js");
const { app } = require("./serverTests");

describe("Message Routes", () => {
  let user1, user2, conversation;

  beforeAll(async () => {
    user1 = await prisma.user.create({
      data: {
        email: "user1@example.com",
        password: "password123",
        name: "User One",
      },
    });

    user2 = await prisma.user.create({
      data: {
        email: "user2@example.com",
        password: "password456",
        name: "User Two",
      },
    });

    conversation = await prisma.conversation.create({
      data: {
        admin: { connect: { id: user1.id } },
        users: {
          create: [{ userId: user1.id }, { userId: user2.id }],
        },
      },
    });
  });

  afterAll(async () => {
    await prisma.$queryRaw`TRUNCATE TABLE "Message" RESTART IDENTITY CASCADE;`;
    await prisma.$queryRaw`TRUNCATE TABLE "ConversationUser" RESTART IDENTITY CASCADE;`;
    await prisma.$queryRaw`TRUNCATE TABLE "Conversation" RESTART IDENTITY CASCADE;`;
    await prisma.$queryRaw`TRUNCATE TABLE "User" RESTART IDENTITY CASCADE;`;
    await prisma.$disconnect();
  });

  describe("Creating Messages", () => {
    describe("Valid Requests", () => {
      it("should create a message successfully", async () => {
        const response = await request(app)
          .post(`/conversations/${conversation.id}/message`)
          .set("userid", user1.id.toString())
          .send({
            content: "Hello, this is a test message",
          });

        expect(response.status).toBe(201);
        expect(response.body.content).toBe("Hello, this is a test message");
        expect(response.body.authorId).toBe(user1.id);
        expect(response.body.conversationId).toBe(conversation.id);
        expect(response.body.author.name).toBe("User One");
      });

      it("should allow multiple messages in the same conversation", async () => {
        await request(app)
          .post(`/conversations/${conversation.id}/message`)
          .set("userid", user1.id.toString())
          .send({
            content: "First message",
          });

        const response = await request(app)
          .post(`/conversations/${conversation.id}/message`)
          .set("userid", user2.id.toString())
          .send({
            content: "Second message",
          });

        expect(response.status).toBe(201);
        expect(response.body.content).toBe("Second message");
        expect(response.body.authorId).toBe(user2.id);
      });
    });

    describe("Invalid Requests", () => {
      it("should fail if required fields are missing", async () => {
        const response = await request(app)
          .post(`/conversations/${conversation.id}/message`)
          .set("userid", user1.id.toString())
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Missing required fields");
      });

      it("should fail if authorId is not a number", async () => {
        const response = await request(app)
          .post(`/conversations/${conversation.id}/message`)
          .set("userid", "not-a-number")
          .send({
            content: "Test message",
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("ID should be a number.");
      });

      it("should fail if user does not exist", async () => {
        const response = await request(app)
          .post(`/conversations/${conversation.id}/message`)
          .set("userid", "99999")
          .send({
            content: "Test message",
          });

        expect(response.status).toBe(404);
        expect(response.body.error).toBe("User not found");
      });

      it("should fail if conversation does not exist", async () => {
        const response = await request(app)
          .post("/conversations/99999/message")
          .set("userid", user1.id.toString())
          .send({
            content: "Test message",
          });

        expect(response.status).toBe(404);
        expect(response.body.error).toBe("Conversation not found");
      });

      it("should fail if user is not in the conversation", async () => {
        const user3 = await prisma.user.create({
          data: {
            email: "user3@example.com",
            password: "password789",
            name: "User Three",
          },
        });

        const response = await request(app)
          .post(`/conversations/${conversation.id}/message`)
          .set("userid", user3.id.toString())
          .send({
            content: "Test message",
          });

        expect(response.status).toBe(403);
        expect(response.body.error).toBe("User not in this conversation");
      });
    });
  });
});
