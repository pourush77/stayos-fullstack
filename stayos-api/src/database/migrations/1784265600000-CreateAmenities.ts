import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAmenities1784265600000 implements MigrationInterface {
  name = 'CreateAmenities1784265600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (
      (await queryRunner.hasTable('amenities')) &&
      (await queryRunner.hasTable('room_type_amenities'))
    ) {
      return;
    }

    await queryRunner.query(`CREATE TYPE "public"."amenities_category_enum" AS ENUM('CONNECTIVITY', 'COMFORT', 'ENTERTAINMENT', 'SAFETY', 'SERVICE', 'ACCESSIBILITY')`);
    await queryRunner.query(`
      CREATE TABLE "amenities" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "property_id" uuid NOT NULL,
        "code" character varying(64) NOT NULL,
        "label" character varying(120) NOT NULL,
        "category" "public"."amenities_category_enum" NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_amenities_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_amenities_property_code" ON "amenities" ("property_id", "code")`);
    await queryRunner.query(`ALTER TABLE "amenities" ADD CONSTRAINT "FK_amenities_property_id" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`
      CREATE TABLE "room_type_amenities" (
        "room_type_id" uuid NOT NULL,
        "amenity_id" uuid NOT NULL,
        CONSTRAINT "PK_room_type_amenities" PRIMARY KEY ("room_type_id", "amenity_id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_room_type_amenities_amenity_id" ON "room_type_amenities" ("amenity_id")`);
    await queryRunner.query(`ALTER TABLE "room_type_amenities" ADD CONSTRAINT "FK_room_type_amenities_room_type_id" FOREIGN KEY ("room_type_id") REFERENCES "room_types"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "room_type_amenities" ADD CONSTRAINT "FK_room_type_amenities_amenity_id" FOREIGN KEY ("amenity_id") REFERENCES "amenities"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`
      INSERT INTO "amenities" ("property_id", "code", "label", "category")
      SELECT property.id, amenity.code, amenity.label, amenity.category::"public"."amenities_category_enum"
      FROM "properties" property
      CROSS JOIN (VALUES
        ('WIFI', 'WiFi', 'CONNECTIVITY'),
        ('AC', 'AC', 'COMFORT'),
        ('TV', 'TV', 'ENTERTAINMENT'),
        ('MINI-FRIDGE', 'Mini-Fridge', 'COMFORT'),
        ('SAFE', 'Safe', 'SAFETY'),
        ('IRON', 'Iron', 'COMFORT'),
        ('HAIR-DRYER', 'Hair-Dryer', 'COMFORT'),
        ('KETTLE', 'Kettle', 'COMFORT'),
        ('ROOM-SERVICE', 'Room-Service', 'SERVICE'),
        ('BALCONY', 'Balcony', 'COMFORT'),
        ('NON-SMOKING', 'Non-Smoking', 'COMFORT'),
        ('BABY-COT', 'Baby-Cot', 'ACCESSIBILITY')
      ) AS amenity(code, label, category)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "room_type_amenities" DROP CONSTRAINT "FK_room_type_amenities_amenity_id"`);
    await queryRunner.query(`ALTER TABLE "room_type_amenities" DROP CONSTRAINT "FK_room_type_amenities_room_type_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_room_type_amenities_amenity_id"`);
    await queryRunner.query(`DROP TABLE "room_type_amenities"`);
    await queryRunner.query(`ALTER TABLE "amenities" DROP CONSTRAINT "FK_amenities_property_id"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_amenities_property_code"`);
    await queryRunner.query(`DROP TABLE "amenities"`);
    await queryRunner.query(`DROP TYPE "public"."amenities_category_enum"`);
  }
}
