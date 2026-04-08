import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('messages')
@Index(['matchId', 'createdAt'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  matchId: string;

  @Column({ type: 'uuid' })
  senderId: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'boolean', default: false })
  isRead: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
