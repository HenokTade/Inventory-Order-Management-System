import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useOrders, useCheckout, useUpdateOrderStatus } from '../api/hooks';
import { useProducts } from '../api/hooks';
import { Card, CardHeader, CardContent, CardFooter } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Select, Textarea } from '../components/ui/Input';
import { Modal, ConfirmModal } from '../components/ui/Modal';
import { Table, Pagination } from '../components/ui/Table';
import { StatusBadge } from '../components/ui/Badge';
import { formatCurrency, formatDate } from '../utils/helpers';
import { Plus, Search, Trash2, ShoppingCart, Eye, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const checkoutItemSchema = z.object({
  product_id: z.number().min(1, 'Product is required'),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
});

const checkoutSchema = z.object({
  items: z.array(checkoutItemSchema).min(1, 'At least one item is required'),
  shipping_address: z.string().max(255).optional(),
  notes: z.string().max(255).optional(),
});

type CheckoutForm = z.infer<typeof checkoutSchema>;

export function OrdersPage() {
  const { user } = useAuth();
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [viewingOrder, setViewingOrder] = useState<any>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);
  const [newStatus, setNewStatus] = useState('');

  const { data: productsData } = useProducts({ page_size: 200, is_active: true });
  const availableProducts = productsData?.results ?? [];

  const ordersParams: Record<string, unknown> = {
    page: currentPage,
    page_size: 20,
    ordering: '-created_at',
  };
  if (search) ordersParams.search = search;
  if (statusFilter !== 'all') ordersParams.status = statusFilter;

  const { data: ordersData, isLoading: ordersLoading, refetch: refetchOrders } = useOrders(ordersParams);
  const checkoutMutation = useCheckout();
  const updateStatusMutation = useUpdateOrderStatus();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      items: [{ product_id: 0, quantity: 1 }],
      shipping_address: '',
      notes: '',
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const watchedItems = watch('items');
  const subtotal = watchedItems.reduce((sum, item) => {
    const product = availableProducts.find(p => p.id === item.product_id);
    return sum + (product ? parseFloat(product.unit_price) * item.quantity : 0);
  }, 0);

  const onSubmitCheckout = async (data: CheckoutForm) => {
    try {
      await checkoutMutation.mutateAsync(data);
      toast.success('Order placed successfully');
      setIsCheckoutModalOpen(false);
      reset({ items: [{ product_id: 0, quantity: 1 }], shipping_address: '', notes: '' });
      refetchOrders();
    } catch (error: any) {
      const message = error.response?.data?.detail || error.message || 'Failed to place order';
      toast.error(message);
    }
  };

  const handleStatusUpdate = async () => {
    if (!updatingOrderId || !newStatus) return;
    try {
      await updateStatusMutation.mutateAsync({ id: updatingOrderId, status: newStatus as any });
      toast.success('Order status updated');
      setUpdatingOrderId(null);
      setNewStatus('');
      refetchOrders();
    } catch (error: any) {
      const message = error.response?.data?.detail || error.message || 'Failed to update status';
      toast.error(message);
    }
  };

  const columns = [
    { key: 'order_number', header: 'Order #', sortable: true },
    { key: 'vendor_name', header: 'Vendor', sortable: true },
    { key: 'status', header: 'Status', render: (item: any) => <StatusBadge status={item.status} size="sm" /> },
    { key: 'item_count', header: 'Items' },
    { key: 'total_amount', header: 'Total', render: (item: any) => formatCurrency(item.total_amount) },
    { key: 'placed_by_email', header: 'Placed By', render: (item: any) => item.placed_by_email || 'N/A' },
    { key: 'created_at', header: 'Date', render: (item: any) => formatDate(item.created_at) },
    { key: 'actions', header: 'Actions', render: (item: any) => (
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setViewingOrder(item)}><Eye className="h-4 w-4" /></Button>
        {item.allowed_transitions.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => { setUpdatingOrderId(item.id); setNewStatus(item.allowed_transitions[0] as any); }}>
            <ShoppingCart className="h-4 w-4" />
          </Button>
        )}
        {item.invoice_id && (
          <Button variant="ghost" size="sm" onClick={() => window.open(`/invoices/${item.invoice_id}`, '_blank')}>
            <FileText className="h-4 w-4" />
          </Button>
        )}
      </div>
    )},
  ];

  const statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'CONFIRMED', label: 'Confirmed' },
    { value: 'PROCESSING', label: 'Processing' },
    { value: 'DISPATCHED', label: 'Dispatched' },
    { value: 'DELIVERED', label: 'Delivered' },
    { value: 'CANCELLED', label: 'Cancelled' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="text-gray-500 mt-1">Manage customer orders and track fulfillment</p>
        </div>
        {user?.role === 'VENDOR' && (
          <Button onClick={() => { reset({ items: [{ product_id: 0, quantity: 1 }], shipping_address: '', notes: '' }); setIsCheckoutModalOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            New Order
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search orders..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64 pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              />
            </div>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={statusOptions}
              className="w-40"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table
            columns={columns}
            data={ordersData?.results ?? []}
            keyExtractor={(item) => item.id}
            isLoading={ordersLoading}
            emptyMessage="No orders found"
          />
          {ordersData && (
            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil((ordersData.count ?? 0) / 20)}
              onPageChange={setCurrentPage}
            />
          )}
        </CardContent>
      </Card>

      <Modal
        isOpen={isCheckoutModalOpen}
        onClose={() => { setIsCheckoutModalOpen(false); reset({ items: [{ product_id: 0, quantity: 1 }], shipping_address: '', notes: '' }); }}
        title="Create New Order"
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmitCheckout)} className="space-y-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Order Items</h3>
            <div className="space-y-3">
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-center gap-3">
                  <Select
                    {...register(`items.${index}.product_id`, { valueAsNumber: true })}
                    options={availableProducts.map(p => ({ value: String(p.id), label: `${p.sku_code} - ${p.name} (${formatCurrency(p.unit_price)})` }))}
                    placeholder="Select product"
                    error={errors.items?.[index]?.product_id?.message}
                    className="flex-1"
                  />
                  <Input
                    label="Qty"
                    type="number"
                    min="1"
                    {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                    error={errors.items?.[index]?.quantity?.message}
                    className="w-24"
                  />
                  {fields.length > 1 && (
                    <Button variant="ghost" size="sm" type="button" onClick={() => remove(index)}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  )}
                </div>
              ))}
              {fields.length < 10 && (
                <Button variant="outline" type="button" onClick={() => append({ product_id: 0, quantity: 1 })} className="w-fit">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              )}
            </div>
            {errors.items && <p className="mt-1 text-sm text-red-600">{errors.items.message}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Textarea label="Shipping Address" {...register('shipping_address')} rows={3} />
            <Textarea label="Notes" {...register('notes')} rows={3} />
          </div>

          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-medium text-gray-900">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-600">Tax (0%)</span>
              <span className="font-medium text-gray-900">{formatCurrency(0)}</span>
            </div>
            <div className="flex justify-between text-lg font-semibold mt-2 pt-2 border-t border-gray-200">
              <span className="text-gray-900">Total</span>
              <span className="text-gray-900">{formatCurrency(subtotal)}</span>
            </div>
          </div>

          <CardFooter>
            <Button variant="outline" type="button" onClick={() => { setIsCheckoutModalOpen(false); reset({ items: [{ product_id: 0, quantity: 1 }], shipping_address: '', notes: '' }); }}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting || checkoutMutation.isPending}>
              Place Order
            </Button>
          </CardFooter>
        </form>
      </Modal>

      <Modal
        isOpen={!!viewingOrder}
        onClose={() => setViewingOrder(null)}
        title={`Order ${viewingOrder?.order_number}`}
        size="lg"
      >
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Order Number</p>
              <p className="font-medium">{viewingOrder?.order_number}</p>
            </div>
            <div>
              <p className="text-gray-500">Status</p>
              <p className="font-medium"><StatusBadge status={viewingOrder?.status} /></p>
            </div>
            <div>
              <p className="text-gray-500">Vendor</p>
              <p className="font-medium">{viewingOrder?.vendor_name}</p>
            </div>
            <div>
              <p className="text-gray-500">Placed By</p>
              <p className="font-medium">{viewingOrder?.placed_by_email || 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-500">Date</p>
              <p className="font-medium">{formatDate(viewingOrder?.created_at)}</p>
            </div>
            <div>
              <p className="text-gray-500">Items</p>
              <p className="font-medium">{viewingOrder?.item_count}</p>
            </div>
            <div>
              <p className="text-gray-500">Total</p>
              <p className="font-medium text-lg">{formatCurrency(viewingOrder?.total_amount)}</p>
            </div>
            {viewingOrder?.invoice_id && (
              <div>
                <p className="text-gray-500">Invoice</p>
                <p className="font-medium"><a href={`/invoices/${viewingOrder.invoice_id}`} className="text-primary-600 hover:underline">View Invoice</a></p>
              </div>
            )}
          </div>

          {viewingOrder?.shipping_address && (
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Shipping Address</h4>
              <p className="text-gray-600">{viewingOrder.shipping_address}</p>
            </div>
          )}

          {viewingOrder?.notes && (
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Notes</h4>
              <p className="text-gray-600">{viewingOrder.notes}</p>
            </div>
          )}

          <div>
            <h4 className="font-medium text-gray-900 mb-3">Items</h4>
            <div className="space-y-2">
              {viewingOrder?.items?.map((item: any, index: number) => (
                <div key={index} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium">{item.product_name} ({item.product_sku})</p>
                    <p className="text-sm text-gray-500">Qty: {item.quantity} × {formatCurrency(item.price_at_purchase)}</p>
                  </div>
                  <p className="font-medium text-gray-900">{formatCurrency(item.line_total)}</p>
                </div>
              ))}
            </div>
          </div>

          {viewingOrder?.allowed_transitions.length > 0 && (
            <div className="pt-4 border-t border-gray-200">
              <h4 className="font-medium text-gray-900 mb-3">Update Status</h4>
              <div className="flex flex-wrap gap-2">
                {viewingOrder.allowed_transitions.map((status: string) => (
                  <Button
                    key={status}
                    variant={status === 'CANCELLED' ? 'danger' : 'outline'}
                    size="sm"
                    onClick={() => { setUpdatingOrderId(viewingOrder.id); setNewStatus(status as any); }}
                  >
                    {status}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmModal
        isOpen={!!updatingOrderId && !!newStatus}
        onClose={() => { setUpdatingOrderId(null); setNewStatus(''); }}
        onConfirm={handleStatusUpdate}
        title="Update Order Status"
        message={`Change order status to ${newStatus}?`}
        confirmText="Update"
        isLoading={updateStatusMutation.isPending}
      />
    </div>
  );
}