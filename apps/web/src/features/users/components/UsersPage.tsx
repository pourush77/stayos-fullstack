'use client';

import {
  Alert,
  Badge,
  Box,
  Button,
  Group,
  Modal,
  Paper,
  PasswordInput,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { Edit3, KeyRound, Plus, RefreshCcw, UserCheck, UserX } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { radius, spacing } from '@stayos/theme';
import { showToast } from '@stayos/ui';
import { useAuth } from '../../auth/auth-context';
import {
  createUser,
  friendlyUserError,
  getUsers,
  resetUserPassword,
  updateUser,
} from '../api/users-api';
import type {
  CreateUserPayload,
  PlatformUser,
  UpdateUserPayload,
  UserFilters,
  UserRole,
  UserStatus,
} from '../types/user.types';

const roles: Array<{ label: string; value: UserRole }> = [
  { label: 'Owner', value: 'OWNER' },
  { label: 'Admin', value: 'ADMIN' },
  { label: 'Manager', value: 'MANAGER' },
  { label: 'Front Desk', value: 'FRONT_DESK' },
  { label: 'Housekeeping', value: 'HOUSEKEEPING' },
  { label: 'Maintenance', value: 'MAINTENANCE' },
  { label: 'Accounts', value: 'ACCOUNTS' },
  { label: 'Read Only', value: 'READ_ONLY' },
];

const statuses: Array<{ label: string; value: UserStatus }> = [
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Inactive', value: 'INACTIVE' },
];

const emptyCreateForm: CreateUserPayload = {
  name: '',
  email: '',
  password: '',
  role: 'FRONT_DESK',
  status: 'ACTIVE',
};

function hasPermission(permissions: string[] | undefined, permission: string) {
  return Boolean(permissions?.includes(permission) || permissions?.includes('*'));
}

function roleLabel(role: UserRole) {
  return roles.find((item) => item.value === role)?.label ?? role;
}

function statusColor(status: UserStatus) {
  return status === 'ACTIVE' ? 'green' : 'gray';
}

function roleColor(role: UserRole): string {
  switch (role) {
    case 'OWNER':
      return 'grape';
    case 'ADMIN':
      return 'violet';
    case 'MANAGER':
      return 'blue';
    case 'FRONT_DESK':
      return 'cyan';
    case 'HOUSEKEEPING':
      return 'teal';
    case 'MAINTENANCE':
      return 'orange';
    case 'ACCOUNTS':
      return 'yellow';
    default:
      return 'gray';
  }
}

function formatDate(value: string | null) {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function CreateUserModal({
  onClose,
  onSubmit,
  opened,
  submitting,
  currentUserRole,
}: {
  onClose: () => void;
  onSubmit: (payload: CreateUserPayload) => Promise<void>;
  opened: boolean;
  submitting: boolean;
  currentUserRole: UserRole | undefined;
}) {
  const [values, setValues] = useState<CreateUserPayload>(emptyCreateForm);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (opened) {
      setValues(emptyCreateForm);
      setError(undefined);
    }
  }, [opened]);

  const assignableRoles = useMemo(() => {
    if (currentUserRole === 'OWNER') return roles;
    return roles.filter((role) => role.value !== 'OWNER');
  }, [currentUserRole]);

  return (
    <Modal opened={opened} onClose={onClose} centered size="lg" title="Add User">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!values.name.trim()) {
            setError('Name is required.');
            return;
          }
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
            setError('Enter a valid email address.');
            return;
          }
          if (values.password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
          }
          setError(undefined);
          void onSubmit(values);
        }}
      >
        <Stack gap="md">
          {error ? (
            <Alert color="red" data-testid="create-user-error">
              {error}
            </Alert>
          ) : null}
          <TextInput
            data-testid="create-user-name"
            label="Full name"
            required
            value={values.name}
            onChange={(event) =>
              setValues((current) => ({ ...current, name: event.currentTarget.value }))
            }
          />
          <TextInput
            data-testid="create-user-email"
            label="Email"
            placeholder="name@stayos.local"
            required
            type="email"
            value={values.email}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                email: event.currentTarget.value.toLowerCase(),
              }))
            }
          />
          <PasswordInput
            data-testid="create-user-password"
            description="Minimum 8 characters. Share it securely with the user."
            label="Initial password"
            required
            value={values.password}
            onChange={(event) =>
              setValues((current) => ({ ...current, password: event.currentTarget.value }))
            }
          />
          <Group grow>
            <Select
              data={assignableRoles}
              data-testid="create-user-role"
              label="Role"
              required
              value={values.role}
              onChange={(value) =>
                setValues((current) => ({ ...current, role: (value as UserRole) ?? 'FRONT_DESK' }))
              }
            />
            <Select
              data={statuses}
              data-testid="create-user-status"
              label="Status"
              value={values.status}
              onChange={(value) =>
                setValues((current) => ({ ...current, status: (value as UserStatus) ?? 'ACTIVE' }))
              }
            />
          </Group>
          <Group justify="flex-end">
            <Button variant="light" color="gray" onClick={onClose}>
              Cancel
            </Button>
            <Button data-testid="create-user-submit" loading={submitting} type="submit">
              Create User
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

function EditUserModal({
  onClose,
  onSubmit,
  opened,
  submitting,
  user,
  currentUserRole,
  currentUserId,
}: {
  onClose: () => void;
  onSubmit: (payload: UpdateUserPayload) => Promise<void>;
  opened: boolean;
  submitting: boolean;
  user: PlatformUser | undefined;
  currentUserRole: UserRole | undefined;
  currentUserId: string | undefined;
}) {
  const [values, setValues] = useState<UpdateUserPayload>({});
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (opened && user) {
      setValues({ name: user.name, email: user.email, role: user.role, status: user.status });
      setError(undefined);
    }
  }, [opened, user]);

  const isSelf = user?.id === currentUserId;
  const assignableRoles = useMemo(() => {
    if (currentUserRole === 'OWNER') return roles;
    return roles.filter((role) => role.value !== 'OWNER');
  }, [currentUserRole]);

  return (
    <Modal opened={opened} onClose={onClose} centered size="lg" title={`Edit ${user?.name ?? 'User'}`}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!values.name?.trim()) {
            setError('Name is required.');
            return;
          }
          if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
            setError('Enter a valid email address.');
            return;
          }
          setError(undefined);
          void onSubmit(values);
        }}
      >
        <Stack gap="md">
          {error ? (
            <Alert color="red" data-testid="edit-user-error">
              {error}
            </Alert>
          ) : null}
          {isSelf ? (
            <Alert color="blue" variant="light">
              You are editing your own account. Role changes are disabled here.
            </Alert>
          ) : null}
          <TextInput
            data-testid="edit-user-name"
            label="Full name"
            required
            value={values.name ?? ''}
            onChange={(event) =>
              setValues((current) => ({ ...current, name: event.currentTarget.value }))
            }
          />
          <TextInput
            data-testid="edit-user-email"
            label="Email"
            type="email"
            value={values.email ?? ''}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                email: event.currentTarget.value.toLowerCase(),
              }))
            }
          />
          <Group grow>
            <Select
              data={assignableRoles}
              data-testid="edit-user-role"
              disabled={isSelf}
              label="Role"
              value={values.role ?? null}
              onChange={(value) =>
                setValues((current) => ({ ...current, role: (value as UserRole) ?? current.role }))
              }
            />
            <Select
              data={statuses}
              data-testid="edit-user-status"
              disabled={isSelf}
              label="Status"
              value={values.status ?? null}
              onChange={(value) =>
                setValues((current) => ({
                  ...current,
                  status: (value as UserStatus) ?? current.status,
                }))
              }
            />
          </Group>
          <Group justify="flex-end">
            <Button variant="light" color="gray" onClick={onClose}>
              Cancel
            </Button>
            <Button data-testid="edit-user-submit" loading={submitting} type="submit">
              Save Changes
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

function ResetPasswordModal({
  onClose,
  onSubmit,
  opened,
  submitting,
  user,
}: {
  onClose: () => void;
  onSubmit: (password: string) => Promise<void>;
  opened: boolean;
  submitting: boolean;
  user: PlatformUser | undefined;
}) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (opened) {
      setPassword('');
      setConfirmPassword('');
      setError(undefined);
    }
  }, [opened]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      centered
      size="md"
      title={`Reset password for ${user?.name ?? 'user'}`}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
          }
          if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
          }
          setError(undefined);
          void onSubmit(password);
        }}
      >
        <Stack gap="md">
          {error ? (
            <Alert color="red" data-testid="reset-password-error">
              {error}
            </Alert>
          ) : null}
          <Alert color="yellow" variant="light">
            The user must change this password after logging in. Share it securely.
          </Alert>
          <PasswordInput
            data-testid="reset-password-new"
            label="New password"
            required
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
          />
          <PasswordInput
            data-testid="reset-password-confirm"
            label="Confirm password"
            required
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="light" color="gray" onClick={onClose}>
              Cancel
            </Button>
            <Button
              color="stayosBrand"
              data-testid="reset-password-submit"
              loading={submitting}
              type="submit"
            >
              Reset Password
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

export function UsersPage() {
  const auth = useAuth();
  const canView = hasPermission(auth.user?.permissions, 'users.view');
  const canManage = hasPermission(auth.user?.permissions, 'users.manage');
  const propertyId = auth.user?.propertyId;
  const currentUserRole = auth.user?.role as UserRole | undefined;

  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [filters, setFilters] = useState<UserFilters>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [createOpened, setCreateOpened] = useState(false);
  const [editUser, setEditUser] = useState<PlatformUser | undefined>();
  const [resetUser, setResetUser] = useState<PlatformUser | undefined>();
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!canView || !propertyId) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(undefined);
      try {
        const nextUsers = await getUsers(propertyId, signal);
        setUsers(nextUsers);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError('Unable to load users.');
      } finally {
        setIsLoading(false);
      }
    },
    [canView, propertyId],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const filtered = useMemo(() => {
    const search = filters.search?.trim().toLowerCase();
    return users.filter((user) => {
      if (filters.role && user.role !== filters.role) return false;
      if (filters.status && user.status !== filters.status) return false;
      if (search) {
        const haystack = `${user.name} ${user.email}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }, [users, filters]);

  const hasFilters = Boolean(filters.search || filters.role || filters.status);

  const handleCreate = async (payload: CreateUserPayload) => {
    if (!propertyId) return;
    setSubmitting(true);
    try {
      const created = await createUser(propertyId, payload);
      setUsers((current) => [created, ...current]);
      setCreateOpened(false);
      showToast({ color: 'green', title: 'User created', message: `${created.name} was added.` });
    } catch (submitError) {
      showToast({
        color: 'red',
        title: 'Unable to create user',
        message: friendlyUserError(submitError),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (payload: UpdateUserPayload) => {
    if (!propertyId || !editUser) return;
    setSubmitting(true);
    try {
      const next = await updateUser(propertyId, editUser.id, payload);
      setUsers((current) => current.map((user) => (user.id === next.id ? next : user)));
      setEditUser(undefined);
      showToast({ color: 'green', title: 'User updated', message: `${next.name} was saved.` });
    } catch (submitError) {
      showToast({
        color: 'red',
        title: 'Unable to update user',
        message: friendlyUserError(submitError),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (password: string) => {
    if (!propertyId || !resetUser) return;
    setSubmitting(true);
    try {
      await resetUserPassword(propertyId, resetUser.id, password);
      setResetUser(undefined);
      showToast({
        color: 'green',
        title: 'Password reset',
        message: `Password reset for ${resetUser.name}. Share it securely.`,
      });
    } catch (submitError) {
      showToast({
        color: 'red',
        title: 'Unable to reset password',
        message: friendlyUserError(submitError),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (user: PlatformUser) => {
    if (!propertyId) return;
    if (user.id === auth.user?.id) {
      showToast({
        color: 'yellow',
        title: 'Action not allowed',
        message: 'You cannot deactivate your own account.',
      });
      return;
    }
    setSubmitting(true);
    try {
      const next = await updateUser(propertyId, user.id, {
        status: user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
      });
      setUsers((current) => current.map((item) => (item.id === next.id ? next : item)));
      showToast({
        color: 'green',
        title: next.status === 'ACTIVE' ? 'User activated' : 'User deactivated',
        message: `${next.name} is now ${next.status.toLowerCase()}.`,
      });
    } catch (submitError) {
      showToast({
        color: 'red',
        title: 'Unable to update user',
        message: friendlyUserError(submitError),
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!canView) {
    return (
      <Alert color="red" title="Users unavailable" data-testid="users-forbidden">
        You do not have permission to view users.
      </Alert>
    );
  }

  return (
    <Stack gap={spacing[3]} data-testid="users-page">
      <Group justify="space-between" align="flex-start" gap={spacing[4]} wrap="wrap">
        <Box>
          <Title order={1} c="#101828" style={{ fontSize: 30, fontWeight: 750 }}>
            Users
          </Title>
          <Text c="#64748b" mt={4} style={{ fontSize: 14 }}>
            Create login accounts, change roles, and reset passwords for staff who sign in to
            StayOS.
          </Text>
        </Box>
        {canManage ? (
          <Button
            data-testid="create-user-button"
            leftSection={<Plus size={16} />}
            onClick={() => setCreateOpened(true)}
          >
            Add User
          </Button>
        ) : null}
      </Group>

      <Paper radius={radius.lg} p={16} style={{ border: '1px solid #e2e8f0' }}>
        <Group grow align="flex-end" wrap="wrap">
          <TextInput
            data-testid="users-search"
            label="Search"
            placeholder="Search by name or email"
            value={filters.search ?? ''}
            onChange={(event) =>
              setFilters((current) => ({ ...current, search: event.currentTarget.value }))
            }
          />
          <Select
            clearable
            data={roles}
            data-testid="users-role-filter"
            label="Role"
            value={filters.role ?? null}
            onChange={(value) =>
              setFilters((current) => ({
                ...current,
                role: (value as UserRole | null) ?? undefined,
              }))
            }
          />
          <Select
            clearable
            data={statuses}
            data-testid="users-status-filter"
            label="Status"
            value={filters.status ?? null}
            onChange={(value) =>
              setFilters((current) => ({
                ...current,
                status: (value as UserStatus | null) ?? undefined,
              }))
            }
          />
        </Group>
      </Paper>

      {error ? (
        <Alert color="red" title="Unable to load users." data-testid="users-load-error">
          <Stack gap={8}>
            <Text size="sm">{error}</Text>
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

      {isLoading ? <Alert color="blue">Loading users...</Alert> : null}

      {!isLoading && !error && filtered.length === 0 ? (
        <Paper radius={radius.lg} p={28} style={{ border: '1px solid #e2e8f0' }}>
          <Text c="#101828" style={{ fontSize: 16, fontWeight: 800 }}>
            {hasFilters ? 'No users match your filters.' : 'No users found.'}
          </Text>
        </Paper>
      ) : null}

      {filtered.length > 0 ? (
        <Paper radius={radius.lg} p={0} style={{ border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <Table.ScrollContainer minWidth={860}>
            <Table verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Email</Table.Th>
                  <Table.Th>Role</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Last login</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filtered.map((user) => (
                  <Table.Tr key={user.id} data-testid={`user-row-${user.id}`}>
                    <Table.Td>
                      <Text c="#101828" style={{ fontWeight: 750 }}>
                        {user.name}
                      </Text>
                    </Table.Td>
                    <Table.Td>{user.email}</Table.Td>
                    <Table.Td>
                      <Badge color={roleColor(user.role)} variant="light">
                        {roleLabel(user.role)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={statusColor(user.status)} variant="light">
                        {user.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{formatDate(user.lastLoginAt)}</Table.Td>
                    <Table.Td>
                      {canManage ? (
                        <Group gap={8} wrap="nowrap">
                          <Button
                            data-testid={`edit-user-${user.id}`}
                            leftSection={<Edit3 size={14} />}
                            size="xs"
                            variant="light"
                            onClick={() => setEditUser(user)}
                          >
                            Edit
                          </Button>
                          <Button
                            data-testid={`reset-password-${user.id}`}
                            color="stayosBrand"
                            leftSection={<KeyRound size={14} />}
                            size="xs"
                            variant="light"
                            onClick={() => setResetUser(user)}
                          >
                            Reset password
                          </Button>
                          <Button
                            data-testid={`toggle-status-${user.id}`}
                            color={user.status === 'ACTIVE' ? 'red' : 'green'}
                            disabled={user.id === auth.user?.id}
                            leftSection={
                              user.status === 'ACTIVE' ? (
                                <UserX size={14} />
                              ) : (
                                <UserCheck size={14} />
                              )
                            }
                            loading={submitting}
                            size="xs"
                            variant="light"
                            onClick={() => void toggleStatus(user)}
                          >
                            {user.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
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

      <CreateUserModal
        onClose={() => setCreateOpened(false)}
        onSubmit={handleCreate}
        opened={createOpened}
        submitting={submitting}
        currentUserRole={currentUserRole}
      />

      <EditUserModal
        onClose={() => setEditUser(undefined)}
        onSubmit={handleUpdate}
        opened={Boolean(editUser)}
        submitting={submitting}
        user={editUser}
        currentUserRole={currentUserRole}
        currentUserId={auth.user?.id}
      />

      <ResetPasswordModal
        onClose={() => setResetUser(undefined)}
        onSubmit={handleResetPassword}
        opened={Boolean(resetUser)}
        submitting={submitting}
        user={resetUser}
      />
    </Stack>
  );
}
