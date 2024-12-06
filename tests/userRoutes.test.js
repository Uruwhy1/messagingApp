const prisma = require("../prismaClient.js");
const request = require("supertest");
const userRouter = require("../routes/userRoutes.js");
const friendRouter = require("../routes/friendRoutes.js");

const express = require("express");
const app = express();

app.use(express.json());
app.use("/users", userRouter);
app.use("/friends", friendRouter);

describe("Creating Users", () => {
  describe("Valid Data", () => {
    afterAll(async () => {
      await prisma.$queryRaw`TRUNCATE TABLE "User" RESTART IDENTITY CASCADE;`;
      await prisma.$disconnect();
    });

    it("should create a new user with valid data", async () => {
      const response = await request(app).post("/users/createUser").send({
        email: "test@example.com",
        password: "testpassword123",
        name: "Test User",
      });

      expect(response.status).toBe(201);
      expect(response.body.email).toBe("test@example.com");
      expect(response.body.name).toBe("Test User");
      expect(response.body.password).toBeUndefined();
    });

    it("should fail to create duplicate user", async () => {
      const response = await request(app).post("/users/createUser").send({
        email: "test@example.com",
        password: "testpassword123",
        name: "Test User",
      });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe("Email is already in use");
    });
  });

  describe("Invalid Data", () => {
    it("should fail to create if data is not present", async () => {
      const response = await request(app).post("/users/createUser").send({
        email: " ",
        password: " ",
        name: " ",
      });

      expect(response.status).toBe(400);
    });

    it("should fail to create if data is of wrong type", async () => {
      const response = await request(app).post("/users/createUser").send({
        email: "email@.com",
        password: "sasf123",
        name: 23,
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe(
        "All fields are required and cannot be empty"
      );
    });

    it("should fail to create if password is too short", async () => {
      const response = await request(app).post("/users/createUser").send({
        name: "Facundo",
        email: "email@.com",
        password: "xd",
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe(
        "Password must be at least 6 characters long"
      );
    });
  });
});

describe("Friend Requests", () => {
  let user1, user2;

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
  });

  afterAll(async () => {
    await prisma.$queryRaw`TRUNCATE TABLE "FriendRequest" RESTART IDENTITY CASCADE;`;
    await prisma.$queryRaw`TRUNCATE TABLE "User" RESTART IDENTITY CASCADE;`;
    await prisma.$disconnect();
  });

  describe("Sending Friend Request", () => {
    beforeEach(async () => {
      await prisma.$queryRaw`TRUNCATE TABLE "FriendRequest" RESTART IDENTITY CASCADE;`;
    });

    it("should send a friend request", async () => {
      const response = await request(app).post("/friends/send").send({
        senderId: user1.id,
        receiverId: user2.id,
      });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe("Friend request sent");
    });

    it("should not send duplicate friend requests", async () => {
      await prisma.friendRequest.create({
        data: { senderId: user1.id, receiverId: user2.id },
      });

      const response = await request(app).post("/friends/send").send({
        senderId: user1.id,
        receiverId: user2.id,
      });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe("Friend request already sent");
    });

    it("should not be able to send friend request to yourself", async () => {
      const response = await request(app).post("/friends/send").send({
        senderId: user1.id,
        receiverId: user1.id,
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe(
        "Cannot send a friend request to yourself"
      );
    });
  });

  describe("Accepting Friend Request", () => {
    let requestId;

    beforeEach(async () => {
      const request = await prisma.friendRequest.create({
        data: { senderId: user1.id, receiverId: user2.id },
      });
      requestId = request.id;
    });

    it("should accept a friend request", async () => {
      const response = await request(app)
        .post("/friends/accept")
        .send({ requestId });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Friend request accepted");
    });

    it("should fail to accept nonexistant request", async () => {
      const requestId = -1;
      const response = await request(app)
        .post("/friends/accept")
        .send({ requestId });

      expect(response.status).toBe(404);
    });
  });

  describe("Rejecting Friend Request", () => {
    let requestId;

    beforeEach(async () => {
      const request = await prisma.friendRequest.create({
        data: { senderId: user2.id, receiverId: user1.id },
      });
      requestId = request.id;
    });

    it("should reject a friend request", async () => {
      const response = await request(app)
        .post("/friends/reject")
        .send({ requestId });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Friend request rejected");
    });

    it("should fail to reject nonexistant request", async () => {
      const requestId = -1;
      const response = await request(app)
        .post("/friends/reject")
        .send({ requestId });

      expect(response.status).toBe(404);
    });
  });

  describe("Listing Friend Requests", () => {
    beforeEach(async () => {
      await prisma.$queryRaw`TRUNCATE TABLE "FriendRequest" RESTART IDENTITY CASCADE;`;
      await prisma.friendRequest.create({
        data: { senderId: user1.id, receiverId: user2.id },
      });
    });

    it("should list all friend requests for a user", async () => {
      const response = await request(app).get(
        `/friends/listRequests/${user1.id}`
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0].senderId).toBe(user1.id);
    });
  });
});
