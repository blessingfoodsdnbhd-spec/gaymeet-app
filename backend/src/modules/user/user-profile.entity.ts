import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('user_profiles')
export class UserProfile {
  @PrimaryColumn('uuid')
  userId: string;

  @Column({ type: 'varchar', length: 50 })
  nickname: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  avatarUrl: string;

  @Column({ type: 'text', nullable: true })
  bio: string;

  @Column({ type: 'date', nullable: true })
  birthday: Date;

  @Column({ type: 'text', array: true, default: '{}' })
  tags: string[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
