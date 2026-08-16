import { BadRequestException, ValidationPipe } from '@nestjs/common';
import 'reflect-metadata';
import { GroupBookingDepositPolicyType } from '../domain/group-booking-deposit-policy-type.enum';
import { UpdatePropertyDto } from './update-property.dto';

describe('UpdatePropertyDto', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  });

  const metadata = {
    type: 'body' as const,
    metatype: UpdatePropertyDto,
    data: '',
  };

  it('accepts NONE policy without value', async () => {
    await expect(
      pipe.transform(
        {
          groupBookingDepositPolicyType: GroupBookingDepositPolicyType.NONE,
        },
        metadata,
      ),
    ).resolves.toMatchObject({
      groupBookingDepositPolicyType: GroupBookingDepositPolicyType.NONE,
    });
  });

  it('accepts PERCENTAGE with value greater than 0 and at most 100', async () => {
    await expect(
      pipe.transform(
        {
          groupBookingDepositPolicyType: GroupBookingDepositPolicyType.PERCENTAGE,
          groupBookingDepositPolicyValue: 25,
        },
        metadata,
      ),
    ).resolves.toMatchObject({
      groupBookingDepositPolicyType: GroupBookingDepositPolicyType.PERCENTAGE,
      groupBookingDepositPolicyValue: 25,
    });
  });

  it('accepts FIXED_AMOUNT with value greater than 0', async () => {
    await expect(
      pipe.transform(
        {
          groupBookingDepositPolicyType: GroupBookingDepositPolicyType.FIXED_AMOUNT,
          groupBookingDepositPolicyValue: 5000,
        },
        metadata,
      ),
    ).resolves.toMatchObject({
      groupBookingDepositPolicyType: GroupBookingDepositPolicyType.FIXED_AMOUNT,
      groupBookingDepositPolicyValue: 5000,
    });
  });

  it('defers deposit business rules to the shared normalizer (shape-valid values pass the DTO)', async () => {
    // The DTO now validates shape/type only; business rules (range, required
    // value, NONE-without-value) are enforced by the shared deposit normalizer.
    await expect(
      pipe.transform(
        {
          groupBookingDepositPolicyType: GroupBookingDepositPolicyType.PERCENTAGE,
          groupBookingDepositPolicyValue: 101,
        },
        metadata,
      ),
    ).resolves.toMatchObject({
      groupBookingDepositPolicyType: GroupBookingDepositPolicyType.PERCENTAGE,
      groupBookingDepositPolicyValue: 101,
    });

    await expect(
      pipe.transform(
        {
          groupBookingDepositPolicyType: GroupBookingDepositPolicyType.FIXED_AMOUNT,
          groupBookingDepositPolicyValue: 0,
        },
        metadata,
      ),
    ).resolves.toMatchObject({
      groupBookingDepositPolicyType: GroupBookingDepositPolicyType.FIXED_AMOUNT,
      groupBookingDepositPolicyValue: 0,
    });
  });

  it('rejects a non-numeric deposit value (shape/type validation)', async () => {
    await expect(
      pipe.transform(
        {
          groupBookingDepositPolicyType: GroupBookingDepositPolicyType.FIXED_AMOUNT,
          groupBookingDepositPolicyValue: 'abc',
        },
        metadata,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects unknown fields with whitelist/forbidNonWhitelisted', async () => {
    await expect(
      pipe.transform(
        {
          groupBookingDepositPolicyType: GroupBookingDepositPolicyType.NONE,
          unknownField: true,
        },
        metadata,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('exposes group booking deposit fields in the Swagger/OpenAPI schema', () => {
    const swaggerProps: string[] =
      Reflect.getMetadata('swagger/apiModelPropertiesArray', UpdatePropertyDto.prototype) ?? [];

    expect(swaggerProps).toContain(':groupBookingDepositPolicyType');
    expect(swaggerProps).toContain(':groupBookingDepositPolicyValue');
  });
});
