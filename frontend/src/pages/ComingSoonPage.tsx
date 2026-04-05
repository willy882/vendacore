import { Construction } from 'lucide-react';
import { useLocation } from 'react-router-dom';

const LABELS: Record<string, string> = {
  '/ventas':     'Módulo de Ventas (POS)',
  '/productos':  'Módulo de Productos',
  '/inventario': 'Módulo de Inventario',
  '/clientes':   'Módulo de Clientes',
  '/proveedores':'Módulo de Proveedores',
  '/compras':    'Módulo de Compras',
  '/gastos':     'Módulo de Gastos',
  '/caja':       'Módulo de Caja',
  '/reportes':   'Módulo de Reportes',
  '/auditoria':  'Módulo de Auditoría',
  '/usuarios':   'Módulo de Usuarios',
};

export default function ComingSoonPage() {
  const { pathname } = useLocation();
  const label = LABELS[pathname] ?? 'Esta sección';

  return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center">
        <Construction size={32} className="text-amber-600" />
      </div>
      <h2 className="text-xl font-semibold text-slate-800">{label}</h2>
      <p className="text-slate-500 text-sm max-w-sm">
        Esta sección está en desarrollo. Pronto estará disponible.
      </p>
    </div>
  );
}
