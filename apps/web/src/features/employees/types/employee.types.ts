export type EmployeeDepartment =
  | 'HOUSEKEEPING'
  | 'MAINTENANCE'
  | 'FRONT_DESK'
  | 'ACCOUNTS'
  | 'RESTAURANT'
  | 'KITCHEN'
  | 'LAUNDRY'
  | 'SECURITY'
  | 'SPA'
  | 'OTHER';

export type EmployeeStatus = 'ACTIVE' | 'INACTIVE';

export type Employee = {
  department: EmployeeDepartment;
  designation?: string;
  displayName: string;
  employeeCode?: string;
  firstName: string;
  id: string;
  lastName?: string;
  phone?: string;
  status: EmployeeStatus;
};

export type EmployeeFilters = {
  department?: EmployeeDepartment;
  search?: string;
  status?: EmployeeStatus;
};

export type CreateEmployeePayload = {
  department: EmployeeDepartment;
  designation?: string;
  displayName?: string;
  employeeCode?: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  status: EmployeeStatus;
};

export type UpdateEmployeePayload = Partial<CreateEmployeePayload>;

