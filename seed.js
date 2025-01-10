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
          picture:
            "https://images.pexels.com/photos/2071882/pexels-photo-2071882.jpeg?auto=compress&cs=tinysrgb&dpr=1&w=500",
        },
        {
          name: "Bob Smith",
          email: "bob@example.com",
          password: "password123",
          description: "I am Bob.",
        },
        {
          name: "Charlie Brown",
          email: "charlie@example.com",
          password: "password123",
          picture:
            "https://media.istockphoto.com/id/475728270/photo/guinea-fun.jpg?s=612x612&w=0&k=20&c=EFLFP3gU2OSbfEotMxTHyuojTIkNKy52GpDIQB5bwyM=",
        },
        {
          name: "Diana Prince",
          email: "diana@example.com",
          password: "password123",
          picture:
            "https://plus.unsplash.com/premium_photo-1694819488591-a43907d1c5cc?fm=jpg&q=60&w=3000&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8Y3V0ZSUyMGRvZ3xlbnwwfHwwfHx8MA%3D%3D",
        },
        {
          name: "Edward Stark",
          email: "edward@example.com",
          password: "password123",
          picture:
            "https://images.squarespace-cdn.com/content/v1/5369465be4b0507a1fd05af0/1528837069483-LD1R6EJDDHBY8LBPVHIU/randall-ruiz-272502.jpg",
        },
      ].map(async (userData) => {
        const hashedPassword = await bcrypt.hash(userData.password, 10);
        return prisma.user.create({
          data: {
            name: userData.name,
            email: userData.email,
            password: hashedPassword,
            picture: userData.picture,
            description: userData.description,
          },
        });
      })
    );

    console.log("Created users:", users.map((u) => u.name).join(", "));

    // Establish friendships
    await Promise.all([
      prisma.user.update({
        where: { id: users[0].id }, // Alice
        data: {
          friends: { connect: [{ id: users[1].id }, { id: users[2].id }] }, // Bob and Charlie
        },
      }),
      prisma.user.update({
        where: { id: users[1].id }, // Bob
        data: {
          friends: { connect: [{ id: users[0].id }, { id: users[3].id }] }, // Alice and Diana
        },
      }),
      prisma.user.update({
        where: { id: users[2].id }, // Charlie
        data: {
          friends: { connect: [{ id: users[0].id }] }, // Alice
        },
      }),
      prisma.user.update({
        where: { id: users[3].id }, // Diana
        data: {
          friends: { connect: [{ id: users[1].id }] }, // Bob
        },
      }),
      prisma.user.update({
        where: { id: users[4].id }, // Edward
        data: {
          friends: { connect: [] }, // No friends yet
        },
      }),
    ]);

    console.log("Friendships established");

    // Create conversations
    const conversations = await Promise.all([
      // Group chat with more than two users
      prisma.conversation.create({
        data: {
          admin: { connect: { id: users[0].id } }, // Alice is admin
          users: {
            create: [
              { user: { connect: { id: users[0].id } } }, // Alice
              { user: { connect: { id: users[1].id } } }, // Bob
              { user: { connect: { id: users[2].id } } }, // Charlie
            ],
          },
          name: "Study Group", // Group chat has a name
        },
      }),
      // Private conversation between Alice and Bob (no name)
      prisma.conversation.create({
        data: {
          admin: { connect: { id: users[0].id } },
          users: {
            create: [
              { user: { connect: { id: users[0].id } } },
              { user: { connect: { id: users[1].id } } },
            ],
          },
          name: "", // No name for private conversations
        },
      }),
      // Private conversation between Bob and Diana (no name)
      prisma.conversation.create({
        data: {
          admin: { connect: { id: users[1].id } },
          users: {
            create: [
              { user: { connect: { id: users[1].id } } },
              { user: { connect: { id: users[3].id } } },
            ],
          },
          name: "", // No name for private conversations
        },
      }),
    ]);

    console.log("Created conversations:", conversations.length);

    // Add some initial messages
    const messages = await Promise.all([
      prisma.message.create({
        data: {
          content: "Welcome to the Study Group!",
          authorId: users[0].id,
          conversationId: conversations[0].id,
        },
      }),
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
seedDatabase();
