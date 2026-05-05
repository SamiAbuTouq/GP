// Integration test helpers for bootstrapping the full app and obtaining seeded auth tokens.
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { Role } from '@prisma/client';

type AuthTokens = {
  accessToken: string;
  refreshCookie: string;
};

function readSetCookie(header: unknown): string[] {
  if (Array.isArray(header)) {
    return header.filter((item): item is string => typeof item === 'string');
  }
  if (typeof header === 'string') {
    return [header];
  }
  return [];
}

async function loginWithCandidates(
  app: INestApplication,
  email: string,
  candidates: string[],
): Promise<AuthTokens> {
  for (const password of candidates) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password });

    if (response.status === 200 && response.body?.access_token) {
      const setCookie = readSetCookie(response.headers['set-cookie']);
      return {
        accessToken: response.body.access_token as string,
        refreshCookie: setCookie.find((c) => c.startsWith('refresh_token=')) ?? '',
      };
    }
  }

  throw new Error(`Unable to log in test user ${email} with provided password candidates.`);
}

export async function createApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.setGlobalPrefix('api/v1');
  await app.init();
  return app;
}

export async function getAdminToken(app: INestApplication): Promise<AuthTokens> {
  const prisma = app.get(PrismaService);
  const admin = await prisma.user.findFirst({
    where: { role_name: Role.ADMIN, is_active: true },
    orderBy: { user_id: 'asc' },
    select: { email: true },
  });
  if (!admin?.email) {
    throw new Error('No seeded admin account found for integration tests.');
  }

  return loginWithCandidates(app, admin.email, [
    process.env.TEST_ADMIN_PASSWORD ?? '',
    'Admin@123456',
  ]);
}

export async function getLecturerToken(app: INestApplication): Promise<AuthTokens> {
  const prisma = app.get(PrismaService);
  const lecturer = await prisma.user.findFirst({
    where: { role_name: Role.LECTURER, is_active: true },
    orderBy: { user_id: 'asc' },
    select: { email: true },
  });
  if (!lecturer?.email) {
    throw new Error('No seeded lecturer account found for integration tests.');
  }

  return loginWithCandidates(app, lecturer.email, [
    process.env.TEST_LECTURER_PASSWORD ?? '',
    'Lecturer@123456',
    'Sami1053411!',
  ]);
}
