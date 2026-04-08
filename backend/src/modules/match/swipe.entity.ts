import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Unique,
} from 'typeorm';

@Entity('swipes')
@Unique(['swiperId', 'swipedId'])
export class Swipe {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  swiperId: string;

  @Column({ type: 'uuid' })
  swipedId: string;

  @Column({ type: 'varchar', length: 4 })
  direction: 'like' | 'pass';

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
