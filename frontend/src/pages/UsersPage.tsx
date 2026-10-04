import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser, useOrganizations } from '../api/hooks';
import { Card, CardHeader, CardContent, CardFooter } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { Modal, ConfirmModal } from '../components/ui/Modal';
import { Table, Pagination } from '../components/ui/Table';
import { Badge, StatusBadge } from '../components/ui/Badge';
import { formatDate } from '../utils/helpers';
import { Plus, Search, Edit, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const userSchema = z.object({
  email: z.string().email('Invalid email address'),
  first_name: z.string().min(1, 'First name is required').max(150),
  last_name: z.string().min(1, 'Last name is required').max(150),
  password: z.string().min(8, 'Password must be at least 8 characters').optional().or(z.literal('')),
  role: z.enum(['SUPER_ADMIN', 'WAREHOUSE_MANAGER', 'VENDOR']),
  organization: z.number().optional(),
  is_active: z.boolean().default(true),
});

type UserForm = z.infer<typeof userSchema>;

const ROLE_OPTIONS = [
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
  { value: 'WAREHOUSE_MANAGER', label: 'Warehouse Manager' },
  { value: 'VENDOR', label: 'Vendor' },
];

export function UsersPage() {
  const { user } = useAuth();
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);

  const { data: organizationsData } = useOrganizations({ page_size: 100 });
  const organizations = organizationsData?.results ?? [];

  const usersParams: Record<string, unknown> = {
    page: currentPage,
    page_size: 20,
    ordering: 'email',
  };
  if (search) usersParams.search = search;
  if (roleFilter !== 'all') usersParams.role = roleFilter;

  const { data: usersData, isLoading: usersLoading, refetch: refetchUsers } = useUsers(usersParams);
  const createUserMutation = useCreateUser();
  const updateUserMutation = useUpdateUser();
  const deleteUserMutation = useDeleteUser();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<UserForm>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      role: 'VENDOR',
      is_active: true,
    },
  });

  const watchedRole = watch('role');

  const onSubmit = async (data: UserForm) => {
    try {
      const submitData = { ...data };
      if (!editingUser && !submitData.password) {
        toast.error('Password is required for new users');
        return;
      }
      if (editingUser && !submitData.password) {
        delete submitData.password;
      }
      if (editingUser) {
        await updateUserMutation.mutateAsync({ id: editingUser.id, data: submitData });
        toast.success('User updated successfully');
      } else {
        await createUserMutation.mutateAsync(submitData as any);
        toast.success('User created successfully');
      }
      setIsCreateModalOpen(false);
      setEditingUser(null);
      reset({ role: 'VENDOR', is_active: true });
      refetchUsers();
    } catch (error: any) {
      const message = error.response?.data?.detail || error.message || 'Failed to save user';
      toast.error(message);
    }
  };

  const handleDelete = async () => {
    if (!deletingUserId) return;
    try {
      await deleteUserMutation.mutateAsync(deletingUserId);
      toast.success('User deleted successfully');
      setDeletingUserId(null);
      refetchUsers();
    } catch (error: any) {
      const message = error.response?.data?.detail || error.message || 'Failed to delete user';
      toast.error(message);
    }
  };

  const openCreateModal = () => {
    setEditingUser(null);
    reset({ role: 'VENDOR', is_active: true });
    setIsCreateModalOpen(true);
  };

  const openEditModal = (userData: any) => {
    setEditingUser(userData);
    reset({
      email: userData.email,
      first_name: userData.first_name,
      last_name: userData.last_name,
      password: '',
      role: userData.role,
      organization: userData.organization,
      is_active: userData.is_active,
    });
    setIsCreateModalOpen(true);
  };

  const canManageUser = (targetUser: any) => {
    if (user?.role === 'SUPER_ADMIN') return true;
    if (user?.role === 'WAREHOUSE_MANAGER' && targetUser.organization === user.organization) return true;
    return false;
  };

  const columns = [
    { key: 'email', header: 'Email', sortable: true },
    { key: 'name', header: 'Name', render: (item: any) => `${item.first_name} ${item.last_name}` },
    { key: 'role', header: 'Role', render: (item: any) => <StatusBadge status={item.role} size="sm" /> },
    { key: 'organization_name', header: 'Organization', render: (item: any) => item.organization_name || '—' },
    { key: 'organization_type', header: 'Org Type', render: (item: any) => item.organization_type ? <Badge variant="outline">{item.organization_type}</Badge> : '—' },
    { key: 'is_active', header: 'Status', render: (item: any) => <Badge variant={item.is_active ? 'success' : 'danger'}>{item.is_active ? 'Active' : 'Inactive'}</Badge> },
    { key: 'created_at', header: 'Created', render: (item: any) => formatDate(item.created_at) },
    { key: 'actions', header: 'Actions', render: (item: any) => (
      <div className="flex items-center gap-2">
        {canManageUser(item) && (
          <>
            <Button variant="ghost" size="sm" onClick={() => openEditModal(item)}><Edit className="h-4 w-4" /></Button>
            {item.id !== user?.id && (
              <Button variant="danger" size="sm" onClick={() => setDeletingUserId(item.id)}>
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            )}
          </>
        )}
      </div>
    )},
  ];

  const roleOptions = [
    { value: 'all', label: 'All Roles' },
    ...ROLE_OPTIONS,
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-gray-500 mt-1">Manage user accounts and permissions</p>
        </div>
        {(user?.role === 'SUPER_ADMIN' || user?.role === 'WAREHOUSE_MANAGER') && (
          <Button onClick={openCreateModal}>
            <Plus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full sm:w-64 pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              />
            </div>
            <Select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              options={roleOptions}
              className="w-full sm:w-40"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table
            columns={columns}
            data={usersData?.results ?? []}
            keyExtractor={(item) => item.id}
            isLoading={usersLoading}
            emptyMessage="No users found"
          />
          {usersData && (
            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil((usersData.count ?? 0) / 20)}
              onPageChange={setCurrentPage}
            />
          )}
        </CardContent>
      </Card>

      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => { setIsCreateModalOpen(false); setEditingUser(null); reset({ role: 'VENDOR', is_active: true }); }}
        title={editingUser ? 'Edit User' : 'Create User'}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input label="Email *" {...register('email')} error={errors.email?.message} disabled={!!editingUser} />
            <Input label="First Name *" {...register('first_name')} error={errors.first_name?.message} />
            <Input label="Last Name *" {...register('last_name')} error={errors.last_name?.message} />
            <Input label={editingUser ? 'Password (leave blank to keep current)' : 'Password *'} type="password" {...register('password')} error={errors.password?.message} />
            <Select
              label="Role *"
              {...register('role')}
              options={ROLE_OPTIONS}
              error={errors.role?.message}
            />
            {(watchedRole === 'WAREHOUSE_MANAGER' || watchedRole === 'VENDOR') && (
              <Select
                label="Organization *"
                {...register('organization', { valueAsNumber: true })}
                options={organizations
                  .filter(o => watchedRole === 'WAREHOUSE_MANAGER' ? o.type === 'DISTRIBUTOR' : o.type === 'VENDOR')
                  .map(o => ({ value: String(o.id), label: o.name }))}
                placeholder="Select organization"
                error={errors.organization?.message}
              />
            )}
            <div className="flex items-center gap-2">
              <input type="checkbox" id="is_active" {...register('is_active')} className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
              <label htmlFor="is_active" className="text-sm text-gray-700">Active</label>
            </div>
          </div>
          <CardFooter>
            <Button variant="outline" type="button" onClick={() => { setIsCreateModalOpen(false); setEditingUser(null); reset({ role: 'VENDOR', is_active: true }); }}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting || createUserMutation.isPending || updateUserMutation.isPending}>
              {editingUser ? 'Update User' : 'Create User'}
            </Button>
          </CardFooter>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={!!deletingUserId}
        onClose={() => setDeletingUserId(null)}
        onConfirm={handleDelete}
        title="Delete User"
        message="Are you sure you want to delete this user? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
        isLoading={deleteUserMutation.isPending}
      />
    </div>
  );
}