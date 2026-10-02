export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: 'SUPER_ADMIN' | 'WAREHOUSE_MANAGER' | 'VENDOR';
  organization: number | null;
  organization_name: string | null;
  organization_type: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Organization {
  id: number;
  name: string;
  type: 'DISTRIBUTOR' | 'VENDOR';
  contact_email: string;
  contact_phone: string;
  address: string;
  created_at: string;
  user_count: number;
}

export interface Product {
  id: number;
  sku_code: string;
  barcode: string;
  name: string;
  description: string;
  unit_price: string;
  wholesale_price: string | null;
  wholesale_min_qty: number;
  stock_qty: number;
  safety_stock: number;
  organization: number;
  organization_name: string;
  shared_with: number[];
  aisle: string;
  rack: string;
  shelf: string;
  bin: string;
  location: string;
  is_active: boolean;
  is_low_stock: boolean;
  created_at: string;
  updated_at: string;
}

export interface StockLog {
  id: number;
  product: number;
  product_sku: string;
  product_name: string;
  change_qty: number;
  quantity_after: number;
  reason: 'STOCK_IN' | 'STOCK_OUT' | 'DAMAGED' | 'ADJUSTED' | 'ORDER' | 'ORDER_CANCELLED' | 'RESTOCK_RECEIVED';
  note: string;
  user: number | null;
  user_email: string | null;
  created_at: string;
}

export interface RestockOrder {
  id: number;
  product: number;
  product_sku: string;
  product_name: string;
  quantity: number;
  trigger_stock: number;
  threshold: number;
  status: 'DRAFT' | 'SENT' | 'RECEIVED' | 'CANCELLED';
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: number;
  product: number;
  product_sku: string;
  product_name: string;
  quantity: number;
  price_at_purchase: string;
  line_total: number;
}

export interface Order {
  id: number;
  order_number: string;
  vendor: number;
  vendor_name: string;
  placed_by: number | null;
  placed_by_email: string | null;
  status: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED';
  total_amount: string;
  item_count: number;
  shipping_address: string;
  notes: string;
  items: OrderItem[];
  invoice_id: number | null;
  allowed_transitions: string[];
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: number;
  invoice_number: string;
  order: number;
  order_number: string;
  vendor_name: string;
  issue_date: string;
  due_date: string;
  payment_terms: string;
  subtotal: string;
  tax_rate: string;
  tax_amount: string;
  total_amount: string;
  status: 'UNPAID' | 'PAYMENT_SUBMITTED' | 'PAID' | 'OVERDUE' | 'VOID';
  payment_reference: string;
  proof_of_payment: string;
  proof_url: string | null;
  pdf_file: string;
  pdf_url: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: User;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface CheckoutItem {
  product_id: number;
  quantity: number;
}

export interface CheckoutRequest {
  items: CheckoutItem[];
  shipping_address?: string;
  notes?: string;
}

export interface CheckoutResponse {
  order: Order;
  message: string;
}

export interface OrderStatusUpdate {
  status: Order['status'];
}

export interface InvoicePaymentSubmit {
  payment_reference: string;
  proof_of_payment?: File | null;
}

export interface StockAdjustment {
  change_qty?: number;
  new_quantity?: number;
  reason: StockLog['reason'];
  note?: string;
}

export interface ProductCreate {
  sku_code: string;
  barcode?: string;
  name: string;
  description?: string;
  unit_price: string;
  wholesale_price?: string;
  wholesale_min_qty?: number;
  safety_stock?: number;
  organization?: number;
  shared_with?: number[];
  aisle?: string;
  rack?: string;
  shelf?: string;
  bin?: string;
  is_active?: boolean;
}

export interface ProductUpdate extends Partial<ProductCreate> {}

export interface UserCreate {
  email: string;
  first_name: string;
  last_name: string;
  password: string;
  role: 'SUPER_ADMIN' | 'WAREHOUSE_MANAGER' | 'VENDOR';
  organization?: number;
  is_active?: boolean;
}

export interface UserUpdate extends Partial<UserCreate> {}

export interface OrganizationCreate {
  name: string;
  type: 'DISTRIBUTOR' | 'VENDOR';
  contact_email?: string;
  contact_phone?: string;
  address?: string;
}

export interface OrganizationUpdate extends Partial<OrganizationCreate> {}