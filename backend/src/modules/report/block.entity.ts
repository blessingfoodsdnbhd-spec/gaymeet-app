import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Unique,
} from 'typeorm';

@Entity('blocks')
@Unique(['blockerId', 'blockedId'])
export class Block {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  blockerId: string;

  @Column({ type: 'uuid' })
  blockedId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
