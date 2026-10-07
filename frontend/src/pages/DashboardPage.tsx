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
  const { data: productsData, isLoading: productsLoading } = useProducts({ page_size: 5 });
  const { data: ordersData, isLoading: ordersLoading } = useOrders({ page_size: 5, ordering: '-created_at' });
  const { data: invoicesData, isLoading: invoicesLoading } = useInvoices({ page_size: 5, ordering: '-created_at' });
  const { data: restocksData, isLoading: restocksLoading } = useRestocks({ page_size: 5 });

  // Handle loading states
  if (productsLoading || ordersLoading || invoicesLoading || restocksLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 rotate-in delay-200">
              Dashboard
            </h1>
            <p className="text-gray-500 mt-1 fade-in delay-300">
              Welcome back, {user?.first_name || user?.email.split('@')[0]}! Here's an overview of your inventory.
            </p>
          </div>
        </div>

        {/* Skeleton Loader for Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((index) => (
            <Card
              key={index}
              padding="md"
              className="hover-lift-lg scale-in animate-pulse-loading shine"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-500">Loading...</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">Loading...</p>
                  <div className="flex items-center gap-1 mt-2">
                    <Package className="h-4 w-4 text-blue-500 pulse" />
                    <span className="text-sm font-medium">Loading...</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-blue-100 hover-lift">
                  <Package className="h-6 w-6 text-blue-600 pulse" />
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Skeleton Loader for Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2].map((index) => (
            <Card
              key={index}
              className="hover-lift-lg scale-in animate-pulse-loading shine"
              style={{ animationDelay: `${index * 100 + 200}ms` }}
            >
              <CardHeader
                title={index === 1 ? "Recent Orders" : "Low Stock Products"}
                description={index === 1 ? "Latest orders placed" : "Products below safety stock level"}
              />
              <CardContent>
                <div className="space-y-4">
                  {[1, 2, 3].map((itemIndex) => (
                    <div
                      key={itemIndex}
                      className="flex flex-wrap items-center justify-between gap-3 py-3 border-b border-gray-100 last:border-0"
                    >
                      <div>
                        <p className="font-medium text-gray-900">Loading...</p>
                        <p className="text-sm text-gray-500">Loading...</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="info" className="w-16 h-6">
                          Loading...
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Skeleton Loader for Bottom Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2].map((index) => (
            <Card
              key={index}
              className="hover-lift-lg scale-in animate-pulse-loading shine"
              style={{ animationDelay: `${index * 100 + 200}ms` }}
            >
              <CardHeader
                title={index === 1 ? "Recent Invoices" : "Pending Restocks"}
                description={index === 1 ? "Latest invoices generated" : "Restock orders awaiting processing"}
              />
              <CardContent>
                <div className="space-y-4">
                  {[1, 2, 3].map((itemIndex) => (
                    <div
                      key={itemIndex}
                      className="flex flex-wrap items-center justify-between gap-3 py-3 border-b border-gray-100 last:border-0"
                    >
                      <div>
                        <p className="font-medium text-gray-900">Loading...</p>
                        <p className="text-sm text-gray-500">Loading...</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="info" className="w-16 h-6">
                          Loading...
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

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
    <div className="space-y-6 fade-in delay-100">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 rotate-in delay-200">
            Dashboard
          </h1>
          <p className="text-gray-500 mt-1 fade-in delay-300">
            Welcome back, {user?.first_name || user?.email.split('@')[0]}! Here's an overview of your inventory.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <Card
            key={index}
            padding="md"
            className={`hover-lift-lg scale-in delay-${index * 100 + 200} shine`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500 fade-in delay-100">{stat.name}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1 fade-in delay-200">{stat.value}</p>
                <div className="flex items-center gap-1 mt-2">
                  <stat.trendIcon
                    className={cn('h-4 w-4', stat.trendColor || 'text-green-600', 'pulse delay-300')}
                  />
                  <span
                    className="text-sm font-medium fade-in delay-400"
                    style={{ color: stat.trendColor || 'text-green-600' }}
                  >
                    {stat.trend}
                  </span>
                </div>
              </div>
              <div className={cn('p-3 rounded-xl', stat.color, 'hover-lift')}>
                <stat.icon
                  className={cn('h-6 w-6', 'pulse delay-500')}
                />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          className="hover-lift-lg scale-in delay-200 shine"
        >
          <CardHeader
            title="Recent Orders"
            description="Latest orders placed"
            action={
              <a href="/orders" className="text-sm text-primary-600 hover:text-primary-700 font-medium fade-in delay-200">
                View all
              </a>
            }
          />
          <CardContent>
            <div className="space-y-4">
              {recentOrders.length === 0 ? (
                <p className="text-gray-500 text-center py-8 fade-in delay-300">No orders yet</p>
              ) : (
                recentOrders.map((order: any) => (
                  <div
                    key={order.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 border-b border-gray-100 last:border-0 hover-lift"
                  >
                    <div>
                      <p className="font-medium text-gray-900 fade-in delay-100">{order.order_number}</p>
                      <p className="text-sm text-gray-500 fade-in delay-200">
                        {order.vendor_name} • {formatDate(order.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="fade-in delay-300">
                        <StatusBadge status={order.status} size="sm" />
                      </div>
                      <span className="font-medium text-gray-900 fade-in delay-400">
                        {formatCurrency(order.total_amount)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card
          className="hover-lift-lg scale-in delay-300 shine"
        >
          <CardHeader
            title="Low Stock Products"
            description="Products below safety stock level"
            action={
              lowStockProducts > 0 && (
                <a href="/inventory" className="text-sm text-primary-600 hover:text-primary-700 font-medium fade-in delay-200">
                  View all ({lowStockProducts})
                </a>
              )
            }
          />
          <CardContent>
            <div className="space-y-4">
              {lowStockItems.length === 0 ? (
                <p className="text-gray-500 text-center py-8 fade-in delay-300">All products well stocked!</p>
              ) : (
                lowStockItems.map((product: any) => (
                  <div
                    key={product.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 border-b border-gray-100 last:border-0 hover-lift"
                  >
                    <div>
                      <p className="font-medium text-gray-900 fade-in delay-100">{product.name}</p>
                      <p className="text-sm text-gray-500 fade-in delay-200">SKU: {product.sku_code}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="danger" className="fade-in delay-300">
                        {product.stock_qty} / {product.safety_stock}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          className="hover-lift-lg scale-in delay-200 shine"
        >
          <CardHeader
            title="Recent Invoices"
            description="Latest invoices generated"
            action={
              <a href="/invoices" className="text-sm text-primary-600 hover:text-primary-700 font-medium fade-in delay-200">
                View all
              </a>
            }
          />
          <CardContent>
            <div className="space-y-4">
              {invoicesData?.results.slice(0, 5).map((invoice: any) => (
                <div
                  key={invoice.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 border-b border-gray-100 last:border-0 hover-lift"
                >
                  <div>
                    <p className="font-medium text-gray-900 fade-in delay-100">{invoice.invoice_number}</p>
                    <p className="text-sm text-gray-500 fade-in delay-200">
                      {invoice.vendor_name} • {formatDate(invoice.issue_date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="fade-in delay-300">
                      <StatusBadge status={invoice.status} size="sm" />
                    </div>
                    <span className="font-medium text-gray-900 fade-in delay-400">
                      {formatCurrency(invoice.total_amount)}
                    </span>
                  </div>
                </div>
              )) || (
                <p className="text-gray-500 text-center py-8 fade-in delay-300">No invoices yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card
          className="hover-lift-lg scale-in delay-300 shine"
        >
          <CardHeader
            title="Pending Restocks"
            description="Restock orders awaiting processing"
          />
          <CardContent>
            <div className="space-y-4">
              {restocksData?.results.filter((r: any) => r.status === 'DRAFT' || r.status === 'SENT').slice(0, 5).map((restock: any) => (
                <div
                  key={restock.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 border-b border-gray-100 last:border-0 hover-lift"
                >
                  <div>
                    <p className="font-medium text-gray-900 fade-in delay-100">{restock.product_name}</p>
                    <p className="text-sm text-gray-500 fade-in delay-200">
                      SKU: {restock.product_sku} • Qty: {restock.quantity}
                    </p>
                  </div>
                  <div className="fade-in delay-300">
                    <StatusBadge status={restock.status} size="sm" />
                  </div>
                </div>
              )) || (
                <p className="text-gray-500 text-center py-8 fade-in delay-300">No pending restocks</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}