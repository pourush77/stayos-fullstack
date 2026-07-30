import { EmployeeResponseDto } from './dto/employee-response.dto';
import { EmployeeEntity } from './infrastructure/employee.entity';

export class EmployeesMapper {
  static toResponse(employee: EmployeeEntity): EmployeeResponseDto {
    return {
      id: employee.id,
      propertyId: employee.propertyId,
      employeeCode: employee.employeeCode,
      firstName: employee.firstName,
      lastName: employee.lastName,
      displayName: employee.displayName,
      department: employee.department,
      designation: employee.designation,
      phone: employee.phone,
      status: employee.status,
      photoUrl: employee.photoUrl,
      staffAccessEnabled: employee.staffAccessEnabled,
      staffAccessToken: employee.staffAccessToken,
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt,
    };
  }
}
