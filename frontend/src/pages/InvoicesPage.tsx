import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useInvoices, useSubmitPayment, useUpdateInvoiceStatus } from '../api/hooks';
import { Card, CardHeader, CardContent, CardFooter } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { Modal, ConfirmModal } from '../components/ui/Modal';
import { Table, Pagination } from '../components/ui/Table';
import { StatusBadge } from '../components/ui/Badge';
import { formatCurrency, formatDate } from '../utils/helpers';
import { Search, Eye, FileText, Download, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';

const paymentSchema = z.object({
  payment_reference: z.string().min(1, 'Payment reference is required').max(120),
  proof_of_payment: z.instanceof(File).optional().nullable(),
});

type PaymentForm = z.infer<typeof paymentSchema>;

export function InvoicesPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewingInvoice, setViewingInvoice] = useState<any>(null);
  const [payingInvoice, setPayingInvoice] = useState<any>(null);
  const [updatingInvoiceId, setUpdatingInvoiceId] = useState<number | null>(null);
  const [newStatus, setNewStatus] = useState('');

  const invoicesParams: Record<string, unknown> = {
    page: currentPage,
    page_size: 20,
    ordering: '-created_at',
  };
  if (search) invoicesParams.search = search;
  if (statusFilter !== 'all') invoicesParams.status = statusFilter;

  const { data: invoicesData, isLoading: invoicesLoading, refetch: refetchInvoices } = useInvoices(invoicesParams);
  const submitPaymentMutation = useSubmitPayment();
  const updateStatusMutation = useUpdateInvoiceStatus();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      payment_reference: '',
      proof_of_payment: null,
    },
  });

  const onSubmitPayment = async (data: PaymentForm) => {
    if (!payingInvoice) return;
    try {
      const formData = new FormData();
      formData.append('payment_reference', data.payment_reference);
      if (data.proof_of_payment) {
        formData.append('proof_of_payment', data.proof_of_payment);
      }
      await submitPaymentMutation.mutateAsync({ id: payingInvoice.id, data: formData });
      toast.success('Payment submitted successfully');
      setPayingInvoice(null);
      reset();
      refetchInvoices();
    } catch (error: any) {
      const message = error.response?.data?.detail || error.message || 'Failed to submit payment';
      toast.error(message);
    }
  };

  const handleStatusUpdate = async () => {
    if (!updatingInvoiceId || !newStatus) return;
    try {
      await updateStatusMutation.mutateAsync({ id: updatingInvoiceId, status: newStatus as any });
      toast.success('Invoice status updated');
      setUpdatingInvoiceId(null);
      setNewStatus('');
      refetchInvoices();
    } catch (error: any) {
      const message = error.response?.data?.detail || error.message || 'Failed to update status';
      toast.error(message);
    }
  };

  const columns = [
    { key: 'invoice_number', header: 'Invoice #', sortable: true },
    { key: 'order_number', header: 'Order #', sortable: true },
    { key: 'vendor_name', header: 'Vendor', sortable: true },
    { key: 'issue_date', header: 'Issue Date', render: (item: any) => formatDate(item.issue_date) },
    { key: 'due_date', header: 'Due Date', render: (item: any) => formatDate(item.due_date) },
    { key: 'status', header: 'Status', render: (item: any) => <StatusBadge status={item.status} size="sm" /> },
    { key: 'total_amount', header: 'Amount', render: (item: any) => formatCurrency(item.total_amount) },
    { key: 'actions', header: 'Actions', render: (item: any) => (
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setViewingInvoice(item)}><Eye className="h-4 w-4" /></Button>
        {((item.status as string) === 'UNPAID' || (item.status as string) === 'OVERDUE') ? (
          <Button variant="ghost" size="sm" onClick={() => setPayingInvoice(item)}>
            <CreditCard className="h-4 w-4" />
          </Button>
        ) : null}
        {item.pdf_url && (
          <Button variant="ghost" size="sm" onClick={() => window.open(item.pdf_url, '_blank')}>
            <Download className="h-4 w-4" />
          </Button>
        )}
      </div>
    )},
  ];

  const statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'UNPAID', label: 'Unpaid' },
    { value: 'PAYMENT_SUBMITTED', label: 'Payment Submitted' },
    { value: 'PAID', label: 'Paid' },
    { value: 'OVERDUE', label: 'Overdue' },
    { value: 'VOID', label: 'Void' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-500 mt-1">View and manage invoices, track payments</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search invoices..."
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
            data={invoicesData?.results ?? []}
            keyExtractor={(item) => item.id}
            isLoading={invoicesLoading}
            emptyMessage="No invoices found"
          />
          {invoicesData && (
            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil((invoicesData.count ?? 0) / 20)}
              onPageChange={setCurrentPage}
            />
          )}
        </CardContent>
      </Card>

      <Modal
        isOpen={!!viewingInvoice}
        onClose={() => setViewingInvoice(null)}
        title={`Invoice ${viewingInvoice?.invoice_number}`}
        size="lg"
      >
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Invoice Number</p>
              <p className="font-medium">{viewingInvoice?.invoice_number}</p>
            </div>
            <div>
              <p className="text-gray-500">Order</p>
              <p className="font-medium">{viewingInvoice?.order_number}</p>
            </div>
            <div>
              <p className="text-gray-500">Vendor</p>
              <p className="font-medium">{viewingInvoice?.vendor_name}</p>
            </div>
            <div>
              <p className="text-gray-500">Status</p>
              <p className="font-medium"><StatusBadge status={viewingInvoice?.status} /></p>
            </div>
            <div>
              <p className="text-gray-500">Issue Date</p>
              <p className="font-medium">{formatDate(viewingInvoice?.issue_date)}</p>
            </div>
            <div>
              <p className="text-gray-500">Due Date</p>
              <p className="font-medium">{formatDate(viewingInvoice?.due_date)}</p>
            </div>
            <div>
              <p className="text-gray-500">Payment Terms</p>
              <p className="font-medium">{viewingInvoice?.payment_terms}</p>
            </div>
            <div>
              <p className="text-gray-500">Subtotal</p>
              <p className="font-medium">{formatCurrency(viewingInvoice?.subtotal)}</p>
            </div>
            <div>
              <p className="text-gray-500">Tax ({viewingInvoice?.tax_rate}%)</p>
              <p className="font-medium">{formatCurrency(viewingInvoice?.tax_amount)}</p>
            </div>
            <div className="col-span-2">
              <p className="text-gray-500">Total Amount</p>
              <p className="font-medium text-xl">{formatCurrency(viewingInvoice?.total_amount)}</p>
            </div>
            {viewingInvoice?.payment_reference && (
              <div>
                <p className="text-gray-500">Payment Reference</p>
                <p className="font-medium">{viewingInvoice.payment_reference}</p>
              </div>
            )}
            {viewingInvoice?.paid_at && (
              <div>
                <p className="text-gray-500">Paid At</p>
                <p className="font-medium">{formatDate(viewingInvoice.paid_at)}</p>
              </div>
            )}
          </div>

          {viewingInvoice?.proof_url && (
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Proof of Payment</h4>
              <a href={viewingInvoice.proof_url} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                View Proof
              </a>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
            {viewingInvoice?.pdf_url && (
              <Button variant="outline" onClick={() => window.open(viewingInvoice.pdf_url, '_blank')}>
                <FileText className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
            )}
            <Button variant="ghost" onClick={() => setViewingInvoice(null)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!payingInvoice}
        onClose={() => { setPayingInvoice(null); reset(); }}
        title={`Submit Payment: ${payingInvoice?.invoice_number}`}
        size="md"
      >
        <form onSubmit={handleSubmit(onSubmitPayment)} className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Amount Due</span>
              <span className="font-semibold text-gray-900">{formatCurrency(payingInvoice?.total_amount)}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-600">Due Date</span>
              <span className="font-medium text-gray-900">{formatDate(payingInvoice?.due_date)}</span>
            </div>
          </div>
          <Input label="Payment Reference *" {...register('payment_reference')} error={errors.payment_reference?.message} placeholder="e.g., TXN-123456" />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Proof of Payment (optional)</label>
            <input
              type="file"
              {...register('proof_of_payment')}
              accept="image/*,application/pdf"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            {errors.proof_of_payment && <p className="mt-1 text-sm text-red-600">{errors.proof_of_payment.message}</p>}
          </div>
          <CardFooter>
            <Button variant="outline" type="button" onClick={() => { setPayingInvoice(null); reset(); }}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting || submitPaymentMutation.isPending}>
              Submit Payment
            </Button>
          </CardFooter>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={!!updatingInvoiceId && !!newStatus}
        onClose={() => { setUpdatingInvoiceId(null); setNewStatus(''); }}
        onConfirm={handleStatusUpdate}
        title="Update Invoice Status"
        message={`Change invoice status to ${newStatus}?`}
        confirmText="Update"
        isLoading={updateStatusMutation.isPending}
      />
    </div>
  );
}