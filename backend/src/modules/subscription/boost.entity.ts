import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('boosts')
export class Boost {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'timestamptz' })
  startsAt: Date;

  @Column({ type: 'timestamptz' })
  endsAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
