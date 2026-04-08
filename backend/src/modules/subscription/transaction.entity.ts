import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 20 })
  type: 'subscription' | 'boost' | 'refund';

  @Column({ type: 'int' })
  amountCents: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Column({ type: 'varchar', length: 20, default: 'completed' })
  status: 'pending' | 'completed' | 'failed' | 'refunded';

  @Column({ type: 'varchar', length: 10 })
  platform: 'ios' | 'android' | 'web';

  @Column({ type: 'varchar', length: 255, nullable: true })
  platformTxnId: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
