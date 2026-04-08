import {
  Entity,
  PrimaryColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

@Entity('user_preferences')
export class UserPreferences {
  @PrimaryColumn('uuid')
  userId: string;

  @Column({ type: 'int', default: 18 })
  ageMin: number;

  @Column({ type: 'int', default: 99 })
  ageMax: number;

  @Column({ type: 'int', default: 50 })
  distanceMaxKm: number;

  @Column({ type: 'text', array: true, default: '{}' })
  tagsPreference: string[];

  @Column({ type: 'boolean', default: false })
  showOnlineOnly: boolean;

  @Column({ type: 'boolean', default: false })
  hideDistance: boolean;

  @Column({ type: 'boolean', default: false })
  hideOnlineStatus: boolean;

  @Column({ type: 'boolean', default: false })
  hideFromNearby: boolean;

  // ── Location feature prefs ────────────────────────────────────────────────
  @Column({ type: 'boolean', default: false })
  stealthMode: boolean;

  @Column({ type: 'double precision', nullable: true })
  virtualLat: number | null;

  @Column({ type: 'double precision', nullable: true })
  virtualLng: number | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  virtualLocationLabel: string | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
