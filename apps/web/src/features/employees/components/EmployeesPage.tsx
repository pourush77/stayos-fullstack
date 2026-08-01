'use client';

import {
  Alert,
  Badge,
  Box,
  Button,
  Group,
  Modal,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { Edit3, Plus, RefreshCcw, UserCheck, UserX } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { radius, spacing } from '@stayos/theme';
import { showToast } from '@stayos/ui';
import { useAuth } from '../../auth/auth-context';
import { getCurrentPropertyId } from '../../housekeeping/api/housekeeping-api';
import {
  createEmployee,
  friendlyEmployeeError,
  getEmployees,
  updateEmployee,
} from '../api/employees-api';
import type {
  CreateEmployeePayload,
  Employee,
  EmployeeDepartment,
  EmployeeFilters,
  EmployeeStatus,
} from '../types/employee.types';

const departments: Array<{ label: string; value: EmployeeDepartment }> = [
  { label: 'Housekeeping', value: 'HOUSEKEEPING' },
  { label: 'Maintenance', value: 'MAINTENANCE' },
  { label: 'Front Desk', value: 'FRONT_DESK' },
  { label: 'Accounts', value: 'ACCOUNTS' },
  { label: 'Restaurant', value: 'RESTAURANT' },
  { label: 'Kitchen', value: 'KITCHEN' },
  { label: 'Laundry', value: 'LAUNDRY' },
  { label: 'Security', value: 'SECURITY' },
  { label: 'Spa', value: 'SPA' },
  { label: 'Other', value: 'OTHER' },
];

const statuses: Array<{ label: string; value: EmployeeStatus }> = [
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Inactive', value: 'INACTIVE' },
];

const emptyForm: CreateEmployeePayload = {
  department: 'HOUSEKEEPING',
  designation: '',
  displayName: '',
  employeeCode: '',
  firstName: '',
  lastName: '',
  phone: '',
  status: 'ACTIVE',
};

function hasPermission(permissions: string[] | undefined, permission: string) {
  return Boolean(permissions?.includes(permission) || permissions?.includes('*'));
}

function departmentLabel(department: EmployeeDepartment) {
  return departments.find((item) => item.value === department)?.label ?? department;
}

function statusColor(status: EmployeeStatus) {
  return status === 'ACTIVE' ? 'green' : 'gray';
}

function EmployeeForm({
  employee,
  onClose,
  onSubmit,
  opened,
  submitting,
}: {
  employee?: Employee;
  onClose: () => void;
  onSubmit: (payload: CreateEmployeePayload) => Promise<void>;
  opened: boolean;
  submitting: boolean;
}) {
  const [values, setValues] = useState<CreateEmployeePayload>(emptyForm);
  const [error, setError] = useState<string>();

  useEffect(() => {
    setError(undefined);
    setValues(
      employee
        ? {
            department: employee.department,
            designation: employee.designation ?? '',
            displayName: employee.displayName ?? '',
            employeeCode: employee.employeeCode ?? '',
            firstName: employee.firstName,
            lastName: employee.lastName ?? '',
            phone: employee.phone ?? '',
            status: employee.status,
          }
        : emptyForm,
    );
  }, [employee, opened]);

  const update = (field: keyof CreateEmployeePayload) => (value: string | null) => {
    setValues((current) => ({ ...current, [field]: value ?? '' }));
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={employee ? 'Edit Employee' : 'Add Employee'}
      centered
      size="lg"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!values.firstName.trim()) {
            setError('First name is required.');
            return;
          }
          if (!values.department || !values.status) {
            setError('Department and status are required.');
            return;
          }
          setError(undefined);
          void onSubmit(values);
        }}
      >
        <Stack gap="md">
          {error ? <Alert color="red">{error}</Alert> : null}
          <Group grow align="flex-start" wrap="wrap">
            <TextInput
              label="First name"
              required
              value={values.firstName}
              onChange={(event) => update('firstName')(event.currentTarget.value)}
            />
            <TextInput
              label="Last name"
              value={values.lastName}
              onChange={(event) => update('lastName')(event.currentTarget.value)}
            />
          </Group>
          <Group grow align="flex-start" wrap="wrap">
            <TextInput
              label="Display name"
              value={values.displayName}
              onChange={(event) => update('displayName')(event.currentTarget.value)}
            />
            <TextInput
              description="Employee code is optional. StayOS can generate it automatically."
              label="Employee code"
              value={values.employeeCode}
              onChange={(event) => update('employeeCode')(event.currentTarget.value)}
            />
          </Group>
          <Group grow align="flex-start" wrap="wrap">
            <Select
              data={departments}
              label="Department"
              required
              value={values.department}
              onChange={(value) => update('department')(value)}
            />
            <Select
              data={statuses}
              label="Status"
              required
              value={values.status}
              onChange={(value) => update('status')(value)}
            />
          </Group>
          <Group grow align="flex-start" wrap="wrap">
            <TextInput
              label="Designation"
              value={values.designation}
              onChange={(event) => update('designation')(event.currentTarget.value)}
            />
            <TextInput
              label="Phone"
              value={values.phone}
              onChange={(event) => update('phone')(event.currentTarget.value)}
            />
          </Group>
          <Group justify="flex-end">
            <Button variant="light" color="gray" onClick={onClose}>
              Cancel
            </Button>
            <Button loading={submitting} type="submit">
              Save Employee
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

export function EmployeesPage() {
  const auth = useAuth();
  const canView = hasPermission(auth.user?.permissions, 'employees.view');
  const canManage = hasPermission(auth.user?.permissions, 'employees.manage');
  const [propertyId, setPropertyId] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filters, setFilters] = useState<EmployeeFilters>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [editingEmployee, setEditingEmployee] = useState<Employee>();
  const [formOpened, setFormOpened] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!canView) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(undefined);
      try {
        const nextPropertyId = propertyId || (await getCurrentPropertyId(signal));
        const nextEmployees = await getEmployees(nextPropertyId, filters, signal);
        setPropertyId(nextPropertyId);
        setEmployees(nextEmployees);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError('Unable to load employees.');
      } finally {
        setIsLoading(false);
      }
    },
    [canView, filters, propertyId],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const filtered = useMemo(() => {
    const search = filters.search?.trim().toLowerCase();
    if (!search) return employees;
    return employees.filter((employee) =>
      [
        employee.displayName,
        employee.firstName,
        employee.lastName,
        employee.employeeCode,
        employee.phone,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search)),
    );
  }, [employees, filters.search]);

  const hasFilters = Boolean(filters.search || filters.department || filters.status);

  const saveEmployee = async (payload: CreateEmployeePayload) => {
    if (!propertyId) return;
    setSubmitting(true);
    try {
      if (editingEmployee) {
        const nextEmployee = await updateEmployee(propertyId, editingEmployee.id, payload);
        setEmployees((current) =>
          current.map((employee) => (employee.id === nextEmployee.id ? nextEmployee : employee)),
        );
        showToast({
          color: 'green',
          message: 'Employee updated successfully.',
          title: 'Employee updated',
        });
      } else {
        const nextEmployee = await createEmployee(propertyId, payload);
        setEmployees((current) => [nextEmployee, ...current]);
        showToast({
          color: 'green',
          message: 'Employee added successfully.',
          title: 'Employee added',
        });
      }
      setFormOpened(false);
      setEditingEmployee(undefined);
      await load();
    } catch (saveError) {
      showToast({
        color: 'red',
        message: friendlyEmployeeError(saveError),
        title: 'Unable to save employee',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (employee: Employee) => {
    if (!propertyId) return;
    const nextStatus: EmployeeStatus = employee.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setSubmitting(true);
    try {
      const nextEmployee = await updateEmployee(propertyId, employee.id, { status: nextStatus });
      setEmployees((current) =>
        current.map((item) => (item.id === nextEmployee.id ? nextEmployee : item)),
      );
      showToast({
        color: 'green',
        message: 'Employee updated successfully.',
        title: 'Employee updated',
      });
    } catch (saveError) {
      showToast({
        color: 'red',
        message: friendlyEmployeeError(saveError),
        title: 'Unable to save employee',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!canView) {
    return (
      <Alert color="red" title="Employees unavailable">
        You do not have permission to view employees.
      </Alert>
    );
  }

  return (
    <Stack gap={spacing[3]}>
      <Group justify="space-between" align="flex-start" gap={spacing[4]} wrap="wrap">
        <Box>
          <Title order={1} c="#101828" style={{ fontSize: 30, fontWeight: 750 }}>
            Employees
          </Title>
          <Text c="#64748b" mt={4} style={{ fontSize: 14 }}>
            Manage operational staff for the hotel.
          </Text>
        </Box>
        {canManage ? (
          <Button
            leftSection={<Plus size={16} />}
            onClick={() => {
              setEditingEmployee(undefined);
              setFormOpened(true);
            }}
          >
            Add Employee
          </Button>
        ) : null}
      </Group>

      <Paper radius={radius.lg} p={16} style={{ border: '1px solid #e2e8f0' }}>
        <Group grow align="flex-end" wrap="wrap">
          <TextInput
            label="Search"
            placeholder="Search by name, phone, code"
            value={filters.search ?? ''}
            onChange={(event) =>
              setFilters((current) => ({ ...current, search: event.currentTarget.value }))
            }
          />
          <Select
            clearable
            data={departments}
            label="Department"
            value={filters.department ?? null}
            onChange={(value) =>
              setFilters((current) => ({
                ...current,
                department: (value as EmployeeDepartment | null) ?? undefined,
              }))
            }
          />
          <Select
            clearable
            data={statuses}
            label="Status"
            value={filters.status ?? null}
            onChange={(value) =>
              setFilters((current) => ({
                ...current,
                status: (value as EmployeeStatus | null) ?? undefined,
              }))
            }
          />
        </Group>
      </Paper>

      {error ? (
        <Alert color="red" title="Unable to load employees.">
          <Stack gap={8}>
            <Text size="sm">Unable to load employees.</Text>
            <Button
              size="xs"
              variant="light"
              leftSection={<RefreshCcw size={14} />}
              onClick={() => void load()}
              style={{ alignSelf: 'flex-start' }}
            >
              Retry
            </Button>
          </Stack>
        </Alert>
      ) : null}
      {isLoading ? <Alert color="blue">Loading employees...</Alert> : null}

      {!isLoading && !error && filtered.length === 0 ? (
        <Paper radius={radius.lg} p={28} style={{ border: '1px solid #e2e8f0' }}>
          <Text c="#101828" style={{ fontSize: 16, fontWeight: 800 }}>
            {hasFilters ? 'No employees match your filters.' : 'No employees found.'}
          </Text>
        </Paper>
      ) : null}

      {filtered.length > 0 ? (
        <Paper radius={radius.lg} p={0} style={{ border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <Table.ScrollContainer minWidth={860}>
            <Table verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Employee code</Table.Th>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Department</Table.Th>
                  <Table.Th>Designation</Table.Th>
                  <Table.Th>Phone</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filtered.map((employee) => (
                  <Table.Tr key={employee.id}>
                    <Table.Td>{employee.employeeCode ?? '-'}</Table.Td>
                    <Table.Td>
                      <Text c="#101828" style={{ fontWeight: 750 }}>
                        {employee.displayName}
                      </Text>
                    </Table.Td>
                    <Table.Td>{departmentLabel(employee.department)}</Table.Td>
                    <Table.Td>{employee.designation ?? '-'}</Table.Td>
                    <Table.Td>{employee.phone ?? '-'}</Table.Td>
                    <Table.Td>
                      <Badge color={statusColor(employee.status)} variant="light">
                        {employee.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      {canManage ? (
                        <Group gap={8} wrap="nowrap">
                          <Button
                            leftSection={<Edit3 size={14} />}
                            size="xs"
                            variant="light"
                            onClick={() => {
                              setEditingEmployee(employee);
                              setFormOpened(true);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            color={employee.status === 'ACTIVE' ? 'red' : 'green'}
                            leftSection={
                              employee.status === 'ACTIVE' ? (
                                <UserX size={14} />
                              ) : (
                                <UserCheck size={14} />
                              )
                            }
                            loading={submitting}
                            size="xs"
                            variant="light"
                            onClick={() => void toggleStatus(employee)}
                          >
                            {employee.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                          </Button>
                        </Group>
                      ) : (
                        <Text c="#94a3b8" size="sm">
                          -
                        </Text>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Paper>
      ) : null}

      <EmployeeForm
        employee={editingEmployee}
        onClose={() => {
          setFormOpened(false);
          setEditingEmployee(undefined);
        }}
        onSubmit={saveEmployee}
        opened={formOpened}
        submitting={submitting}
      />
    </Stack>
  );
}
