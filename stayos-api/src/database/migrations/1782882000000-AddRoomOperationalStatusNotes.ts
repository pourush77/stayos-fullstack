import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRoomOperationalStatusNotes1782882000000 implements MigrationInterface {
  name = 'AddRoomOperationalStatusNotes1782882000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "rooms" ADD "operational_status_reason" character varying(120)`,
    );
    await queryRunner.query(`ALTER TABLE "rooms" ADD "operational_status_note" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "rooms" DROP COLUMN "operational_status_note"`);
    await queryRunner.query(`ALTER TABLE "rooms" DROP COLUMN "operational_status_reason"`);
  }
}
