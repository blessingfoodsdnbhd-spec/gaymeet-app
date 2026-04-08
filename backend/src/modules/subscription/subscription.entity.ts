import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 20 })
  plan: 'monthly' | 'yearly';

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: 'active' | 'expired' | 'cancelled' | 'refunded';

  @Column({ type: 'varchar', length: 10 })
  platform: 'ios' | 'android' | 'web';

  @Column({ type: 'varchar', length: 255, nullable: true })
  platformTxnId: string;

  @Column({ type: 'timestamptz' })
  startsAt: Date;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  cancelledAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
