import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct, useAdjustStock, useRestocks, useStockLogs } from '../api/hooks';
import { useOrganizations } from '../api/hooks';
import { Card, CardHeader, CardContent, CardFooter } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Select, Textarea } from '../components/ui/Input';
import { Modal, ConfirmModal } from '../components/ui/Modal';
import { Table, Pagination } from '../components/ui/Table';
import { Badge, StatusBadge } from '../components/ui/Badge';
import { formatCurrency, formatDate, getStockStatusColor, getStockStatusText } from '../utils/helpers';
import { Plus, Search, Edit, Trash2, Package, ArrowUpDown, History, RefreshCw } from 'lucide-react';
import { cn } from '../utils/helpers';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const productSchema = z.object({
  sku_code: z.string().min(1, 'SKU code is required').max(64),
  barcode: z.string().optional(),
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().optional(),
  unit_price: z.string().min(1, 'Unit price is required'),
  wholesale_price: z.string().optional(),
  wholesale_min_qty: z.number().min(2).optional(),
  safety_stock: z.number().min(0).default(0),
  organization: z.number().optional(),
  shared_with: z.array(z.number()).optional(),
  aisle: z.string().optional(),
  rack: z.string().optional(),
  shelf: z.string().optional(),
  bin: z.string().optional(),
  is_active: z.boolean().default(true),
});

type ProductForm = z.infer<typeof productSchema>;

const stockAdjustSchema = z.object({
  change_qty: z.number().optional(),
  new_quantity: z.number().min(0).optional(),
  reason: z.enum(['STOCK_IN', 'STOCK_OUT', 'DAMAGED', 'ADJUSTED', 'ORDER', 'ORDER_CANCELLED', 'RESTOCK_RECEIVED']),
  note: z.string().max(255).optional(),
}).refine((data) => data.change_qty !== undefined || data.new_quantity !== undefined, {
  message: 'Provide either change_qty or new_quantity',
  path: ['change_qty'],
});

type StockAdjustForm = z.infer<typeof stockAdjustSchema>;

const REASON_OPTIONS = [
  { value: 'STOCK_IN', label: 'Stock In' },
  { value: 'STOCK_OUT', label: 'Stock Out' },
  { value: 'DAMAGED', label: 'Damaged' },
  { value: 'ADJUSTED', label: 'Adjusted' },
  { value: 'ORDER', label: 'Order Deduction' },
  { value: 'ORDER_CANCELLED', label: 'Order Cancellation' },
  { value: 'RESTOCK_RECEIVED', label: 'Restock Received' },
];

export function InventoryPage() {
  const { user } = useAuth();
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'low_stock'>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [adjustingProduct, setAdjustingProduct] = useState<any>(null);
  const [deletingProductId, setDeletingProductId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'products' | 'restocks' | 'logs'>('products');

  const { data: organizationsData } = useOrganizations({ page_size: 100 });
  const organizations = organizationsData?.results ?? [];

  const productsParams: Record<string, unknown> = {
    page: currentPage,
    page_size: 20,
    ordering: 'sku_code',
  };
  if (search) productsParams.search = search;
  if (statusFilter !== 'all') productsParams.is_active = statusFilter === 'active';
  if (statusFilter === 'low_stock') productsParams.is_low_stock = true;

  const { data: productsData, isLoading: productsLoading, refetch: refetchProducts } = useProducts(productsParams);
  const { data: restocksData, isLoading: restocksLoading } = useRestocks({ page: 1, page_size: 20 });
  const { data: logsData, isLoading: logsLoading } = useStockLogs({ page: 1, page_size: 20 });

  const createProductMutation = useCreateProduct();
  const updateProductMutation = useUpdateProduct();
  const deleteProductMutation = useDeleteProduct();
  const adjustStockMutation = useAdjustStock();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      is_active: true,
      safety_stock: 0,
    },
  });

  const {
    register: registerStock,
    handleSubmit: handleSubmitStock,
    reset: resetStock,
    formState: { errors: stockErrors, isSubmitting: isSubmittingStock },
  } = useForm<StockAdjustForm>({
    resolver: zodResolver(stockAdjustSchema),
    defaultValues: {
      reason: 'ADJUSTED',
    },
  });

  const onSubmit = async (data: ProductForm) => {
    try {
      if (editingProduct) {
        await updateProductMutation.mutateAsync({ id: editingProduct.id, data });
        toast.success('Product updated successfully');
      } else {
        await createProductMutation.mutateAsync(data);
        toast.success('Product created successfully');
      }
      setIsCreateModalOpen(false);
      setEditingProduct(null);
      reset();
      refetchProducts();
    } catch (error: any) {
      const message = error.response?.data?.detail || error.message || 'Failed to save product';
      toast.error(message);
    }
  };

  const onSubmitStock = async (data: StockAdjustForm) => {
    if (!adjustingProduct) return;
    try {
      await adjustStockMutation.mutateAsync({ id: adjustingProduct.id, data });
      toast.success('Stock adjusted successfully');
      setAdjustingProduct(null);
      resetStock();
      refetchProducts();
    } catch (error: any) {
      const message = error.response?.data?.detail || error.message || 'Failed to adjust stock';
      toast.error(message);
    }
  };

  const handleDelete = async () => {
    if (!deletingProductId) return;
    try {
      await deleteProductMutation.mutateAsync(deletingProductId);
      toast.success('Product deleted successfully');
      setDeletingProductId(null);
      refetchProducts();
    } catch (error: any) {
      const message = error.response?.data?.detail || error.message || 'Failed to delete product';
      toast.error(message);
    }
  };

  const openCreateModal = () => {
    setEditingProduct(null);
    reset({ is_active: true, safety_stock: 0 });
    setIsCreateModalOpen(true);
  };

  const openEditModal = (product: any) => {
    setEditingProduct(product);
    reset({
      sku_code: product.sku_code,
      barcode: product.barcode,
      name: product.name,
      description: product.description,
      unit_price: product.unit_price,
      wholesale_price: product.wholesale_price,
      wholesale_min_qty: product.wholesale_min_qty,
      safety_stock: product.safety_stock,
      organization: product.organization,
      shared_with: product.shared_with,
      aisle: product.aisle,
      rack: product.rack,
      shelf: product.shelf,
      bin: product.bin,
      is_active: product.is_active,
    });
    setIsCreateModalOpen(true);
  };

  const openAdjustModal = (product: any) => {
    setAdjustingProduct(product);
    resetStock({ reason: 'ADJUSTED' });
  };

  const columns = [
    { key: 'sku_code', header: 'SKU', sortable: true },
    { key: 'name', header: 'Name', sortable: true },
    { key: 'unit_price', header: 'Unit Price', render: (item: any) => formatCurrency(item.unit_price) },
    { key: 'wholesale_price', header: 'Wholesale', render: (item: any) => item.wholesale_price ? `${formatCurrency(item.wholesale_price)} (min ${item.wholesale_min_qty})` : '-' },
    { key: 'stock_qty', header: 'Stock', render: (item: any) => (
      <span className={cn('font-medium', getStockStatusColor(item.is_low_stock, item.stock_qty, item.safety_stock))}>
        {item.stock_qty} / {item.safety_stock}
      </span>
    )},
    { key: 'status', header: 'Status', render: (item: any) => (
      <Badge variant={item.is_active ? 'success' : 'outline'}>{item.is_active ? 'Active' : 'Inactive'}</Badge>
    )},
    { key: 'low_stock', header: 'Stock Status', render: (item: any) => (
      <Badge variant={item.is_low_stock ? 'danger' : 'success'}>{getStockStatusText(item.is_low_stock, item.stock_qty, item.safety_stock)}</Badge>
    )},
    { key: 'location', header: 'Location', render: (item: any) => item.location || '-' },
    { key: 'actions', header: 'Actions', render: (item: any) => (
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => openEditModal(item)}><Edit className="h-4 w-4" /></Button>
        <Button variant="ghost" size="sm" onClick={() => openAdjustModal(item)}><ArrowUpDown className="h-4 w-4" /></Button>
        <Button variant="danger" size="sm" onClick={() => setDeletingProductId(item.id)}><Trash2 className="h-4 w-4" /></Button>
      </div>
    )},
  ];

  const restockColumns = [
    { key: 'product_sku', header: 'SKU' },
    { key: 'product_name', header: 'Product' },
    { key: 'quantity', header: 'Qty' },
    { key: 'trigger_stock', header: 'Trigger Stock' },
    { key: 'threshold', header: 'Threshold' },
    { key: 'status', header: 'Status', render: (item: any) => <StatusBadge status={item.status} size="sm" /> },
    { key: 'created_at', header: 'Created', render: (item: any) => formatDate(item.created_at) },
  ];

  const logColumns = [
    { key: 'product_sku', header: 'SKU' },
    { key: 'product_name', header: 'Product' },
    { key: 'change_qty', header: 'Change', render: (item: any) => (
      <span className={cn('font-medium', item.change_qty > 0 ? 'text-green-600' : item.change_qty < 0 ? 'text-red-600' : 'text-gray-600')}>
        {item.change_qty > 0 ? '+' : ''}{item.change_qty}
      </span>
    )},
    { key: 'quantity_after', header: 'After' },
    { key: 'reason', header: 'Reason', render: (item: any) => <Badge variant="outline">{item.reason.replace('_', ' ')}</Badge> },
    { key: 'note', header: 'Note', render: (item: any) => item.note || '-' },
    { key: 'user_email', header: 'User', render: (item: any) => item.user_email || 'System' },
    { key: 'created_at', header: 'Time', render: (item: any) => formatDate(item.created_at) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-gray-500 mt-1">Manage products, stock levels, and restock orders</p>
        </div>
        {activeTab === 'products' && (
          <Button onClick={openCreateModal}>
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        )}
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-2 sm:gap-4 overflow-x-auto" aria-label="Inventory tabs">
          <button
            onClick={() => setActiveTab('products')}
            className={cn('px-4 py-2 text-sm font-medium border-b-2 transition-colors', activeTab === 'products' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700')}
          >
            <Package className="h-4 w-4 mr-1 inline" />
            Products
          </button>
          <button
            onClick={() => setActiveTab('restocks')}
            className={cn('px-4 py-2 text-sm font-medium border-b-2 transition-colors', activeTab === 'restocks' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700')}
          >
            <RefreshCw className="h-4 w-4 mr-1 inline" />
            Restocks
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={cn('px-4 py-2 text-sm font-medium border-b-2 transition-colors', activeTab === 'logs' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700')}
          >
            <History className="h-4 w-4 mr-1 inline" />
            Stock Logs
          </button>
        </nav>
      </div>

      {activeTab === 'products' && (
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full sm:w-64 pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                />
              </div>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' },
                  { value: 'low_stock', label: 'Low Stock' },
                ]}
                className="w-full sm:w-40"
              />
            </div>
          </CardHeader>
          <CardContent>
            <Table
              columns={columns}
              data={productsData?.results ?? []}
              keyExtractor={(item) => item.id}
              isLoading={productsLoading}
              emptyMessage="No products found"
            />
            {productsData && (
              <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil((productsData.count ?? 0) / 20)}
                onPageChange={setCurrentPage}
              />
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'restocks' && (
        <Card>
          <CardHeader title="Restock Orders" description="Low-stock triggered restock orders" />
          <CardContent>
            <Table
              columns={restockColumns}
              data={restocksData?.results ?? []}
              keyExtractor={(item) => item.id}
              isLoading={restocksLoading}
              emptyMessage="No restock orders"
            />
          </CardContent>
        </Card>
      )}

      {activeTab === 'logs' && (
        <Card>
          <CardHeader title="Stock Movement Logs" description="Audit trail of all stock changes" />
          <CardContent>
            <Table
              columns={logColumns}
              data={logsData?.results ?? []}
              keyExtractor={(item) => item.id}
              isLoading={logsLoading}
              emptyMessage="No stock movements recorded"
            />
          </CardContent>
        </Card>
      )}

      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => { setIsCreateModalOpen(false); setEditingProduct(null); reset(); }}
        title={editingProduct ? 'Edit Product' : 'Create Product'}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input label="SKU Code *" {...register('sku_code')} error={errors.sku_code?.message} disabled={!!editingProduct} />
            <Input label="Barcode" {...register('barcode')} error={errors.barcode?.message} />
            <Input label="Name *" type="text" {...register('name')} error={errors.name?.message} />
            <Input label="Unit Price *" type="number" step="0.01" {...register('unit_price')} error={errors.unit_price?.message} />
            <Input label="Wholesale Price" type="number" step="0.01" {...register('wholesale_price')} error={errors.wholesale_price?.message} />
            <Input label="Wholesale Min Qty" type="number" {...register('wholesale_min_qty', { valueAsNumber: true })} error={errors.wholesale_min_qty?.message} />
            <Input label="Safety Stock" type="number" {...register('safety_stock', { valueAsNumber: true })} error={errors.safety_stock?.message} />
            {user?.role === 'WAREHOUSE_MANAGER' || user?.role === 'SUPER_ADMIN' ? (
              <Select
                label="Organization *"
                {...register('organization')}
                options={organizations.filter(o => o.type === 'DISTRIBUTOR').map(o => ({ value: String(o.id), label: o.name }))}
                placeholder="Select organization"
                error={errors.organization?.message}
              />
            ) : null}
            <Input label="Aisle" {...register('aisle')} error={errors.aisle?.message} />
            <Input label="Rack" {...register('rack')} error={errors.rack?.message} />
            <Input label="Shelf" {...register('shelf')} error={errors.shelf?.message} />
            <Input label="Bin" {...register('bin')} error={errors.bin?.message} />
          </div>
          <Textarea label="Description" {...register('description')} error={errors.description?.message} rows={3} className="md:col-span-2" />
          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_active" {...register('is_active')} className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
            <label htmlFor="is_active" className="text-sm text-gray-700">Active</label>
          </div>
          <CardFooter>
            <Button variant="outline" type="button" onClick={() => { setIsCreateModalOpen(false); setEditingProduct(null); reset(); }}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting || createProductMutation.isPending || updateProductMutation.isPending}>
              {editingProduct ? 'Update Product' : 'Create Product'}
            </Button>
          </CardFooter>
        </form>
      </Modal>

      <Modal
        isOpen={!!adjustingProduct}
        onClose={() => { setAdjustingProduct(null); resetStock(); }}
        title={`Adjust Stock: ${adjustingProduct?.name}`}
        size="md"
      >
        <form onSubmit={handleSubmitStock(onSubmitStock)} className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Current Stock: <span className="font-medium text-gray-900">{adjustingProduct?.stock_qty}</span></p>
            <p className="text-sm text-gray-600">Safety Stock: <span className="font-medium text-gray-900">{adjustingProduct?.safety_stock}</span></p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Change Qty (use - for decrease)" type="number" {...registerStock('change_qty', { valueAsNumber: true })} error={stockErrors.change_qty?.message} />
            <Input label="Or Set New Quantity" type="number" min="0" {...registerStock('new_quantity', { valueAsNumber: true })} error={stockErrors.new_quantity?.message} />
          </div>
          <Select
            label="Reason *"
            {...registerStock('reason')}
            options={REASON_OPTIONS}
            error={stockErrors.reason?.message}
          />
          <Textarea label="Note (optional)" {...registerStock('note')} error={stockErrors.note?.message} rows={2} />
          <CardFooter>
            <Button variant="outline" type="button" onClick={() => { setAdjustingProduct(null); resetStock(); }}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmittingStock || adjustStockMutation.isPending}>
              Adjust Stock
            </Button>
          </CardFooter>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={!!deletingProductId}
        onClose={() => setDeletingProductId(null)}
        onConfirm={handleDelete}
        title="Delete Product"
        message="Are you sure you want to delete this product? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
        isLoading={deleteProductMutation.isPending}
      />
    </div>
  );
}