import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Unique,
} from 'typeorm';

@Entity('matches')
@Unique(['user1Id', 'user2Id'])
export class Match {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user1Id: string;

  @Column({ type: 'uuid' })
  user2Id: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
