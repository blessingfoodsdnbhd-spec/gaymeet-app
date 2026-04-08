import {
  Entity,
  PrimaryColumn,
  Column,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('user_locations')
export class UserLocation {
  @PrimaryColumn('uuid')
  userId: string;

  @Index({ spatial: true })
  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  location: string;

  @Column({ type: 'double precision', default: 0 })
  latitude: number;

  @Column({ type: 'double precision', default: 0 })
  longitude: number;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
