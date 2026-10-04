import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useOrganizations, useCreateOrganization, useUpdateOrganization, useDeleteOrganization } from '../api/hooks';
import { Card, CardHeader, CardContent, CardFooter } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Select, Textarea } from '../components/ui/Input';
import { Modal, ConfirmModal } from '../components/ui/Modal';
import { Table, Pagination } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { formatDate } from '../utils/helpers';
import { Plus, Search, Edit, Trash2, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const orgSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  type: z.enum(['DISTRIBUTOR', 'VENDOR']),
  contact_email: z.string().email('Invalid email').optional().or(z.literal('')),
  contact_phone: z.string().max(32).optional(),
  address: z.string().max(255).optional(),
});

type OrgForm = z.infer<typeof orgSchema>;

const TYPE_OPTIONS = [
  { value: 'DISTRIBUTOR', label: 'Distributor' },
  { value: 'VENDOR', label: 'Vendor' },
];

export function OrganizationsPage() {
  const { user } = useAuth();
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<any>(null);
  const [deletingOrgId, setDeletingOrgId] = useState<number | null>(null);

  const orgsParams: Record<string, unknown> = {
    page: currentPage,
    page_size: 20,
    ordering: 'name',
  };
  if (search) orgsParams.search = search;
  if (typeFilter !== 'all') orgsParams.type = typeFilter;

  const { data: orgsData, isLoading: orgsLoading, refetch: refetchOrgs } = useOrganizations(orgsParams);
  const createOrgMutation = useCreateOrganization();
  const updateOrgMutation = useUpdateOrganization();
  const deleteOrgMutation = useDeleteOrganization();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<OrgForm>({
    resolver: zodResolver(orgSchema),
    defaultValues: {
      type: 'DISTRIBUTOR',
    },
  });

  const onSubmit = async (data: OrgForm) => {
    try {
      if (editingOrg) {
        await updateOrgMutation.mutateAsync({ id: editingOrg.id, data });
        toast.success('Organization updated successfully');
      } else {
        await createOrgMutation.mutateAsync(data);
        toast.success('Organization created successfully');
      }
      setIsCreateModalOpen(false);
      setEditingOrg(null);
      reset({ type: 'DISTRIBUTOR' });
      refetchOrgs();
    } catch (error: any) {
      const message = error.response?.data?.detail || error.message || 'Failed to save organization';
      toast.error(message);
    }
  };

  const handleDelete = async () => {
    if (!deletingOrgId) return;
    try {
      await deleteOrgMutation.mutateAsync(deletingOrgId);
      toast.success('Organization deleted successfully');
      setDeletingOrgId(null);
      refetchOrgs();
    } catch (error: any) {
      const message = error.response?.data?.detail || error.message || 'Failed to delete organization';
      toast.error(message);
    }
  };

  const openCreateModal = () => {
    setEditingOrg(null);
    reset({ type: 'DISTRIBUTOR' });
    setIsCreateModalOpen(true);
  };

  const openEditModal = (org: any) => {
    setEditingOrg(org);
    reset({
      name: org.name,
      type: org.type,
      contact_email: org.contact_email,
      contact_phone: org.contact_phone,
      address: org.address,
    });
    setIsCreateModalOpen(true);
  };

  const columns = [
    { key: 'name', header: 'Name', sortable: true },
    { key: 'type', header: 'Type', render: (item: any) => <Badge variant={item.type === 'DISTRIBUTOR' ? 'info' : 'success'}>{item.type}</Badge> },
    { key: 'contact_email', header: 'Contact Email', render: (item: any) => item.contact_email || '—' },
    { key: 'contact_phone', header: 'Phone', render: (item: any) => item.contact_phone || '—' },
    { key: 'address', header: 'Address', render: (item: any) => item.address || '—' },
    { key: 'user_count', header: 'Users', render: (item: any) => (
      <span className="flex items-center gap-1 text-gray-600">
        <Users className="h-4 w-4" />
        {item.user_count}
      </span>
    )},
    { key: 'created_at', header: 'Created', render: (item: any) => formatDate(item.created_at) },
    { key: 'actions', header: 'Actions', render: (item: any) => (
      <div className="flex items-center gap-2">
        {user?.role === 'SUPER_ADMIN' && (
          <>
            <Button variant="ghost" size="sm" onClick={() => openEditModal(item)}><Edit className="h-4 w-4" /></Button>
            <Button variant="danger" size="sm" onClick={() => setDeletingOrgId(item.id)}>
              <Trash2 className="h-4 w-4 text-red-600" />
            </Button>
          </>
        )}
      </div>
    )},
  ];

  const typeOptions = [
    { value: 'all', label: 'All Types' },
    ...TYPE_OPTIONS,
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Organizations</h1>
          <p className="text-gray-500 mt-1">Manage distributor and vendor organizations</p>
        </div>
        {user?.role === 'SUPER_ADMIN' && (
          <Button onClick={openCreateModal}>
            <Plus className="h-4 w-4 mr-2" />
            Add Organization
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
                placeholder="Search organizations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full sm:w-64 pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              />
            </div>
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              options={typeOptions}
              className="w-full sm:w-40"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table
            columns={columns}
            data={orgsData?.results ?? []}
            keyExtractor={(item) => item.id}
            isLoading={orgsLoading}
            emptyMessage="No organizations found"
          />
          {orgsData && (
            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil((orgsData.count ?? 0) / 20)}
              onPageChange={setCurrentPage}
            />
          )}
        </CardContent>
      </Card>

      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => { setIsCreateModalOpen(false); setEditingOrg(null); reset({ type: 'DISTRIBUTOR' }); }}
        title={editingOrg ? 'Edit Organization' : 'Create Organization'}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input label="Name *" {...register('name')} error={errors.name?.message} />
            <Select
              label="Type *"
              {...register('type')}
              options={TYPE_OPTIONS}
              error={errors.type?.message}
            />
            <Input label="Contact Email" type="email" {...register('contact_email')} error={errors.contact_email?.message} />
            <Input label="Contact Phone" {...register('contact_phone')} error={errors.contact_phone?.message} />
          </div>
          <Textarea label="Address" {...register('address')} error={errors.address?.message} rows={3} className="md:col-span-2" />
          <CardFooter>
            <Button variant="outline" type="button" onClick={() => { setIsCreateModalOpen(false); setEditingOrg(null); reset({ type: 'DISTRIBUTOR' }); }}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting || createOrgMutation.isPending || updateOrgMutation.isPending}>
              {editingOrg ? 'Update Organization' : 'Create Organization'}
            </Button>
          </CardFooter>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={!!deletingOrgId}
        onClose={() => setDeletingOrgId(null)}
        onConfirm={handleDelete}
        title="Delete Organization"
        message="Are you sure you want to delete this organization? This action cannot be undone and will affect all associated users and products."
        confirmText="Delete"
        variant="danger"
        isLoading={deleteOrgMutation.isPending}
      />
    </div>
  );
}