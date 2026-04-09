// ─── Auth ────────────────────────────────────────────────────────────────────

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

// ─── Users ───────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  businessId: string;
  role: Role;
  isActive: boolean;
}

export interface Role {
  id: string;
  name: string;
  permissions: RolePermission[];
}

export interface RolePermission {
  permission: { name: string };
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export interface DashboardKpis {
  ventas: {
    hoy:            { total: number; pctVsAyer: number };
    mes:            { total: number; pctVsAnterior: number };
    anio:           { total: number };
    ticketPromedio: number;
    igvMes:         number;
    descuentosMes:  number;
  };
  transacciones: { hoy: number; mes: number };
  finanzas: {
    gastosMes:    number;
    utilidadBruta: number;
    margenBruto:  number;
  };
  alertas: {
    stockCritico:           number;
    productosStockCritico:  ProductAlert[];
    comprobantesPendientes: number;
  };
}

export interface ProductAlert {
  id: string;
  nombre: string;
  stockActual: number;
  stockMinimo: number;
}

export interface SalesChartPoint   { date: string; total: number }
export interface VentasVsGastos    { mes: string; ventas: number; gastos: number; utilidad: number }
export interface PaymentMethodStat { id: string; nombre: string; tipo: string; monto: number; transacciones: number; porcentaje: number }
export interface CashFlowPoint     { date: string; ingresos: number; egresos: number; saldoAcumulado: number }
export interface TopProduct        { id: string; nombre: string; codigoInterno: string; cantidadVendida: number; ingresoTotal: number; transacciones: number }
export interface TopCustomer       { id: string; nombreCompleto: string; numeroDocumento: string; totalCompras: number; transacciones: number }

export interface FullDashboard {
  kpis:         DashboardKpis;
  graficos: {
    ventasVsGastos: VentasVsGastos[];
    topProductos:   TopProduct[];
    porMetodoPago:  PaymentMethodStat[];
    cashFlow:       CashFlowPoint[];
  };
  documentStats: Record<string, { cantidad: number; total: number }>;
  topClientes:   TopCustomer[];
  generadoEn:    string;
}

// ─── Products ────────────────────────────────────────────────────────────────

export interface Product {
  id: string;
  nombre: string;
  codigoInterno?: string;
  codigoBarras?:  string;
  descripcion?:   string;
  precioVenta:    number;
  precioCompra?:  number;
  igvTipo:        'gravado' | 'exonerado' | 'inafecto';
  stockActual:    number;
  stockMinimo:    number;
  isActive:       boolean;
  category?:      { id: string; nombre: string } | null;
  unidadMedida?:  string;
  imagenUrl?:     string | null;
}

export interface ProductCategory {
  id: string;
  nombre: string;
  descripcion?: string;
}

// ─── Customers ───────────────────────────────────────────────────────────────

export interface Customer {
  id: string;
  nombreCompleto:  string;
  tipoDocumento:   string;
  numeroDocumento: string;
  telefono?:       string;
  email?:          string;
  direccion?:      string;
  creditoUsado:    number;
  creditoLimite:   number;
}

// ─── Suppliers ───────────────────────────────────────────────────────────────

export interface Supplier {
  id: string;
  razonSocial:      string;
  ruc:              string;
  nombreContacto?:  string;
  telefono?:        string;
  email?:           string;
  direccion?:       string;
  deudaPendiente:   number;
}

// ─── Sales ───────────────────────────────────────────────────────────────────

export interface Sale {
  id:             string;
  fecha:          string;
  tipoVenta:      'contado' | 'credito';
  estado:         'activa' | 'anulada';
  subtotal:       number;
  igv:            number;
  descuentoTotal: number;
  total:          number;
  montoPagado:    number;
  saldoPendiente: number;
  customer?:      { nombreCompleto: string; numeroDocumento?: string } | null;
  user:           { nombre: string; apellido: string };
  items:          SaleItem[];
}

export interface SaleItem {
  id:            string;
  productId:     string;
  product:       { nombre: string };
  cantidad:      number;
  precioUnitario: number;
  descuento:     number;
  igvMonto:      number;
  total:         number;
}

// ─── Purchases ───────────────────────────────────────────────────────────────

export interface Purchase {
  id:              string;
  fecha:           string;
  supplierId:      string;
  supplier:        { razonSocial: string };
  user?:           { nombre: string; apellido: string } | null;
  tipoDocumento?:  string;
  numeroDocumento?: string;
  subtotal:        number;
  igv:             number;
  total:           number;
  estadoPago:      'pendiente' | 'parcial' | 'pagado';
  observaciones?:  string | null;
  items?:          { product: { nombre: string }; cantidad: number; costoUnitario: number; total: number }[];
}

// ─── Expenses ────────────────────────────────────────────────────────────────

export interface Expense {
  id:           string;
  fecha:        string;
  descripcion:  string;
  monto:        number;
  categoryId?:  string;
  category?:    { nombre: string } | null;
  observaciones?: string;
}

export interface ExpenseCategory {
  id: string;
  nombre: string;
}

// ─── Cash ────────────────────────────────────────────────────────────────────

export interface CashSession {
  id:                 string;
  estado:             'abierta' | 'cerrada';
  fechaApertura:      string;
  fechaCierre?:       string;
  montoApertura:      number;
  montoCierreSistema?: number;
  montoCierreReal?:   number;
  diferencia?:        number;
  saldoActual?:       number;
  user:               { nombre: string; apellido: string };
}

// ─── Audit ───────────────────────────────────────────────────────────────────

export interface AuditLog {
  id:              string;
  modulo:          string;
  accion:          string;
  entidad:         string;
  entidadId?:      string;
  datosAnteriores?: Record<string, unknown>;
  datosNuevos?:    Record<string, unknown>;
  ipAddress?:      string;
  createdAt:       string;
  user?: {
    id: string;
    nombre: string;
    apellido: string;
    email: string;
  } | null;
}

// ─── Paginated response ───────────────────────────────────────────────────────

export interface Paginated<T> {
  data:       T[];
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
}
