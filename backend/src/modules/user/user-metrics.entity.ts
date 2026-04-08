import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('user_metrics')
export class UserMetrics {
  @PrimaryColumn('uuid')
  userId: string;

  @Column({ type: 'int', default: 0 })
  dailySwipes: number;

  @Column({ type: 'date', default: () => 'CURRENT_DATE' })
  swipesReset: Date;

  @Column({ type: 'boolean', default: false })
  isOnline: boolean;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  lastActive: Date;

  @Column({ type: 'bigint', default: 0 })
  totalSwipes: number;

  @Column({ type: 'bigint', default: 0 })
  totalMatches: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  deviceToken: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
