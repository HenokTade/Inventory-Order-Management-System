import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useMe } from '../api/hooks';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(true);

  const hasToken = api.isAuthenticated();
  const { data: user, isLoading: meLoading, error, refetch } = useMe(hasToken);

  useEffect(() => {
    api.setAuthFailureHandler(() => {
      queryClient.clear();
      navigate('/login', { replace: true });
    });
  }, [navigate, queryClient]);

  useEffect(() => {
    if (!hasToken) {
      setIsLoading(false);
      return;
    }

    if (!meLoading) {
      setIsLoading(false);
    }
  }, [hasToken, meLoading]);

  useEffect(() => {
    if (error && hasToken) {
      api.logout();
      queryClient.clear();
      navigate('/login', { replace: true });
    }
  }, [error, hasToken, navigate, queryClient]);

  const login = async (email: string, password: string) => {
    await api.login({ email, password });
    await refetch();
    const from = location.state?.from?.pathname || '/';
    navigate(from, { replace: true });
  };

  const logout = () => {
    api.logout();
    queryClient.clear();
    navigate('/login', { replace: true });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const isFullyAuthenticated = hasToken && !!user;

  return (
    <AuthContext.Provider
      value={{
        user: isFullyAuthenticated ? user : null,
        isLoading,
        isAuthenticated: isFullyAuthenticated,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}