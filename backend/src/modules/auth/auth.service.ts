import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../user/user.entity';
import { UserProfile } from '../user/user-profile.entity';
import { UserLocation } from '../user/user-location.entity';
import { UserMetrics } from '../user/user-metrics.entity';
import { UserPreferences } from '../user/user-preferences.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserProfile)
    private readonly profileRepository: Repository<UserProfile>,
    @InjectRepository(UserLocation)
    private readonly locationRepository: Repository<UserLocation>,
    @InjectRepository(UserMetrics)
    private readonly metricsRepository: Repository<UserMetrics>,
    @InjectRepository(UserPreferences)
    private readonly preferencesRepository: Repository<UserPreferences>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Email or phone is required');
    }

    const existing = await this.userRepository.findOne({
      where: [
        ...(dto.email ? [{ email: dto.email }] : []),
        ...(dto.phone ? [{ phone: dto.phone }] : []),
      ],
    });

    if (existing) {
      throw new ConflictException('User already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    // 1. Create auth row
    const user = this.userRepository.create({
      email: dto.email,
      phone: dto.phone,
      passwordHash,
    });
    await this.userRepository.save(user);

    // 2. Create child rows (profile, location, metrics, preferences)
    // Note: In production, the DB trigger handles this automatically.
    // This is a safety fallback for when synchronize:true bypasses triggers.
    await Promise.all([
      this.profileRepository.save(
        this.profileRepository.create({
          userId: user.id,
          nickname: dto.nickname,
        }),
      ),
      this.locationRepository.save(
        this.locationRepository.create({ userId: user.id }),
      ),
      this.metricsRepository.save(
        this.metricsRepository.create({ userId: user.id }),
      ),
      this.preferencesRepository.save(
        this.preferencesRepository.create({ userId: user.id }),
      ),
    ]);

    return this.generateTokens(user, dto.nickname);
  }

  async login(dto: LoginDto) {
    const user = await this.userRepository.findOne({
      where: [
        ...(dto.email ? [{ email: dto.email }] : []),
        ...(dto.phone ? [{ phone: dto.phone }] : []),
      ],
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last_active on login
    await this.metricsRepository.update(user.id, { lastActive: new Date() });

    const profile = await this.profileRepository.findOne({
      where: { userId: user.id },
    });

    return this.generateTokens(user, profile?.nickname);
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });

      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user || user.refreshToken !== refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const profile = await this.profileRepository.findOne({
        where: { userId: user.id },
      });

      return this.generateTokens(user, profile?.nickname);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string) {
    await this.userRepository.update(userId, { refreshToken: undefined });
    await this.metricsRepository.update(userId, { isOnline: false });
  }

  private async generateTokens(user: User, nickname?: string) {
    const payload = { sub: user.id, email: user.email };

    const accessToken = this.jwtService.sign(payload);

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN', '7d'),
    });

    await this.userRepository.update(user.id, { refreshToken });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        nickname: nickname ?? 'User',
        isPremium: user.isPremium,
      },
    };
  }
}
