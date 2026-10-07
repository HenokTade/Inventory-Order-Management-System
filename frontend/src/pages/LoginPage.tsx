import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      await login(data.email, data.password);
      toast.success('Welcome back!');
    } catch (error: any) {
      const message = error.response?.data?.detail || error.message || 'Login failed. Please check your credentials.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 fade-in">
      <div className="w-full max-w-md slide-up delay-100">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 rotate-in delay-200">
            Inventory &amp; Order Management
          </h1>
          <p className="mt-2 text-gray-600 fade-in delay-300">
            Sign in to your account
          </p>
        </div>

        <div className="bg-white py-8 px-6 shadow-sm rounded-lg border border-gray-200 hover-lift-lg fade-in delay-400">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1 fade-in delay-100">
                Email address
              </label>
              <div className="relative shine">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5 pulse delay-200" />
                <input
                  {...register('email')}
                  id="email"
                  type="email"
                  autoComplete="email"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors"
                  placeholder="you@example.com"
                  disabled={isLoading}
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-red-600 fade-in delay-300">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1 fade-in delay-100">
                Password
              </label>
              <div className="relative shine">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5 pulse delay-200" />
                <input
                  {...register('password')}
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="w-full pl-10 pr-12 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors"
                  placeholder="••••••••"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 fade-in delay-300"
                >
                  {showPassword ? <EyeOff className="h-5 w-5 pulse delay-400" /> : <Eye className="h-5 w-5 pulse delay-400" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600 fade-in delay-300">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors btn-animate shine"
            >
              {isLoading ? (
                <>
                  Signing in...
                  <span className="inline-block ml-2 pulse"></span>
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500 fade-in delay-300">
            <p>Demo credentials:</p>
            <p className="font-mono text-xs mt-1 fade-in delay-100">admin@demo.local / Demo12345!</p>
            <p className="font-mono text-xs mt-1 fade-in delay-200">warehouse@demo.local / Demo12345!</p>
            <p className="font-mono text-xs mt-1 fade-in delay-300">vendor@demo.local / Demo12345!</p>
          </div>
        </div>
      </div>
    </div>
  );
}