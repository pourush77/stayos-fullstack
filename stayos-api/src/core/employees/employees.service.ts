import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { ApiErrorCode } from '../../common/errors/api-error-code.enum';
import { PropertiesService } from '../properties/properties.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { EmployeeQueryDto } from './dto/employee-query.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeeDepartment } from './domain/employee-department.enum';
import { EmployeeStatus } from './domain/employee-status.enum';
import { EmployeeEntity } from './infrastructure/employee.entity';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(EmployeeEntity)
    private readonly employeesRepository: Repository<EmployeeEntity>,
    private readonly propertiesService: PropertiesService,
  ) {}

  async findAll(propertyId: string, query: EmployeeQueryDto): Promise<EmployeeEntity[]> {
    await this.propertiesService.findOne(propertyId);

    const qb = this.employeesRepository
      .createQueryBuilder('employee')
      .where('employee.property_id = :propertyId', { propertyId });

    if (query.department) {
      qb.andWhere('employee.department = :department', { department: query.department });
    }

    if (query.status) {
      qb.andWhere('employee.status = :status', { status: query.status });
    }

    if (query.search) {
      qb.andWhere(
        '(employee.employee_code ILIKE :search OR employee.first_name ILIKE :search OR employee.last_name ILIKE :search OR employee.display_name ILIKE :search OR employee.phone ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    return qb.orderBy('employee.display_name', 'ASC').getMany();
  }

  async findOne(propertyId: string, employeeId: string): Promise<EmployeeEntity> {
    await this.propertiesService.findOne(propertyId);

    const employee = await this.employeesRepository.findOne({
      where: { id: employeeId, propertyId },
    });

    if (!employee) {
      throw new NotFoundException({
        code: ApiErrorCode.EMPLOYEE_NOT_FOUND,
        message: `Employee ${employeeId} was not found`,
      });
    }

    return employee;
  }

  async create(propertyId: string, createEmployeeDto: CreateEmployeeDto): Promise<EmployeeEntity> {
    await this.propertiesService.findOne(propertyId);

    try {
      const employee = this.employeesRepository.create({
        ...createEmployeeDto,
        propertyId,
        employeeCode:
          createEmployeeDto.employeeCode ??
          (await this.generateEmployeeCode(propertyId, createEmployeeDto.department)),
        lastName: createEmployeeDto.lastName ?? '',
        displayName:
          createEmployeeDto.displayName ??
          `${createEmployeeDto.firstName} ${createEmployeeDto.lastName ?? ''}`.trim(),
        designation: createEmployeeDto.designation ?? '',
        phone: createEmployeeDto.phone ?? null,
        status: createEmployeeDto.status ?? EmployeeStatus.ACTIVE,
        photoUrl: createEmployeeDto.photoUrl ?? null,
        staffAccessEnabled: createEmployeeDto.department === EmployeeDepartment.HOUSEKEEPING,
        staffAccessToken:
          createEmployeeDto.department === EmployeeDepartment.HOUSEKEEPING
            ? this.generateStaffAccessToken()
            : null,
      });

      return await this.employeesRepository.save(employee);
    } catch (error) {
      this.handlePersistenceError(error);
    }
  }

  async update(
    propertyId: string,
    employeeId: string,
    updateEmployeeDto: UpdateEmployeeDto,
  ): Promise<EmployeeEntity> {
    const employee = await this.findOne(propertyId, employeeId);

    try {
      const updatedEmployee = this.employeesRepository.merge(employee, updateEmployeeDto);

      if (updateEmployeeDto.phone === undefined) {
        updatedEmployee.phone = employee.phone;
      }

      if (
        !updateEmployeeDto.displayName &&
        (updateEmployeeDto.firstName || updateEmployeeDto.lastName)
      ) {
        updatedEmployee.displayName =
          `${updatedEmployee.firstName} ${updatedEmployee.lastName}`.trim();
      }

      return await this.employeesRepository.save(updatedEmployee);
    } catch (error) {
      this.handlePersistenceError(error);
    }
  }

  async regenerateStaffAccess(propertyId: string, employeeId: string): Promise<EmployeeEntity> {
    const employee = await this.findOne(propertyId, employeeId);
    employee.staffAccessEnabled = true;
    employee.staffAccessToken = this.generateStaffAccessToken();

    return this.employeesRepository.save(employee);
  }

  async updateStaffAccess(
    propertyId: string,
    employeeId: string,
    enabled: boolean,
  ): Promise<EmployeeEntity> {
    const employee = await this.findOne(propertyId, employeeId);
    employee.staffAccessEnabled = enabled;

    if (enabled && !employee.staffAccessToken) {
      employee.staffAccessToken = this.generateStaffAccessToken();
    }

    return this.employeesRepository.save(employee);
  }

  private handlePersistenceError(error: unknown): never {
    if (error instanceof QueryFailedError) {
      const driverError = error.driverError as { code?: string };

      if (driverError.code === '23505') {
        throw new ConflictException({
          code: ApiErrorCode.EMPLOYEE_CODE_ALREADY_EXISTS,
          message: 'Employee code already exists for this property',
        });
      }
    }

    throw error;
  }

  private async generateEmployeeCode(
    propertyId: string,
    department: EmployeeDepartment,
  ): Promise<string> {
    const prefix = this.departmentPrefix(department);
    const existingCodes = await this.employeesRepository
      .createQueryBuilder('employee')
      .select('employee.employee_code', 'employeeCode')
      .where('employee.property_id = :propertyId', { propertyId })
      .andWhere('employee.employee_code LIKE :prefix', { prefix: `${prefix}-%` })
      .getRawMany<{ employeeCode: string }>();

    const nextNumber =
      existingCodes.reduce((max, row) => {
        const match = row.employeeCode.match(new RegExp(`^${prefix}-(\\d+)$`));
        return match ? Math.max(max, Number(match[1])) : max;
      }, 0) + 1;

    return `${prefix}-${nextNumber.toString().padStart(3, '0')}`;
  }

  private departmentPrefix(department: EmployeeDepartment): string {
    const prefixes: Record<EmployeeDepartment, string> = {
      [EmployeeDepartment.HOUSEKEEPING]: 'HK',
      [EmployeeDepartment.MAINTENANCE]: 'MT',
      [EmployeeDepartment.FRONT_DESK]: 'FD',
      [EmployeeDepartment.ACCOUNTS]: 'AC',
      [EmployeeDepartment.RESTAURANT]: 'RS',
      [EmployeeDepartment.KITCHEN]: 'KT',
      [EmployeeDepartment.LAUNDRY]: 'LD',
      [EmployeeDepartment.SECURITY]: 'SC',
      [EmployeeDepartment.SPA]: 'SP',
      [EmployeeDepartment.OTHER]: 'OT',
    };

    return prefixes[department];
  }

  private generateStaffAccessToken(): string {
    return randomBytes(24).toString('base64url');
  }
}
