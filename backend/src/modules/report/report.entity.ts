import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('reports')
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  reporterId: string;

  @Column({ type: 'uuid' })
  reportedId: string;

  @Column({ type: 'varchar', length: 50 })
  reason: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
