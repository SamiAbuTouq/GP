import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const SALT_ROUNDS = 12;

async function main(): Promise<void> {
  const predefinedUsers = [
    {
      email: 'admin@university.edu',
      password: 'Admin@123456',
      first_name: 'System',
      last_name: 'Admin',
      role_name: Role.ADMIN,
    },
    {
      email: 'lecturer@university.edu',
      password: 'Lecturer@123456',
      first_name: 'Jane',
      last_name: 'Doe',
      role_name: Role.LECTURER,
    },
    {
      email: 'samiabutouq117@gmail.com',
      password: 'Lecturer@123456',
      first_name: 'Sami',
      last_name: 'Abu Touq',
      role_name: Role.LECTURER,
    },
    {
      email: 'yazanbedair@gmail.com',
      password: 'Lecturer@123456',
      first_name: 'Yazan',
      last_name: 'Bedair',
      role_name: Role.LECTURER,
    },
  ];

  for (const user of predefinedUsers) {
    const password_hash = await bcrypt.hash(user.password, SALT_ROUNDS);

    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        email: user.email,
        password_hash,
        first_name: user.first_name,
        last_name: user.last_name,
        role_name: user.role_name,
      },
    });

    console.log(`Seeded user: ${user.email} [${user.role_name}]`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
