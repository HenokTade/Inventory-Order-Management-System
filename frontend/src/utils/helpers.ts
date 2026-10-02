import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(num);
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    // Order statuses
    PENDING: 'bg-yellow-100 text-yellow-800',
    CONFIRMED: 'bg-blue-100 text-blue-800',
    PROCESSING: 'bg-purple-100 text-purple-800',
    DISPATCHED: 'bg-indigo-100 text-indigo-800',
    DELIVERED: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-red-100 text-red-800',
    // Invoice statuses
    UNPAID: 'bg-red-100 text-red-800',
    PAYMENT_SUBMITTED: 'bg-yellow-100 text-yellow-800',
    PAID: 'bg-green-100 text-green-800',
    OVERDUE: 'bg-red-100 text-red-800',
    VOID: 'bg-gray-100 text-gray-800',
    // Restock statuses
    DRAFT: 'bg-gray-100 text-gray-800',
    SENT: 'bg-blue-100 text-blue-800',
    RECEIVED: 'bg-green-100 text-green-800',
    // User roles
    SUPER_ADMIN: 'bg-purple-100 text-purple-800',
    WAREHOUSE_MANAGER: 'bg-blue-100 text-blue-800',
    VENDOR: 'bg-green-100 text-green-800',
    // Organization types
    DISTRIBUTOR: 'bg-indigo-100 text-indigo-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

export function getStockStatusColor(isLowStock: boolean, stockQty: number, _safetyStock: number): string {
  if (stockQty === 0) return 'bg-red-100 text-red-800';
  if (isLowStock) return 'bg-yellow-100 text-yellow-800';
  return 'bg-green-100 text-green-800';
}

export function getStockStatusText(isLowStock: boolean, stockQty: number, _safetyStock: number): string {
  if (stockQty === 0) return 'Out of Stock';
  if (isLowStock) return 'Low Stock';
  return 'In Stock';
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function generateOrderNumber(): string {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${year}${month}${day}-${random}`;
}

export function generateInvoiceNumber(): string {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `INV-${year}${month}-${random}`;
}