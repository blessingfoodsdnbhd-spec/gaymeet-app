import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * AUTH-ONLY table. Lightweight (~200 bytes per row).
 * Profile, location, metrics live in separate tables
 * to isolate hot writes from stable reads.
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // --- Credentials ---
  @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
  email: string;

  @Column({ type: 'varchar', length: 20, unique: true, nullable: true })
  phone: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  passwordHash: string;

  // --- OAuth ---
  @Column({ type: 'varchar', length: 20, default: 'local' })
  provider: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  providerId: string;

  // --- Session ---
  @Column({ type: 'varchar', length: 500, nullable: true })
  refreshToken: string;

  // --- Account state ---
  @Column({ type: 'boolean', default: false })
  isPremium: boolean;

  @Column({ type: 'boolean', default: false })
  isVerified: boolean;

  @Column({ type: 'boolean', default: false })
  isBanned: boolean;

  @Column({ type: 'boolean', default: false })
  isShadowBanned: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  deviceId: string;

  // --- Timestamps ---
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
