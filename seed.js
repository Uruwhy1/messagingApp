const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

async function seedDatabase() {
  try {
    // Clear existing data
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE "Message" RESTART IDENTITY CASCADE;`
    );
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE "ConversationUser" RESTART IDENTITY CASCADE;`
    );
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE "Conversation" RESTART IDENTITY CASCADE;`
    );
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE "User" RESTART IDENTITY CASCADE;`
    );

    console.log("Cleared existing data");

    // Create users with hashed passwords
    const users = await Promise.all(
      [
        {
          name: "Alice Johnson",
          email: "alice@example.com",
          password: "password123",
        },
        {
          name: "Bob Smith",
          email: "bob@example.com",
          password: "password123",
        },
        {
          name: "Charlie Brown",
          email: "charlie@example.com",
          password: "password123",
        },
        {
          name: "Diana Prince",
          email: "diana@example.com",
          password: "password123",
        },
        {
          name: "Edward Stark",
          email: "edward@example.com",
          password: "password123",
        },
      ].map(async (userData) => {
        const hashedPassword = await bcrypt.hash(userData.password, 10);
        return prisma.user.create({
          data: {
            name: userData.name,
            email: userData.email,
            password: hashedPassword,
          },
        });
      })
    );

    console.log("Created users:", users.map((u) => u.name).join(", "));

    // Create some conversations
    const conversations = await Promise.all([
      // Group conversation
      prisma.conversation.create({
        data: {
          admin: { connect: { id: users[0].id } },
          users: {
            create: users.map((user) => ({
              user: { connect: { id: user.id } },
            })),
          },
          name: "League of Legends Group Chat",
        },
      }),
      // Private conversation between Alice and Bob
      prisma.conversation.create({
        data: {
          admin: { connect: { id: users[0].id } },
          users: {
            create: [
              { user: { connect: { id: users[0].id } } },
              { user: { connect: { id: users[1].id } } },
            ],
          },
          name: "Alice & Bob <3",
        },
      }),
    ]);

    console.log("Created conversations:", conversations.length);

    // Add some initial messages
    const messages = await Promise.all([
      // Messages in group conversation
      prisma.message.create({
        data: {
          content: "Hello everyone! Welcome to the group chat!",
          authorId: users[0].id,
          conversationId: conversations[0].id,
        },
      }),
      prisma.message.create({
        data: {
          content: "Hi Alice! Thanks for creating this group!",
          authorId: users[1].id,
          conversationId: conversations[0].id,
        },
      }),
      // Messages in private conversation
      prisma.message.create({
        data: {
          content: "Hey Bob, how are you?",
          authorId: users[0].id,
          conversationId: conversations[1].id,
        },
      }),
      prisma.message.create({
        data: {
          content: "Doing great Alice, thanks for asking!",
          authorId: users[1].id,
          conversationId: conversations[1].id,
        },
      }),
    ]);

    console.log("Created messages:", messages.length);

    console.log("Database seeded successfully!");

    // Return created data for reference
    return {
      users,
      conversations,
      messages,
    };
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Execute the seed function
seedDatabase()
  .then((data) => {
    console.log("Seeding complete!");
    console.log("Created users:", data.users.length);
    console.log("Created conversations:", data.conversations.length);
    console.log("Created messages:", data.messages.length);
  })
  .catch((error) => {
    console.error("Failed to seed database:", error);
    process.exit(1);
  });
