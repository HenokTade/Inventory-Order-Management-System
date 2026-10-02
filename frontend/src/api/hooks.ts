import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type {
  Order,
  Invoice,
  ProductCreate,
  ProductUpdate,
  StockAdjustment,
  CheckoutRequest,
  UserCreate,
  UserUpdate,
  OrganizationCreate,
  OrganizationUpdate,
} from '../types';

// Query keys
export const queryKeys = {
  auth: ['auth'] as const,
  me: ['auth', 'me'] as const,
  catalogs: ['catalogs'] as const,
  organizations: ['organizations'] as const,
  organization: (id: number) => ['organizations', id] as const,
  users: ['users'] as const,
  user: (id: number) => ['users', id] as const,
  products: (params?: Record<string, unknown>) => ['products', params] as const,
  product: (id: number) => ['products', id] as const,
  stockLogs: (params?: Record<string, unknown>) => ['stock-logs', params] as const,
  restocks: (params?: Record<string, unknown>) => ['restocks', params] as const,
  orders: (params?: Record<string, unknown>) => ['orders', params] as const,
  order: (id: number) => ['orders', id] as const,
  invoices: (params?: Record<string, unknown>) => ['invoices', params] as const,
  invoice: (id: number) => ['invoices', id] as const,
};

// Auth hooks
export function useMe(enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => api.getMe(),
    staleTime: 5 * 60 * 1000,
    retry: false,
    enabled,
  });
}

export function useCatalogs() {
  return useQuery({
    queryKey: queryKeys.catalogs,
    queryFn: () => api.getCatalogs(),
    staleTime: 10 * 60 * 1000,
  });
}

// Organization hooks
export function useOrganizations(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.organizations,
    queryFn: () => api.getOrganizations(params),
  });
}

export function useOrganization(id: number) {
  return useQuery({
    queryKey: queryKeys.organization(id),
    queryFn: () => api.getOrganization(id),
    enabled: !!id,
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: OrganizationCreate) => api.createOrganization(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations });
    },
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: OrganizationUpdate }) => api.updateOrganization(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations });
      queryClient.invalidateQueries({ queryKey: queryKeys.organization(id) });
    },
  });
}

export function useDeleteOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteOrganization(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations });
    },
  });
}

// User hooks
export function useUsers(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.users,
    queryFn: () => api.getUsers(params),
  });
}

export function useUser(id: number) {
  return useQuery({
    queryKey: queryKeys.user(id),
    queryFn: () => api.getUser(id),
    enabled: !!id,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UserCreate) => api.createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UserUpdate }) => api.updateUser(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users });
      queryClient.invalidateQueries({ queryKey: queryKeys.user(id) });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users });
    },
  });
}

// Product hooks
export function useProducts(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.products(params),
    queryFn: () => api.getProducts(params),
  });
}

export function useProduct(id: number) {
  return useQuery({
    queryKey: queryKeys.product(id),
    queryFn: () => api.getProduct(id),
    enabled: !!id,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ProductCreate) => api.createProduct(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products() });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: ProductUpdate }) => api.updateProduct(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products() });
      queryClient.invalidateQueries({ queryKey: queryKeys.product(id) });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products() });
    },
  });
}

export function useAdjustStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: StockAdjustment }) => api.adjustStock(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products() });
      queryClient.invalidateQueries({ queryKey: queryKeys.product(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.stockLogs() });
    },
  });
}

// Stock log hooks
export function useStockLogs(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.stockLogs(params),
    queryFn: () => api.getStockLogs(params),
  });
}

// Restock hooks
export function useRestocks(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.restocks(params),
    queryFn: () => api.getRestocks(params),
  });
}

// Order hooks
export function useOrders(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.orders(params),
    queryFn: () => api.getOrders(params),
  });
}

export function useOrder(id: number) {
  return useQuery({
    queryKey: queryKeys.order(id),
    queryFn: () => api.getOrder(id),
    enabled: !!id,
  });
}

export function useCheckout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CheckoutRequest) => api.checkout(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders() });
      queryClient.invalidateQueries({ queryKey: queryKeys.products() });
    },
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: Order['status'] }) => api.updateOrderStatus(id, status),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders() });
      queryClient.invalidateQueries({ queryKey: queryKeys.order(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices() });
    },
  });
}

// Invoice hooks
export function useInvoices(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.invoices(params),
    queryFn: () => api.getInvoices(params),
  });
}

export function useInvoice(id: number) {
  return useQuery({
    queryKey: queryKeys.invoice(id),
    queryFn: () => api.getInvoice(id),
    enabled: !!id,
  });
}

export function useSubmitPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: FormData }) => api.submitPayment(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices() });
      queryClient.invalidateQueries({ queryKey: queryKeys.invoice(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders() });
    },
  });
}

export function useUpdateInvoiceStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: Invoice['status'] }) => api.updateInvoiceStatus(id, status),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices() });
      queryClient.invalidateQueries({ queryKey: queryKeys.invoice(id) });
    },
  });
}