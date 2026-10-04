import { cn } from '../../utils/helpers';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline';
  size?: 'sm' | 'md';
  className?: string;
}

export function Badge({ children, variant = 'default', size = 'md', className }: BadgeProps) {
  const variants = {
    default: 'bg-gray-100 text-gray-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    danger: 'bg-red-100 text-red-800',
    info: 'bg-blue-100 text-blue-800',
    outline: 'border border-gray-300 bg-transparent text-gray-700',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {children}
    </span>
  );
}

interface StatusBadgeProps {
  status?: string | null;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  if (!status) return <Badge variant="default" size={size}>N/A</Badge>;

  const statusVariants: Record<string, BadgeProps['variant']> = {
    // Order statuses
    PENDING: 'warning',
    CONFIRMED: 'info',
    PROCESSING: 'info',
    DISPATCHED: 'info',
    DELIVERED: 'success',
    CANCELLED: 'danger',
    // Invoice statuses
    UNPAID: 'danger',
    PAYMENT_SUBMITTED: 'warning',
    PAID: 'success',
    OVERDUE: 'danger',
    VOID: 'outline',
    // Restock statuses
    DRAFT: 'default',
    SENT: 'info',
    RECEIVED: 'success',
    // User roles
    SUPER_ADMIN: 'info',
    WAREHOUSE_MANAGER: 'info',
    VENDOR: 'success',
    // Organization types
    DISTRIBUTOR: 'info',
  };

  return <Badge variant={statusVariants[status] || 'default'} size={size}>{status.replace(/_/g, ' ')}</Badge>;
}