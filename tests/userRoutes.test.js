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
