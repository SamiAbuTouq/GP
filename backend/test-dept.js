const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.department.findMany().then(console.log).finally(() => prisma.$disconnect());
