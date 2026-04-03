const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const user = await prisma.user.update({
      where: { email: 'samiabutouq116@gmail.com' },
      data: {
        reset_token: 'test',
        reset_token_expiry: new Date(),
      }
    });
    console.log("Success:", user);
  } catch (e) {
    console.error("Prisma error:", e);
  }
}
test();
