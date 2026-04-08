import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('license_plates')
export class LicensePlate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Nullable until a user claims this plate */
  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  /** Always uppercase, no spaces */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 20 })
  plateNumber: string;

  @Column({ type: 'boolean', default: false })
  isVerified: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true })
  carImageUrl: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
