/**
 * Idempotent QA baseline seed for Hillston Resort (HILLSTON_IND).
 * Seeds ONLY manager configuration (rate plan, BAR pricing, guest/child pricing,
 * stay policies, test GST rule) via existing backend services. Creates NO
 * runtime data (no reservations/guests/folios). Resolves everything by business
 * keys (property/roomType/ratePlan codes), never hardcoded UUIDs. Safe to re-run.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { PropertyEntity } from '../src/core/properties/infrastructure/property.entity';
import { RoomTypeEntity } from '../src/core/room-types/infrastructure/room-type.entity';
import { RatePlanEntity } from '../src/core/rates/infrastructure/rate-plan.entity';
import { RatesService } from '../src/core/rates/rates.service';
import { GstService } from '../src/core/rates/gst.service';
import { PoliciesService } from '../src/core/policies/policies.service';
import { RatePlanStatus } from '../src/core/rates/domain/rate-plan-status.enum';
import { MealPlan } from '../src/core/rates/domain/meal-plan.enum';
import { ChildPricingMode } from '../src/core/rates/domain/child-pricing-mode.enum';
import { PropertyPolicyType } from '../src/core/policies/domain/property-policy-type.enum';
import { PolicyChargeMode } from '../src/core/policies/domain/policy-charge-mode.enum';
import { GroupBookingDepositPolicyType } from '../src/core/properties/domain/group-booking-deposit-policy-type.enum';
import { FolioChargeType } from '../src/core/billing/domain/folio-charge-type.enum';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const ds = app.get(DataSource);
  const rates = app.get(RatesService);
  const gst = app.get(GstService);
  const policies = app.get(PoliciesService);

  const property = await ds.getRepository(PropertyEntity).findOne({ where: { code: 'HILLSTON_IND' } });
  if (!property) throw new Error('Property HILLSTON_IND not found — cannot seed.');
  const propertyId = property.id;

  const roomTypes = await ds.getRepository(RoomTypeEntity).find({ where: { propertyId } });
  const byCode = new Map(roomTypes.map((rt) => [rt.code, rt]));
  const dlx = byCode.get('DLX');
  const ste = byCode.get('STE');
  if (!dlx || !ste) throw new Error('DLX/STE room types missing — cannot seed pricing.');

  // --- Rate Plan: BAR (ACTIVE, DEFAULT, ROOM_ONLY, refundable) ---
  const ratePlanRepo = ds.getRepository(RatePlanEntity);
  let bar = await ratePlanRepo.findOne({ where: { propertyId, code: 'BAR' } });
  if (!bar) {
    bar = await rates.createRatePlan(propertyId, {
      code: 'BAR',
      name: 'Best Available Rate',
      isDefault: true,
      status: RatePlanStatus.ACTIVE,
      mealPlan: MealPlan.ROOM_ONLY,
      refundable: true,
    });
  } else {
    bar = await rates.updateRatePlan(propertyId, bar.id, {
      name: 'Best Available Rate',
      isDefault: true,
      status: RatePlanStatus.ACTIVE,
      mealPlan: MealPlan.ROOM_ONLY,
      refundable: true,
    });
  }

  // --- BAR room pricing (base occupancy 2; no extra adult/child) ---
  await rates.upsertRatePlanRoomType(propertyId, bar.id, {
    roomTypeId: dlx.id,
    baseOccupancy: 2,
    baseRate: '5900.00',
    extraAdultCharge: '0.00',
    extraChildCharge: '0.00',
  });
  await rates.upsertRatePlanRoomType(propertyId, bar.id, {
    roomTypeId: ste.id,
    baseOccupancy: 2,
    baseRate: '7900.00',
    extraAdultCharge: '0.00',
    extraChildCharge: '0.00',
  });

  // --- Guest / child pricing (0-5 FREE, 6-11 extra child, 12-17 adult) ---
  await rates.upsertGuestPricingPolicy(propertyId, {
    ageBasedChildPricingEnabled: true,
    maximumChildAge: 17,
    isActive: true,
    childAgeBands: [
      { label: 'Infant/Child (0-5)', minAge: 0, maxAge: 5, pricingMode: ChildPricingMode.FREE, displayOrder: 1, isActive: true },
      { label: 'Child (6-11)', minAge: 6, maxAge: 11, pricingMode: ChildPricingMode.RATE_PLAN_EXTRA_CHILD, displayOrder: 2, isActive: true },
      { label: 'Teen (12-17)', minAge: 12, maxAge: 17, pricingMode: ChildPricingMode.ADULT_PRICING, displayOrder: 3, isActive: true },
    ],
  });

  // --- Stay policies (all active) ---
  await policies.upsert(propertyId, PropertyPolicyType.INDIVIDUAL_DEPOSIT, {
    isActive: true,
    depositMode: GroupBookingDepositPolicyType.PERCENTAGE,
    depositValue: 30,
  });
  await policies.upsert(propertyId, PropertyPolicyType.GROUP_DEPOSIT, {
    isActive: true,
    depositMode: GroupBookingDepositPolicyType.FIXED_AMOUNT,
    depositValue: 10000,
  });
  await policies.upsert(propertyId, PropertyPolicyType.CANCELLATION, {
    isActive: true,
    chargeMode: PolicyChargeMode.FIRST_NIGHT,
    cancellationCutoffHours: 24,
  });
  await policies.upsert(propertyId, PropertyPolicyType.NO_SHOW, {
    isActive: true,
    chargeMode: PolicyChargeMode.FIRST_NIGHT,
  });
  await policies.upsert(propertyId, PropertyPolicyType.EARLY_CHECK_IN, {
    isActive: true,
    chargeMode: PolicyChargeMode.FIXED_AMOUNT,
    chargeValue: 1000,
    graceMinutes: 60,
  });
  await policies.upsert(propertyId, PropertyPolicyType.LATE_CHECKOUT, {
    isActive: true,
    chargeMode: PolicyChargeMode.FIXED_AMOUNT,
    chargeValue: 1000,
    graceMinutes: 60,
  });

  // --- Test GST rule for ROOM (12%, HSN 996311) — upsert, no duplicates ---
  const existingTaxRules = await gst.listTaxRules(propertyId);
  const roomRule = existingTaxRules.find(
    (r) => r.chargeType === FolioChargeType.ROOM && r.name === 'Room GST — Test',
  );
  if (!roomRule) {
    await gst.createTaxRule(propertyId, {
      name: 'Room GST — Test',
      chargeType: FolioChargeType.ROOM,
      hsnSac: '996311',
      taxPercentage: '12',
      effectiveFrom: '2026-08-17',
      isActive: true,
    });
  } else {
    await gst.updateTaxRule(propertyId, roomRule.id, {
      name: 'Room GST — Test',
      chargeType: FolioChargeType.ROOM,
      hsnSac: '996311',
      taxPercentage: '12',
      slabMinAmount: undefined,
      slabMaxAmount: undefined,
      effectiveFrom: '2026-08-17',
      isActive: true,
    });
  }

  // --- Read-back verification ---
  const plans = await rates.findRatePlans(propertyId);
  const barPlan = plans.find((p) => p.code === 'BAR');
  const barRoomTypes = barPlan ? await rates.findRatePlanRoomTypes(propertyId, barPlan.id) : [];
  const gpp = await rates.getGuestPricingPolicy(propertyId).catch(() => null);
  const allPolicies = await policies.list(propertyId);
  const taxRules = await gst.listTaxRules(propertyId);

  const priceFor = (rtId: string) =>
    barRoomTypes.find((x) => x.roomTypeId === rtId)?.baseRate ?? 'MISSING';

  console.log('\n===== HILLSTON QA CONFIG VERIFICATION =====');
  console.log(`Property: ${property.name} (${property.code}) check-in ${property.checkInTime} checkout ${property.checkOutTime}`);
  console.log(`DLX: base=${dlx.baseOccupancy} max=${dlx.maxOccupancy} adults=${dlx.maxAdults} children=${dlx.maxChildren}`);
  console.log(`STE: base=${ste.baseOccupancy} max=${ste.maxOccupancy} adults=${ste.maxAdults} children=${ste.maxChildren}`);
  console.log(`BAR plan: status=${barPlan?.status} default=${barPlan?.isDefault} meal=${barPlan?.mealPlan} refundable=${barPlan?.refundable}`);
  console.log(`BAR DLX baseRate=${priceFor(dlx.id)} (expect 5900.00)`);
  console.log(`BAR STE baseRate=${priceFor(ste.id)} (expect 7900.00)`);
  console.log(`Child bands: ${gpp?.childAgeBands?.length ?? 0} (expect 3); maxChildAge=${gpp?.policy?.maximumChildAge}`);
  console.log(`Policies (${allPolicies.length}, expect 6):`);
  allPolicies
    .sort((a, b) => a.policyType.localeCompare(b.policyType))
    .forEach((p) =>
      console.log(
        `  - ${p.policyType} active=${p.isActive} deposit=${p.depositMode ?? '-'}/${p.depositValue ?? '-'} charge=${p.chargeMode ?? '-'}/${p.chargeValue ?? '-'} cutoff=${p.cancellationCutoffHours ?? '-'} grace=${p.graceMinutes ?? '-'}`,
      ),
    );
  console.log(`Tax rules (${taxRules.length}, expect 1):`);
  taxRules.forEach((t) =>
    console.log(`  - ${t.name} ${t.chargeType} ${t.taxPercentage}% HSN=${t.hsnSac} from=${t.effectiveFrom} active=${t.isActive}`),
  );
  console.log('===========================================\n');

  await app.close();
}

main().catch((err) => {
  console.error('QA seed failed:', err);
  process.exit(1);
});
