import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { FolioChargeEntity } from './folio-charge.entity';

describe('FolioChargeEntity', () => {
  it('maps serviceDate as a nullable service-night discriminator', () => {
    const columns = getMetadataArgsStorage().columns.filter(
      (column) => column.target === FolioChargeEntity,
    );

    const serviceDate = columns.find((column) => column.propertyName === 'serviceDate');

    expect(serviceDate?.options).toMatchObject({
      type: 'date',
      name: 'service_date',
      nullable: true,
    });
  });
});
