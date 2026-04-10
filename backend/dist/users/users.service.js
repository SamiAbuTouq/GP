"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const config_1 = require("@nestjs/config");
const cloudinary_1 = require("cloudinary");
let UsersService = class UsersService {
    constructor(prisma, configService) {
        this.prisma = prisma;
        this.configService = configService;
    }
    configureCloudinary() {
        const cloudName = this.configService.get('CLOUDINARY_CLOUD_NAME');
        const apiKey = this.configService.get('CLOUDINARY_API_KEY');
        const apiSecret = this.configService.get('CLOUDINARY_API_SECRET');
        if (!cloudName || !apiKey || !apiSecret) {
            throw new common_1.BadRequestException('Cloudinary is not configured. Missing CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, or CLOUDINARY_API_SECRET.');
        }
        cloudinary_1.v2.config({
            cloud_name: cloudName,
            api_key: apiKey,
            api_secret: apiSecret,
        });
    }
    async findById(user_id) {
        const user = await this.prisma.user.findUnique({
            where: { user_id },
        });
        if (!user) {
            throw new common_1.NotFoundException(`User with id ${user_id} not found`);
        }
        return user;
    }
    async findByEmail(email) {
        return this.prisma.user.findUnique({
            where: { email },
        });
    }
    async getProfile(userId) {
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
            throw new common_1.NotFoundException(`User with id ${userId} not found`);
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
    async updateProfile(userId, dto) {
        let uploadedAvatarUrl = undefined;
        if (dto.avatar_base64) {
            try {
                this.configureCloudinary();
                const result = await cloudinary_1.v2.uploader.upload(dto.avatar_base64, {
                    folder: 'avatars',
                });
                uploadedAvatarUrl = result.secure_url;
            }
            catch (error) {
                console.error('Error uploading avatar to cloudinary:', error);
                const cloudinaryMessage = error instanceof Error
                    ? error.message
                    : 'Unknown Cloudinary upload error';
                throw new common_1.BadRequestException(`Failed to upload avatar to Cloudinary: ${cloudinaryMessage}`);
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
    async updatePreferences(userId, dto) {
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
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService])
], UsersService);
//# sourceMappingURL=users.service.js.map