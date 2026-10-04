import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  FileText,
  Users,
  Building2,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { cn } from '../utils/helpers';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Inventory', href: '/inventory', icon: Package },
  { name: 'Orders', href: '/orders', icon: ShoppingCart },
  { name: 'Invoices', href: '/invoices', icon: FileText },
  { name: 'Users', href: '/users', icon: Users, roles: ['SUPER_ADMIN', 'WAREHOUSE_MANAGER'] },
  { name: 'Organizations', href: '/organizations', icon: Building2, roles: ['SUPER_ADMIN'] },
];

export function Sidebar({ isCollapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const location = useLocation();

  const filteredNavigation = navigation.filter((item) => {
    if (!item.roles) return true;
    return user && item.roles.includes(user.role);
  });

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-50 h-screen w-64 bg-white border-r border-gray-200 transition-all duration-300 flex flex-col',
        isCollapsed && 'lg:w-16',
        mobileOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full lg:translate-x-0'
      )}
    >
      <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
        <NavLink to="/" onClick={onMobileClose} className={cn('font-bold text-xl text-primary-600', isCollapsed && 'lg:hidden')}>
          Inventory
        </NavLink>
        <button
          onClick={onToggle}
          className={cn(
            'hidden lg:flex p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors',
            isCollapsed && 'mx-auto'
          )}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
        <button
          onClick={onMobileClose}
          className="lg:hidden p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {filteredNavigation.map((item) => {
          const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + '/');
          return (
            <NavLink
              key={item.name}
              to={item.href}
              onClick={onMobileClose}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                isCollapsed && 'lg:justify-center'
              )}
              title={isCollapsed ? item.name : undefined}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
              <span className={cn(isCollapsed && 'lg:hidden')}>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="p-3 border-t border-gray-200">
        <NavLink
          to="/settings"
          onClick={onMobileClose}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors',
            isCollapsed && 'lg:justify-center'
          )}
          title={isCollapsed ? 'Settings' : undefined}
        >
          <Settings className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
          <span className={cn(isCollapsed && 'lg:hidden')}>Settings</span>
        </NavLink>

        <button
          onClick={logout}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-700 transition-colors mt-2',
            isCollapsed && 'lg:justify-center'
          )}
          title={isCollapsed ? 'Logout' : undefined}
        >
          <LogOut className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
          <span className={cn(isCollapsed && 'lg:hidden')}>Logout</span>
        </button>

        {user && (
          <div className={cn('mt-4 pt-4 border-t border-gray-200', isCollapsed && 'lg:hidden')}>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Signed in as</p>
            <p className="text-sm font-medium text-gray-900 truncate">{user.email}</p>
            <p className="text-xs text-gray-500 capitalize">{user.role.replace('_', ' ').toLowerCase()}</p>
            {user.organization_name && (
              <p className="text-xs text-gray-400 truncate">{user.organization_name}</p>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}