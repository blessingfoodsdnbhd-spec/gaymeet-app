import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('plate_messages')
export class PlateMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Denormalised plate number — fast lookup without joining license_plates */
  @Index()
  @Column({ type: 'varchar', length: 20 })
  plateNumber: string;

  /** Always stored for moderation — never exposed to the plate owner */
  @Column({ type: 'uuid' })
  senderId: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'boolean', default: false })
  isRead: boolean;

  @Column({ type: 'boolean', default: false })
  isReported: boolean;

  @Column({ type: 'boolean', default: false })
  isBlocked: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
