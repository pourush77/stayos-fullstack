# StayOS PostgreSQL Backup & Recovery Runbook

## 1. Purpose

This document defines the backup, restore, verification, and recovery procedure for the StayOS PostgreSQL database.

The objective is to ensure that critical PMS data can be recovered following:

- database corruption;
- accidental data loss;
- infrastructure failure;
- failed deployment or migration;
- server replacement;
- disaster recovery events.

This procedure applies to:

- local development;
- staging;
- production.

> Database backups may contain guest, reservation, billing, invoice, payment, operational, and other sensitive information. Backup files must never be committed to Git or stored in an unsecured location.

---

## 2. Database Configuration

StayOS database connectivity is environment-driven.

The application uses the following environment variables:

```text
DATABASE_HOST
DATABASE_PORT
DATABASE_NAME
DATABASE_USERNAME
DATABASE_PASSWORD
DATABASE_SSL
```

Environment-specific values must come from environment configuration or an approved secrets-management mechanism.

Credentials must never be hard-coded into scripts, documentation, or source control.

---

## 3. Backup Format

StayOS PostgreSQL backups should use PostgreSQL's custom archive format:

```bash
pg_dump -F c
```

Example:

```bash
pg_dump \
  -h "$DATABASE_HOST" \
  -p "$DATABASE_PORT" \
  -U "$DATABASE_USERNAME" \
  -d "$DATABASE_NAME" \
  -F c \
  -f "stayos-backup.dump"
```

The custom format is preferred because it:

- supports `pg_restore`;
- allows archive inspection;
- supports selective restoration;
- supports compression;
- provides greater recovery flexibility than a plain SQL dump.

Passwords must be supplied securely through the environment, `.pgpass`, secret injection, or the infrastructure's approved secret mechanism.

---

## 4. Local Development — Windows

Local development may run PostgreSQL directly as a Windows service rather than through Docker.

Example PostgreSQL installation:

```text
C:\Program Files\PostgreSQL\18\bin
```

### Create Backup

From the StayOS repository:

```powershell
New-Item -ItemType Directory -Force ..\backups | Out-Null

& "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" `
  -h $env:DATABASE_HOST `
  -p $env:DATABASE_PORT `
  -U $env:DATABASE_USERNAME `
  -d $env:DATABASE_NAME `
  -F c `
  -f "..\backups\stayos-backup.dump"
```

The password should be supplied securely for the current shell/session when required.

Do not place passwords directly in this runbook.

### Verify Backup File

```powershell
Get-Item ..\backups\stayos-backup.dump
```

Confirm that:

- the file exists;
- its size is non-zero;
- its timestamp matches the expected backup operation.

### Inspect Backup Archive

```powershell
& "C:\Program Files\PostgreSQL\18\bin\pg_restore.exe" `
  -l "..\backups\stayos-backup.dump" `
  | Select-Object -First 20
```

A valid archive should return PostgreSQL archive metadata and TOC entries without an error.

---

## 5. Restore Verification

A backup must not be considered recovery-ready merely because `pg_dump` completed.

A restore test should periodically be performed against a separate temporary database.

Never test restoration by overwriting the active StayOS database.

### Create Temporary Database

Database creation is an administrative operation and may require a PostgreSQL administrative account.

Example:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\createdb.exe" `
  -h localhost `
  -p 5432 `
  -U postgres `
  stayos_restore_test
```

### Restore Backup

For a disaster-recovery test, use an account with sufficient database restoration privileges.

Example:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\pg_restore.exe" `
  -h localhost `
  -p 5432 `
  -U postgres `
  -d stayos_restore_test `
  --no-owner `
  "..\backups\stayos-backup.dump"
```

A successful restore should complete without `pg_restore` errors.

Do not assume a backup is valid if restore errors are reported, even if some objects or data were restored successfully.

---

## 6. Restored Data Verification

After restoration, verify both schema availability and representative business data.

Example:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" `
  -h localhost `
  -p 5432 `
  -U postgres `
  -d stayos_restore_test `
  -c "SELECT COUNT(*) AS properties FROM properties; SELECT COUNT(*) AS rooms FROM rooms; SELECT COUNT(*) AS reservations FROM reservations; SELECT COUNT(*) AS guests FROM guests; SELECT COUNT(*) AS invoices FROM invoices;"
```

At minimum, recovery verification should confirm that critical tables are readable, including where applicable:

- properties;
- rooms;
- room types;
- guests;
- reservations;
- inventory;
- folios;
- charges;
- payments;
- invoices;
- audit records.

Counts should be checked for plausibility against the source environment when performing a formal recovery drill.

A successful SQL query proves that the restored objects are accessible; it does not by itself prove complete business-level consistency.

---

## 7. Remove Temporary Restore Database

After verification:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\dropdb.exe" `
  -h localhost `
  -p 5432 `
  -U postgres `
  stayos_restore_test
```

The temporary recovery database must not remain active unnecessarily.

Never run this command against the active StayOS database.

---

## 8. Docker / Staging

In staging, PostgreSQL may run inside Docker.

The same PostgreSQL backup and recovery principles apply, but commands may execute:

- inside the PostgreSQL container; or
- from another trusted host/container with PostgreSQL client tools and network access to the database.

Example backup pattern:

```bash
docker exec <postgres-container> \
  pg_dump \
  -U "$DATABASE_USERNAME" \
  -d "$DATABASE_NAME" \
  -F c \
  > stayos-backup.dump
```

Container names, database credentials, and infrastructure-specific configuration must come from the deployment environment.

Do not hard-code them in source control.

A staging recovery drill should restore the backup into a separate database or isolated PostgreSQL instance before validating it.

---

## 9. Production / Managed PostgreSQL

Production may use:

- managed PostgreSQL;
- AWS RDS PostgreSQL;
- PostgreSQL running on a VM;
- another approved PostgreSQL-compatible infrastructure.

The logical backup procedure remains based on:

```text
PostgreSQL
    ↓
pg_dump
    ↓
Protected backup storage
    ↓
pg_restore
    ↓
Isolated recovery database
    ↓
Verification
```

Managed infrastructure may additionally provide:

- automated snapshots;
- point-in-time recovery;
- multi-AZ/high-availability replication;
- retention policies;
- automated backup lifecycle management.

Provider-level backups should complement, not automatically replace, a tested logical recovery strategy unless the production disaster-recovery design explicitly establishes otherwise.

Production recovery procedures must be tested before they are relied upon during an incident.

---

## 10. Backup Security

Database dumps must be treated as sensitive data.

The following controls are required:

1. Never commit database dumps to Git.
2. Never place database credentials inside backup scripts committed to source control.
3. Restrict access to production backups.
4. Encrypt production backups at rest.
5. Use encrypted transport when transferring backups.
6. Define and enforce a retention policy.
7. Remove temporary recovery databases after testing.
8. Avoid restoring production data into uncontrolled developer environments.
9. Store production backups only in approved infrastructure.

The repository should ignore local dump files:

```gitignore
# Local database backups
backups/
*.dump
```

---

## 11. Recovery Roles

The StayOS application database account should follow least-privilege principles.

Application runtime credentials do not need administrative capabilities such as:

```text
CREATEDB
SUPERUSER
```

Administrative operations such as:

- creating recovery databases;
- dropping recovery databases;
- full disaster restoration;
- ownership repair;
- infrastructure recovery;

should use an appropriately privileged database administration account.

This separation reduces the impact of compromised application credentials.

---

## 12. Recovery Validation Checklist

A recovery drill is considered successful when all required checks pass:

```text
[ ] Backup command completes successfully
[ ] Backup file exists
[ ] Backup file has non-zero size
[ ] pg_restore can inspect the archive
[ ] Isolated recovery database can be created
[ ] Backup restores without pg_restore errors
[ ] Critical tables exist
[ ] Representative business data is readable
[ ] Data counts are plausible
[ ] Temporary recovery database is removed
[ ] Backup file is excluded from source control
```

For production readiness, the recovery procedure should additionally validate:

```text
[ ] Production backup schedule exists
[ ] Backup retention policy exists
[ ] Backup storage is encrypted
[ ] Backup access is restricted
[ ] Restore procedure has been tested against production-like infrastructure
[ ] Recovery ownership is defined
[ ] Recovery Point Objective (RPO) is defined
[ ] Recovery Time Objective (RTO) is defined
```

---

## 13. Local Recovery Drill — 18 August 2026

A local StayOS recovery drill was successfully completed on 18 August 2026 using PostgreSQL 18.4.

The following sequence was verified:

```text
stayos_dev
    ↓
pg_dump custom-format backup
    ↓
archive inspection with pg_restore
    ↓
fresh stayos_restore_test database
    ↓
full pg_restore
    ↓
business-data verification
    ↓
temporary database removal
```

The restored database successfully returned representative records for:

```text
Properties       2
Rooms           30
Reservations     2
Guests           2
Invoices         1
```

The recovery database was subsequently removed.

This confirms that the local StayOS PostgreSQL database can be backed up and restored successfully using the documented procedure.

This local drill does not by itself certify staging or production disaster recovery. Those environments must undergo their own recovery verification once their final infrastructure and backup policies are established.

---

## 14. Production Readiness Requirement

Backup generation alone is not sufficient for production readiness.

Before StayOS handles production hotel data, the deployed environment must have:

- automated backups;
- defined backup frequency;
- defined retention;
- secure off-host backup storage;
- monitored backup failures;
- documented recovery ownership;
- tested restoration;
- defined RPO;
- defined RTO.

A backup that has never been successfully restored should not be considered a verified recovery mechanism.

---

**StayOS — PostgreSQL Backup & Recovery Runbook**
