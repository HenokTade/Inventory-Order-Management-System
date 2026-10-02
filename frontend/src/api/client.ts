import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import type { LoginCredentials, LoginResponse, Order, PaginatedResponse, User } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

type AuthFailureHandler = () => void;

class ApiClient {
  private client: AxiosInstance;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private onAuthFailure: AuthFailureHandler | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: false,
    });

    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        if (this.accessToken && config.headers) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        if (error.response?.status === 401 && !originalRequest._retry && this.refreshToken) {
          originalRequest._retry = true;
          try {
            await this.refreshAccessToken();
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${this.accessToken}`;
            }
            return this.client(originalRequest);
          } catch {
            this.clearTokens();
            this.triggerAuthFailure();
            return Promise.reject(error);
          }
        }

        if (error.response?.status === 401) {
          this.clearTokens();
          this.triggerAuthFailure();
        }

        return Promise.reject(error);
      }
    );

    this.loadTokensFromStorage();
  }

  setAuthFailureHandler(handler: AuthFailureHandler) {
    this.onAuthFailure = handler;
  }

  private triggerAuthFailure() {
    if (this.onAuthFailure) {
      this.onAuthFailure();
    }
  }

  private loadTokensFromStorage() {
    this.accessToken = localStorage.getItem('access_token');
    this.refreshToken = localStorage.getItem('refresh_token');
  }

  private saveTokensToStorage(access: string, refresh: string) {
    this.accessToken = access;
    this.refreshToken = refresh;
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
  }

  private clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }

  private async refreshAccessToken() {
    if (!this.refreshToken) throw new Error('No refresh token');

    const response = await axios.post(`${API_BASE_URL}/auth/token/refresh/`, {
      refresh: this.refreshToken,
    });

    const { access, refresh } = response.data;
    this.saveTokensToStorage(access, refresh);
  }

  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const response = await this.client.post<LoginResponse>('/auth/token/', credentials);
    const { access, refresh } = response.data;
    this.saveTokensToStorage(access, refresh);
    return response.data;
  }

  logout() {
    this.clearTokens();
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  // Auth endpoints
  async getMe(): Promise<User> {
    const response = await this.client.get<User>('/auth/me/');
    return response.data;
  }

  async getCatalogs() {
    const response = await this.client.get('/catalogs/');
    return response.data;
  }

  // Organization endpoints
  async getOrganizations(params?: Record<string, unknown>): Promise<PaginatedResponse<any>> {
    const response = await this.client.get<PaginatedResponse<any>>('/organizations/', { params });
    return response.data;
  }

  async getOrganization(id: number) {
    const response = await this.client.get(`/organizations/${id}/`);
    return response.data;
  }

  async createOrganization(data: any) {
    const response = await this.client.post('/organizations/', data);
    return response.data;
  }

  async updateOrganization(id: number, data: any) {
    const response = await this.client.patch(`/organizations/${id}/`, data);
    return response.data;
  }

  async deleteOrganization(id: number) {
    const response = await this.client.delete(`/organizations/${id}/`);
    return response.data;
  }

  // User endpoints
  async getUsers(params?: Record<string, unknown>): Promise<PaginatedResponse<User>> {
    const response = await this.client.get<PaginatedResponse<User>>('/users/', { params });
    return response.data;
  }

  async getUser(id: number): Promise<User> {
    const response = await this.client.get<User>(`/users/${id}/`);
    return response.data;
  }

  async createUser(data: any) {
    const response = await this.client.post('/users/', data);
    return response.data;
  }

  async updateUser(id: number, data: any) {
    const response = await this.client.patch(`/users/${id}/`, data);
    return response.data;
  }

  async deleteUser(id: number) {
    const response = await this.client.delete(`/users/${id}/`);
    return response.data;
  }

  // Inventory endpoints
  async getProducts(params?: Record<string, unknown>): Promise<PaginatedResponse<any>> {
    const response = await this.client.get<PaginatedResponse<any>>('/inventory/', { params });
    return response.data;
  }

  async getProduct(id: number) {
    const response = await this.client.get(`/inventory/${id}/`);
    return response.data;
  }

  async createProduct(data: any) {
    const response = await this.client.post('/inventory/', data);
    return response.data;
  }

  async updateProduct(id: number, data: any) {
    const response = await this.client.patch(`/inventory/${id}/`, data);
    return response.data;
  }

  async deleteProduct(id: number) {
    const response = await this.client.delete(`/inventory/${id}/`);
    return response.data;
  }

  async adjustStock(id: number, data: any) {
    const response = await this.client.post(`/inventory/${id}/adjust_stock/`, data);
    return response.data;
  }

  async getStockLogs(params?: Record<string, unknown>): Promise<PaginatedResponse<any>> {
    const response = await this.client.get<PaginatedResponse<any>>('/stock-logs/', { params });
    return response.data;
  }

  async getRestocks(params?: Record<string, unknown>): Promise<PaginatedResponse<any>> {
    const response = await this.client.get<PaginatedResponse<any>>('/restocks/', { params });
    return response.data;
  }

  // Order endpoints
  async getOrders(params?: Record<string, unknown>): Promise<PaginatedResponse<Order>> {
    const response = await this.client.get<PaginatedResponse<Order>>('/orders/', { params });
    return response.data;
  }

  async getOrder(id: number): Promise<Order> {
    const response = await this.client.get<Order>(`/orders/${id}/`);
    return response.data;
  }

  async checkout(data: any) {
    const response = await this.client.post('/orders/checkout/', data);
    return response.data;
  }

  async updateOrderStatus(id: number, status: string) {
    const response = await this.client.patch(`/orders/${id}/`, { status });
    return response.data;
  }

  // Invoice endpoints
  async getInvoices(params?: Record<string, unknown>): Promise<PaginatedResponse<any>> {
    const response = await this.client.get<PaginatedResponse<any>>('/invoices/', { params });
    return response.data;
  }

  async getInvoice(id: number) {
    const response = await this.client.get(`/invoices/${id}/`);
    return response.data;
  }

  async submitPayment(id: number, data: FormData) {
    const response = await this.client.post(`/invoices/${id}/submit_payment/`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  async updateInvoiceStatus(id: number, status: string) {
    const response = await this.client.patch(`/invoices/${id}/`, { status });
    return response.data;
  }

  // Health check
  async healthCheck() {
    const response = await this.client.get('/health/');
    return response.data;
  }
}

export const api = new ApiClient();