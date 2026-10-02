import { useAuth } from '../context/AuthContext';
import { Bell, Search, Menu, User, ChevronDown } from 'lucide-react';
import { cn } from '../utils/helpers';

interface HeaderProps {
  isSidebarCollapsed: boolean;
  onMenuClick: () => void;
}

export function Header({ isSidebarCollapsed, onMenuClick }: HeaderProps) {
  const { user } = useAuth();

  return (
    <header
      className={cn(
        'fixed top-0 right-0 z-30 h-16 bg-white border-b border-gray-200 transition-all duration-300 flex items-center px-4',
        isSidebarCollapsed ? 'left-16' : 'left-64'
      )}
    >
      <div className="w-full max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            aria-label="Toggle menu"
          >
            <Menu className="h-6 w-6" />
          </button>

          <div className="hidden sm:block relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Search..."
              className="w-64 pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors bg-gray-50"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button className="relative p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors">
            <Bell className="h-6 w-6" />
            <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full" />
          </button>

          <div className="relative">
            <button className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                <User className="h-5 w-5 text-primary-600" />
              </div>
              <span className="hidden md:block text-sm font-medium text-gray-700">
                {user?.first_name || user?.email.split('@')[0]}
              </span>
              <ChevronDown className="h-4 w-4 text-gray-400 hidden md:block" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}