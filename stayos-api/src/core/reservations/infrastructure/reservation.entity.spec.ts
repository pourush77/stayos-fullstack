import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { AccommodationPostingMode } from '../domain/accommodation-posting-mode.enum';
import { ReservationEntity } from './reservation.entity';

describe('ReservationEntity', () => {
  it('maps accommodationPostingMode as a typed enum defaulting to upfront full stay', () => {
    const columns = getMetadataArgsStorage().columns.filter(
      (column) => column.target === ReservationEntity,
    );

    const accommodationPostingMode = columns.find(
      (column) => column.propertyName === 'accommodationPostingMode',
    );

    expect(accommodationPostingMode?.options).toMatchObject({
      type: 'enum',
      enum: AccommodationPostingMode,
      name: 'accommodation_posting_mode',
      default: AccommodationPostingMode.UPFRONT_FULL_STAY,
    });
  });
});
