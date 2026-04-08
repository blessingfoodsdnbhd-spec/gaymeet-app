import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('shouts')
export class Shout {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 200 })
  content: string;

  @Column({ type: 'double precision' })
  latitude: number;

  @Column({ type: 'double precision' })
  longitude: number;

  @Index()
  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
