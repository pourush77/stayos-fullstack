import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuthTables1783233000000 implements MigrationInterface {
  name = 'CreateAuthTables1783233000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('OWNER', 'ADMIN', 'MANAGER', 'FRONT_DESK', 'HOUSEKEEPING', 'MAINTENANCE', 'ACCOUNTS', 'READ_ONLY')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_status_enum" AS ENUM('ACTIVE', 'INACTIVE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_sessions_status_enum" AS ENUM('ACTIVE', 'LOCKED', 'REVOKED', 'EXPIRED')`,
    );
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "property_id" uuid,
        "name" character varying(160) NOT NULL,
        "email" character varying(254) NOT NULL,
        "password_hash" text NOT NULL,
        "role" "public"."users_role_enum" NOT NULL,
        "status" "public"."users_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "last_login_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD CONSTRAINT "FK_users_property_id"
      FOREIGN KEY ("property_id") REFERENCES "properties"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      CREATE TABLE "user_sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "property_id" uuid,
        "refresh_token_hash" text NOT NULL,
        "status" "public"."user_sessions_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "ip_address" character varying(64),
        "user_agent" character varying(512),
        "terminal_name" character varying(160),
        "last_activity_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "locked_at" TIMESTAMP WITH TIME ZONE,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "revoked_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_sessions_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_user_sessions_refresh_token_hash" ON "user_sessions" ("refresh_token_hash")`,
    );
    await queryRunner.query(`
      ALTER TABLE "user_sessions"
      ADD CONSTRAINT "FK_user_sessions_user_id"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "user_sessions"
      ADD CONSTRAINT "FK_user_sessions_property_id"
      FOREIGN KEY ("property_id") REFERENCES "properties"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_sessions" DROP CONSTRAINT "FK_user_sessions_property_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" DROP CONSTRAINT "FK_user_sessions_user_id"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_user_sessions_refresh_token_hash"`);
    await queryRunner.query(`DROP TABLE "user_sessions"`);
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_users_property_id"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."user_sessions_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."users_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
  }
}
