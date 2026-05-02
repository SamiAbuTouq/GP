import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';

import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { CoursesModule } from './courses/courses.module';
import { LecturersModule } from './lecturers/lecturers.module';
import { RoomsModule } from './rooms/rooms.module';
import { TimeslotsModule } from './timeslots/timeslots.module';
import { SemestersModule } from './semesters/semesters.module';
import { TimetablesModule } from './timetables/timetables.module';
import { WhatIfModule } from './whatif/whatif.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    // Config — load .env, make ConfigService available everywhere
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    PrismaModule,
    UsersModule,
    AuthModule,
    CoursesModule,
    LecturersModule,
    RoomsModule,
    TimeslotsModule,
    SemestersModule,
    TimetablesModule,
    WhatIfModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Apply JwtAuthGuard globally — use @Public() to opt out per route
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Apply RolesGuard globally — use @Roles() to restrict per route
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
