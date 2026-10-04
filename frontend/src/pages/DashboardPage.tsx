import { useAuth } from '../context/AuthContext';
import { useProducts, useOrders, useInvoices, useRestocks } from '../api/hooks';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Badge, StatusBadge } from '../components/ui/Badge';
import { formatCurrency, formatDate, cn } from '../utils/helpers';
import {
  Package,
  ShoppingCart,
  FileText,
  AlertTriangle,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

export function DashboardPage() {
  const { user } = useAuth();
  const { data: productsData } = useProducts({ page_size: 5 });
  const { data: ordersData } = useOrders({ page_size: 5, ordering: '-created_at' });
  const { data: invoicesData } = useInvoices({ page_size: 5, ordering: '-created_at' });
  const { data: restocksData } = useRestocks({ page_size: 5 });

  const totalProducts = productsData?.count ?? 0;
  const lowStockProducts = productsData?.results.filter((p: any) => p.is_low_stock).length ?? 0;
  const totalOrders = ordersData?.count ?? 0;
  const pendingOrders = ordersData?.results.filter((o: any) => o.status === 'PENDING').length ?? 0;
  const unpaidInvoices = invoicesData?.results.filter((i: any) => i.status === 'UNPAID' || i.status === 'OVERDUE').length ?? 0;
  const totalUnpaidAmount = invoicesData?.results
    .filter((i: any) => i.status === 'UNPAID' || i.status === 'OVERDUE')
    .reduce((sum: number, i: any) => sum + parseFloat(i.total_amount), 0) ?? 0;

  const stats = [
    {
      name: 'Total Products',
      value: totalProducts.toLocaleString(),
      icon: Package,
      color: 'text-blue-600 bg-blue-100',
      trend: '+12%',
      trendIcon: ArrowUpRight,
    },
    {
      name: 'Low Stock Alerts',
      value: lowStockProducts.toLocaleString(),
      icon: AlertTriangle,
      color: lowStockProducts > 0 ? 'text-red-600 bg-red-100' : 'text-green-600 bg-green-100',
      trend: lowStockProducts > 0 ? 'Needs attention' : 'All good',
      trendIcon: lowStockProducts > 0 ? ArrowUpRight : ArrowDownRight,
      trendColor: lowStockProducts > 0 ? 'text-red-600' : 'text-green-600',
    },
    {
      name: 'Pending Orders',
      value: pendingOrders.toLocaleString(),
      icon: ShoppingCart,
      color: 'text-yellow-600 bg-yellow-100',
      trend: `${totalOrders} total`,
      trendIcon: TrendingUp,
    },
    {
      name: 'Outstanding Invoices',
      value: formatCurrency(totalUnpaidAmount),
      icon: FileText,
      color: 'text-red-600 bg-red-100',
      trend: `${unpaidInvoices} unpaid`,
      trendIcon: TrendingUp,
    },
  ];

  const recentOrders = ordersData?.results.slice(0, 5) ?? [];
  const lowStockItems = productsData?.results.filter((p: any) => p.is_low_stock).slice(0, 5) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">
            Welcome back, {user?.first_name || user?.email.split('@')[0]}! Here's an overview of your inventory.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <Card key={index} padding="md">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">{stat.name}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
                <div className="flex items-center gap-1 mt-2">
                  <stat.trendIcon className={cn('h-4 w-4', stat.trendColor || 'text-green-600')} />
                  <span className="text-sm font-medium" style={{ color: stat.trendColor || 'text-green-600' }}>
                    {stat.trend}
                  </span>
                </div>
              </div>
              <div className={cn('p-3 rounded-xl', stat.color)}>
                <stat.icon className="h-6 w-6" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader
            title="Recent Orders"
            description="Latest orders placed"
            action={
              <a href="/orders" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                View all
              </a>
            }
          />
          <CardContent>
            <div className="space-y-4">
              {recentOrders.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No orders yet</p>
              ) : (
                recentOrders.map((order: any) => (
                  <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 py-3 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="font-medium text-gray-900">{order.order_number}</p>
                      <p className="text-sm text-gray-500">{order.vendor_name} • {formatDate(order.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={order.status} size="sm" />
                      <span className="font-medium text-gray-900">{formatCurrency(order.total_amount)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Low Stock Products"
            description="Products below safety stock level"
            action={
              lowStockProducts > 0 && (
                <a href="/inventory" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                  View all ({lowStockProducts})
                </a>
              )
            }
          />
          <CardContent>
            <div className="space-y-4">
              {lowStockItems.length === 0 ? (
                <p className="text-gray-500 text-center py-8">All products well stocked!</p>
              ) : (
                lowStockItems.map((product: any) => (
                  <div key={product.id} className="flex flex-wrap items-center justify-between gap-3 py-3 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="font-medium text-gray-900">{product.name}</p>
                      <p className="text-sm text-gray-500">SKU: {product.sku_code}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="danger">{product.stock_qty} / {product.safety_stock}</Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader
            title="Recent Invoices"
            description="Latest invoices generated"
            action={
              <a href="/invoices" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                View all
              </a>
            }
          />
          <CardContent>
            <div className="space-y-4">
              {invoicesData?.results.slice(0, 5).map((invoice: any) => (
                <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 py-3 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="font-medium text-gray-900">{invoice.invoice_number}</p>
                    <p className="text-sm text-gray-500">{invoice.vendor_name} • {formatDate(invoice.issue_date)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={invoice.status} size="sm" />
                    <span className="font-medium text-gray-900">{formatCurrency(invoice.total_amount)}</span>
                  </div>
                </div>
              )) || (
                <p className="text-gray-500 text-center py-8">No invoices yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Pending Restocks"
            description="Restock orders awaiting processing"
            action={
              restocksData?.results.some((r: any) => r.status === 'DRAFT' || r.status === 'SENT') && (
                <a href="/inventory?tab=restocks" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                  View all
                </a>
              )
            }
          />
          <CardContent>
            <div className="space-y-4">
              {restocksData?.results.filter((r: any) => r.status === 'DRAFT' || r.status === 'SENT').slice(0, 5).map((restock: any) => (
                <div key={restock.id} className="flex flex-wrap items-center justify-between gap-3 py-3 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="font-medium text-gray-900">{restock.product_name}</p>
                    <p className="text-sm text-gray-500">SKU: {restock.product_sku} • Qty: {restock.quantity}</p>
                  </div>
                  <StatusBadge status={restock.status} size="sm" />
                </div>
              )) || (
                <p className="text-gray-500 text-center py-8">No pending restocks</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}