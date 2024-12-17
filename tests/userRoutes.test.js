const prisma = require("../prismaClient.js");
const request = require("supertest");
const bcrypt = require("bcryptjs");
const userRouter = require("../routes/userRoutes.js");
const friendRouter = require("../routes/friendRoutes.js");
const conversationRouter = require("../routes/conversationRoutes.js");

const session = require("express-session");
const express = require("express");
const app = express();

app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 },
    name: "fernandoalonso",
  })
);

app.use("/users", userRouter);
app.use("/friends", friendRouter);
app.use("/conversations", conversationRouter);

describe("User Routes", () => {
  describe("Creating Users", () => {
    afterAll(async () => {
      await prisma.$queryRaw`TRUNCATE TABLE "User" RESTART IDENTITY CASCADE;`;
      await prisma.$disconnect();
    });

    it("should create a new user with valid data", async () => {
      const response = await request(app).post("/users/create").send({
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
      const response = await request(app).post("/users/create").send({
        email: "test@example.com",
        password: "testpassword123",
        name: "Test User",
      });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe("Email is already in use");
    });

    describe("Invalid Data", () => {
      it("should fail to create if data is not present", async () => {
        const response = await request(app).post("/users/create").send({
          email: " ",
          password: " ",
          name: " ",
        });

        expect(response.status).toBe(400);
      });

      it("should fail to create if data is of wrong type", async () => {
        const response = await request(app).post("/users/create").send({
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
        const response = await request(app).post("/users/create").send({
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

  describe("Log In", () => {
    let user;
    beforeEach(async () => {
      const hashedPassword = await bcrypt.hash("password123", 10);

      user = await prisma.user.create({
        data: {
          email: "test@example.com",
          password: hashedPassword,
          name: "Test User",
        },
      });
    });

    afterEach(async () => {
      await prisma.$queryRaw`TRUNCATE TABLE "User" RESTART IDENTITY CASCADE;`;
      await prisma.$disconnect();
    });

    describe("Valid Data", () => {
      it("should log in with correct credentials", async () => {
        const response = await request(app).post("/users/login").send({
          email: "test@example.com",
          password: "password123",
        });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe("Login successful.");
      });
    });

    describe("Invalid Data", () => {
      it("should fail to log in with incorrect password", async () => {
        const response = await request(app).post("/users/login").send({
          email: "test@example.com",
          password: "wrongpassword",
        });

        expect(response.status).toBe(401);
        expect(response.body.error).toBe("Wrong password.");
      });

      it("should fail to log in with non-existent email", async () => {
        const response = await request(app).post("/users/login").send({
          email: "nonexistent@example.com",
          password: "password123",
        });

        expect(response.status).toBe(404);
        expect(response.body.error).toBe("User not found.");
      });

      it("should fail to log in if email or password is missing", async () => {
        const response = await request(app).post("/users/login").send({
          email: "",
          password: "",
        });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Email and password are required.");
      });
    });
  });

  describe("Fetching Friends", () => {
    let userWithFriends, friend1, friend2, userWithoutFriends;

    beforeAll(async () => {
      userWithFriends = await prisma.user.create({
        data: {
          email: "userWithFriends@example.com",
          password: "password123",
          name: "User With Friends",
          friends: {
            create: [
              {
                email: "friend1@example.com",
                password: "password1",
                name: "Friend 1",
              },
              {
                email: "friend2@example.com",
                password: "password2",
                name: "Friend 2",
              },
            ],
          },
        },
        include: { friends: true },
      });

      friend1 = userWithFriends.friends[0];
      friend2 = userWithFriends.friends[1];

      userWithoutFriends = await prisma.user.create({
        data: {
          email: "userWithoutFriends@example.com",
          password: "password123",
          name: "User Without Friends",
        },
      });
    });

    afterAll(async () => {
      await prisma.$queryRaw`TRUNCATE TABLE "User" RESTART IDENTITY CASCADE;`;
      await prisma.$disconnect();
    });

    it("should fetch the friends of a user", async () => {
      const response = await request(app).post(
        `/users/friends/${userWithFriends.id}`
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.friends)).toBe(true);
      expect(response.body.friends.length).toBe(2);

      expect(response.body.friends).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: friend1.name,
          }),
          expect.objectContaining({
            name: friend2.name,
          }),
        ])
      );
    });

    it("should return an empty array when user has no friends", async () => {
      const response = await request(app).post(
        `/users/friends/${userWithoutFriends.id}`
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.friends)).toBe(true);
      expect(response.body.friends.length).toBe(0);
    });

    it("should return 404 if user is not found", async () => {
      const response = await request(app).post("/users/friends/999");

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("User not found.");
    });

    it("should return 400 if userId is invalid", async () => {
      const response = await request(app).post("/users/friends/invalidId");

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("User ID must be a valid number.");
    });
  });
});

describe("Friend Routes", () => {
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

  describe("Fetching Friends", () => {
    let userWithFriends, friend1, friend2, userWithoutFriends;

    beforeAll(async () => {
      userWithFriends = await prisma.user.create({
        data: {
          email: "userWithFriends@example.com",
          password: "password123",
          name: "User With Friends",
          friends: {
            create: [
              {
                email: "friend1@example.com",
                password: "password1",
                name: "Friend 1",
              },
              {
                email: "friend2@example.com",
                password: "password2",
                name: "Friend 2",
              },
            ],
          },
        },
        include: { friends: true },
      });

      friend1 = userWithFriends.friends[0];
      friend2 = userWithFriends.friends[1];

      userWithoutFriends = await prisma.user.create({
        data: {
          email: "userWithoutFriends@example.com",
          password: "password123",
          name: "User Without Friends",
        },
      });
    });

    afterAll(async () => {
      await prisma.$queryRaw`TRUNCATE TABLE "User" RESTART IDENTITY CASCADE;`;
      await prisma.$disconnect();
    });

    it("should fetch the friends of a user", async () => {
      const response = await request(app).post(
        `/users/friends/${userWithFriends.id}`
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.friends)).toBe(true);
      expect(response.body.friends.length).toBe(2);

      expect(response.body.friends).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: friend1.name,
          }),
          expect.objectContaining({
            name: friend2.name,
          }),
        ])
      );
    });

    it("should return an empty array when user has no friends", async () => {
      const response = await request(app).post(
        `/users/friends/${userWithoutFriends.id}`
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.friends)).toBe(true);
      expect(response.body.friends.length).toBe(0);
    });

    it("should return 404 if user is not found", async () => {
      const response = await request(app).post("/users/friends/999");

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("User not found.");
    });

    it("should return 400 if userId is invalid", async () => {
      const response = await request(app).post("/users/friends/invalidId");

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("User ID must be a valid number.");
    });
  });
});

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
  });

  afterAll(async () => {
    await prisma.$queryRaw`TRUNCATE TABLE "ConversationUser" RESTART IDENTITY CASCADE;`;
    await prisma.$queryRaw`TRUNCATE TABLE "Conversation" RESTART IDENTITY CASCADE;`;
    await prisma.$queryRaw`TRUNCATE TABLE "User" RESTART IDENTITY CASCADE;`;
    await prisma.$disconnect();
  });

  describe("Creating Conversations", () => {
    describe("Valid Requests", () => {
      it("should create a new conversation and add users to it", async () => {
        const response = await request(app)
          .post("/conversations/create")
          .send({
            userIds: [user1.id, user2.id],
          });

        expect(response.status).toBe(201);
        expect(response.body).toBe(1);
      });
    });

    describe("Invalid Requets", () => {
      it("should fail to create a conversation with invalid user IDs", async () => {
        const response = await request(app)
          .post("/conversations/create")
          .send({
            userIds: [user1.id, -1],
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("One or more users not found.");
      });

      it("should fail to create a conversation with an empty array", async () => {
        const response = await request(app).post("/conversations/create").send({
          userIds: [],
        });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe(
          "A conversation must include at least two users."
        );
      });

      it("should fail to create a conversation without an users array", async () => {
        const response = await request(app)
          .post("/conversations/create")
          .send();

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

      it("should return empty array if there are no conversations", async () => {
        const response = await request(app).get(
          `/conversations/user/${user3.id}`
        );

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(0);
      });
    });

    describe("Invalid Requets", () => {
      it("should fail with invalid userId", async () => {
        const response = await request(app).get(`/conversations/user/meow`);

        expect(response.status).toBe(400);
      });

      it("should fail with unexistent user", async () => {
        const response = await request(app).get(`/conversations/user/-1`);

        expect(response.status).toBe(404);
      });
    });
  });

  describe("Fetching Specific Conversation", () => {
    let conversation, message1, message2;

    beforeAll(async () => {
      await prisma.$queryRaw`TRUNCATE TABLE "ConversationUser" RESTART IDENTITY CASCADE;`;
      await prisma.$queryRaw`TRUNCATE TABLE "Conversation" RESTART IDENTITY CASCADE;`;

      conversation = await prisma.conversation.create({
        data: {
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
      await prisma.$queryRaw`TRUNCATE TABLE "User" RESTART IDENTITY CASCADE;`;
    });

    describe("Valid Requests", () => {
      it("should fetch a conversation with its details", async () => {
        const response = await request(app).get(
          `/conversations/${conversation.id}`
        );

        expect(response.status).toBe(200);
        expect(response.body.messages.length).toBe(2);
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
});
