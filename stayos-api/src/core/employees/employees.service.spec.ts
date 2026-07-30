import { ConflictException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { QueryFailedError, Repository } from 'typeorm';
import { PropertiesService } from '../properties/properties.service';
import { EmployeeDepartment } from './domain/employee-department.enum';
import { EmployeeStatus } from './domain/employee-status.enum';
import { EmployeesService } from './employees.service';
import { EmployeeEntity } from './infrastructure/employee.entity';

type MockRepository<T extends object = object> = Partial<Record<keyof Repository<T>, jest.Mock>>;

const propertyId = '4075c8fa-f36e-4f40-a3ef-2e9dbb1f0670';
const employeeId = '9075c8fa-f36e-4f40-a3ef-2e9dbb1f0675';

const employeeEntity: EmployeeEntity = {
  id: employeeId,
  propertyId,
  property: undefined as never,
  employeeCode: 'HK-001',
  firstName: 'Ram',
  lastName: 'Kumar',
  displayName: 'Ram Kumar',
  department: EmployeeDepartment.HOUSEKEEPING,
  designation: 'Room Attendant',
  phone: null,
  status: EmployeeStatus.ACTIVE,
  photoUrl: null,
  staffAccessEnabled: true,
  staffAccessToken: 'staff-token',
  createdAt: new Date('2026-07-05T08:00:00.000Z'),
  updatedAt: new Date('2026-07-05T08:00:00.000Z'),
};

const queryBuilder = (
  employees: EmployeeEntity[] = [],
  rawCodes: Array<{ employeeCode: string }> = [],
) => ({
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  getMany: jest.fn().mockResolvedValue(employees),
  getRawMany: jest.fn().mockResolvedValue(rawCodes),
});

describe('EmployeesService', () => {
  let service: EmployeesService;
  let repository: MockRepository<EmployeeEntity>;

  beforeEach(async () => {
    repository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder([employeeEntity])),
      findOne: jest.fn().mockResolvedValue(employeeEntity),
      create: jest.fn().mockImplementation((input) => input),
      merge: jest.fn().mockImplementation((employee, input) => ({ ...employee, ...input })),
      save: jest
        .fn()
        .mockImplementation(async (employee) => ({ ...employee, id: employee.id ?? employeeId })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeesService,
        { provide: getRepositoryToken(EmployeeEntity), useValue: repository },
        {
          provide: PropertiesService,
          useValue: { findOne: jest.fn().mockResolvedValue({ id: propertyId }) },
        },
      ],
    }).compile();

    service = module.get(EmployeesService);
  });

  it('returns an empty list instead of throwing when no employees exist', async () => {
    repository.createQueryBuilder = jest.fn().mockReturnValue(queryBuilder([]));

    await expect(
      service.findAll(propertyId, {
        department: EmployeeDepartment.HOUSEKEEPING,
        status: EmployeeStatus.ACTIVE,
      }),
    ).resolves.toEqual([]);
  });

  it('applies department and status filters', async () => {
    const qb = queryBuilder([employeeEntity]);
    repository.createQueryBuilder = jest.fn().mockReturnValue(qb);

    await service.findAll(propertyId, {
      department: EmployeeDepartment.HOUSEKEEPING,
      status: EmployeeStatus.ACTIVE,
    });

    expect(qb.andWhere).toHaveBeenCalledWith('employee.department = :department', {
      department: EmployeeDepartment.HOUSEKEEPING,
    });
    expect(qb.andWhere).toHaveBeenCalledWith('employee.status = :status', {
      status: EmployeeStatus.ACTIVE,
    });
  });

  it('regenerates staff access and enables the employee', async () => {
    const employee = await service.regenerateStaffAccess(propertyId, employeeId);

    expect(employee.staffAccessEnabled).toBe(true);
    expect(employee.staffAccessToken).toEqual(expect.any(String));
    expect(employee.staffAccessToken).not.toBe('staff-token');
  });

  it('enables staff access and creates a token when missing', async () => {
    repository.findOne = jest
      .fn()
      .mockResolvedValue({ ...employeeEntity, staffAccessEnabled: false, staffAccessToken: null });

    const employee = await service.updateStaffAccess(propertyId, employeeId, true);

    expect(employee.staffAccessEnabled).toBe(true);
    expect(employee.staffAccessToken).toEqual(expect.any(String));
  });

  it('creates an employee and generates missing code and display name', async () => {
    repository.createQueryBuilder = jest
      .fn()
      .mockReturnValue(queryBuilder([], [{ employeeCode: 'HK-001' }]));

    const employee = await service.create(propertyId, {
      firstName: 'Anita',
      department: EmployeeDepartment.HOUSEKEEPING,
    });

    expect(employee).toMatchObject({
      employeeCode: 'HK-002',
      displayName: 'Anita',
      lastName: '',
      designation: '',
      phone: null,
      status: EmployeeStatus.ACTIVE,
      staffAccessEnabled: true,
      staffAccessToken: expect.any(String),
    });
  });

  it('updates an employee display name when first or last name changes', async () => {
    const employee = await service.update(propertyId, employeeId, { firstName: 'Ramesh' });

    expect(employee.displayName).toBe('Ramesh Kumar');
  });

  it('throws employee not found for missing detail', async () => {
    repository.findOne = jest.fn().mockResolvedValue(null);

    await expect(service.findOne(propertyId, employeeId)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws friendly conflict for duplicate code', async () => {
    const error = new QueryFailedError('INSERT', [], { code: '23505' } as Error & {
      code: string;
    });
    repository.save = jest.fn().mockRejectedValue(error);

    await expect(
      service.create(propertyId, {
        employeeCode: 'HK-001',
        firstName: 'Ram',
        department: EmployeeDepartment.HOUSEKEEPING,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
