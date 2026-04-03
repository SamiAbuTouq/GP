import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto, UpdatePreferencesDto } from './dto/update-user.dto';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(user_id: number): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { user_id },
    });

    if (!user) {
      throw new NotFoundException(`User with id ${user_id} not found`);
    }

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async getProfile(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { user_id: userId },
      include: {
        lecturer: {
          include: {
            department: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }

    return {
      user_id: user.user_id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role_name,
      avatar_url: user.avatar_url,
      department: user.lecturer?.department?.dept_name || null,
      theme_preference: user.theme_preference || 'system',
      date_format: user.date_format || 'DD/MM/YYYY',
      time_format: user.time_format || '24',
    };
  }

  async updateProfile(userId: number, dto: UpdateProfileDto) {
    let uploadedAvatarUrl: string | undefined = undefined;
    
    if (dto.avatar_base64) {
      try {
        const result = await cloudinary.uploader.upload(dto.avatar_base64, {
          folder: 'avatars',
        });
        uploadedAvatarUrl = result.secure_url;
      } catch (error) {
        console.error('Error uploading avatar to cloudinary:', error);
        throw new BadRequestException('Failed to upload avatar to Cloudinary. Please check Cloudinary configuration.');
      }
    }

    const user = await this.prisma.user.update({
      where: { user_id: userId },
      data: {
        ...(dto.first_name && { first_name: dto.first_name }),
        ...(dto.last_name && { last_name: dto.last_name }),
        ...(uploadedAvatarUrl && { avatar_url: uploadedAvatarUrl }),
      },
    });

    return {
      user_id: user.user_id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role_name,
      avatar_url: user.avatar_url,
    };
  }

  async updatePreferences(userId: number, dto: UpdatePreferencesDto) {
    const user = await this.prisma.user.update({
      where: { user_id: userId },
      data: {
        ...(dto.theme_preference && { theme_preference: dto.theme_preference }),
        ...(dto.date_format && { date_format: dto.date_format }),
        ...(dto.time_format && { time_format: dto.time_format }),
      },
    });

    return {
      theme_preference: user.theme_preference || 'system',
      date_format: user.date_format || 'DD/MM/YYYY',
      time_format: user.time_format || '24',
    };
  }
}
