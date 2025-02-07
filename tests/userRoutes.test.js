const prisma = require("../prismaClient.js");
const request = require("supertest");
const bcrypt = require("bcryptjs");

const { app } = require("./serverTests");

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
      const response = await request(app).get(
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
      const response = await request(app).get(
        `/users/friends/${userWithoutFriends.id}`
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.friends)).toBe(true);
      expect(response.body.friends.length).toBe(0);
    });

    it("should return 404 if user is not found", async () => {
      const response = await request(app).get("/users/friends/999");

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("User not found.");
    });

    it("should return 400 if userId is invalid", async () => {
      const response = await request(app).get("/users/friends/invalidId");

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("User ID must be a valid number.");
    });
  });
});
