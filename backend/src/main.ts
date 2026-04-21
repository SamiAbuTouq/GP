import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";

import { json, urlencoded } from 'express';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  // Cookie parser middleware
  app.use(cookieParser());

  // Global validation pipe — strips unknown fields, enforces DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip unknown properties
      forbidNonWhitelisted: true, // throw on unknown properties
      transform: true, // auto-transform payloads to DTO instances
    }),
  );

  // CORS — configure allowed origins via CORS_ORIGIN env var (comma-separated).
  // Never hardcode tunnel or third-party domains here.
  const rawOrigins = process.env.CORS_ORIGIN ?? "http://localhost:3000";
  const allowedOrigins = rawOrigins.split(",").map((o) => o.trim()).filter(Boolean);
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  

  // API prefix
  app.setGlobalPrefix("api/v1");

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`Application running on http://localhost:${port}/api/v1`);
}

bootstrap();
