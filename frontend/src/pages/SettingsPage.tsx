import { useAuth } from '../context/AuthContext';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { User, Bell, Shield, Palette, Moon, Sun, Key, Check } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

export function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'security' | 'appearance'>('profile');
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [density, setDensity] = useState<'Comfortable' | 'Compact' | 'Spacious'>('Comfortable');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [lowStockAlerts, setLowStockAlerts] = useState(true);
  const [orderUpdates, setOrderUpdates] = useState(true);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your account settings and preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader title="Account" />
            <CardContent className="space-y-3">
              <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
                  <User className="h-6 w-6 text-primary-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{user?.first_name} {user?.last_name}</p>
                  <p className="text-sm text-gray-500">{user?.email}</p>
                </div>
              </div>
              <nav className="space-y-1">
                {[
                  { id: 'profile', label: 'Profile', icon: User },
                  { id: 'notifications', label: 'Notifications', icon: Bell },
                  { id: 'security', label: 'Security', icon: Shield },
                  { id: 'appearance', label: 'Appearance', icon: Palette },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <tab.icon className="h-5 w-5" />
                    {tab.label}
                  </button>
                ))}
              </nav>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          <Card>
            {activeTab === 'profile' && (
              <>
                <CardHeader title="Profile Information" description="Update your personal information" />
                <CardContent>
                  <form className="space-y-6 max-w-md">
                    <div className="grid grid-cols-2 gap-4">
                      <Input label="First Name" defaultValue={user?.first_name} disabled />
                      <Input label="Last Name" defaultValue={user?.last_name} disabled />
                    </div>
                    <Input label="Email" defaultValue={user?.email} disabled />
                    <Input label="Role" defaultValue={user?.role?.replace('_', ' ')} disabled />
                    <Input label="Organization" defaultValue={user?.organization_name || 'None'} disabled />
                    <p className="text-sm text-gray-500">Profile editing will be available in a future update.</p>
                  </form>
                </CardContent>
              </>
            )}

            {activeTab === 'notifications' && (
              <>
                <CardHeader title="Notifications" description="Configure how you receive notifications" />
                <CardContent>
                  <div className="space-y-6 max-w-md">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Email Notifications</p>
                        <p className="text-sm text-gray-500">Receive email updates about orders and inventory</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={emailNotifications}
                          onChange={(e) => setEmailNotifications(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                      </label>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Low Stock Alerts</p>
                        <p className="text-sm text-gray-500">Get notified when products fall below safety stock</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={lowStockAlerts}
                          onChange={(e) => setLowStockAlerts(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                      </label>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Order Updates</p>
                        <p className="text-sm text-gray-500">Notifications for order status changes</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={orderUpdates}
                          onChange={(e) => setOrderUpdates(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                      </label>
                    </div>
                  </div>
                </CardContent>
              </>
            )}

            {activeTab === 'security' && (
              <>
                <CardHeader title="Security" description="Manage your password and security settings" />
                <CardContent>
                  <form className="space-y-6 max-w-md">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                      <input type="password" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="••••••••" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                      <input type="password" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="••••••••" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                      <input type="password" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="••••••••" />
                    </div>
                    <Button onClick={() => toast.success('Password updated (demo)')}>Update Password</Button>
                  </form>
                  <div className="mt-8 pt-6 border-t border-gray-200">
                    <h4 className="font-medium text-gray-900 mb-4">Two-Factor Authentication</h4>
                    <p className="text-sm text-gray-500 mb-4">Add an extra layer of security to your account.</p>
                    <Button variant="outline" onClick={() => toast.success('2FA setup initiated (demo)')}>
                      <Key className="h-4 w-4 mr-2" /> Enable 2FA
                    </Button>
                  </div>
                </CardContent>
              </>
            )}

            {activeTab === 'appearance' && (
              <>
                <CardHeader title="Appearance" description="Customize how the application looks" />
                <CardContent>
                  <div className="space-y-6 max-w-md">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">Theme</label>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { id: 'light' as const, label: 'Light', icon: Sun },
                          { id: 'dark' as const, label: 'Dark', icon: Moon },
                          { id: 'system' as const, label: 'System', icon: Palette },
                        ].map((t) => (
                          <button
                            key={t.id}
                            onClick={() => { setTheme(t.id); toast.success(`Theme set to ${t.label} (demo)`); }}
                            className={`relative p-4 border-2 rounded-lg text-center transition-colors ${
                              theme === t.id
                                ? 'border-primary-600 bg-primary-50'
                                : 'hover:border-primary-300'
                            }`}
                          >
                            <t.icon className="h-6 w-6 mx-auto mb-2 text-gray-600" />
                            <p className="text-sm font-medium">{t.label}</p>
                            {theme === t.id && (
                              <div className="absolute top-2 right-2 bg-primary-600 text-white rounded-full w-5 h-5 flex items-center justify-center">
                                <Check className="h-3 w-3" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">Density</label>
                      <div className="grid grid-cols-3 gap-3">
                        {(['Comfortable', 'Compact', 'Spacious'] as const).map((d) => (
                          <button
                            key={d}
                            onClick={() => { setDensity(d); toast.success(`Density set to ${d} (demo)`); }}
                            className={`relative p-4 border-2 rounded-lg text-center transition-colors ${
                              density === d
                                ? 'border-primary-600 bg-primary-50'
                                : 'hover:border-primary-300'
                            }`}
                          >
                            <p className="text-sm font-medium">{d}</p>
                            {density === d && (
                              <div className="absolute top-2 right-2 bg-primary-600 text-white rounded-full w-5 h-5 flex items-center justify-center">
                                <Check className="h-3 w-3" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}