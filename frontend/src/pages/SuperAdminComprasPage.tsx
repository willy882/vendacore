import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Plus, Trash2, Receipt, RefreshCw, DollarSign,
  Calendar, Tag, ChevronDown, ChevronUp, TrendingUp,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

async function fetchExchangeRate(): Promise<number> {
  // Intentamos dos APIs en caso de fallo
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    const data = await res.json();
    if (data?.rates?.PEN) return data.rates.PEN as number;
  } catch { /* fallback */ }

  const res2 = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
  const data2 = await res2.json();
  return data2.rates.PEN as number;
}

function useUsdToPen() {
  return useQuery({
    queryKey: ['usd-pen-rate'],
    queryFn: fetchExchangeRate,
    staleTime: 60 * 60 * 1000, // refresca cada hora
    gcTime: 2 * 60 * 60 * 1000,
  });
}

const STORAGE_KEY = 'sa_gastos_operativos';

const CATEGORIAS = [
  { value: 'ia',        label: 'IA / Modelos',       color: 'bg-purple-100 text-purple-700' },
  { value: 'hosting',   label: 'Hosting / Cloud',     color: 'bg-blue-100 text-blue-700' },
  { value: 'devtools',  label: 'Herramientas Dev',    color: 'bg-amber-100 text-amber-700' },
  { value: 'tiendas',   label: 'Tiendas / Stores',    color: 'bg-green-100 text-green-700' },
  { value: 'marketing', label: 'Marketing',            color: 'bg-pink-100 text-pink-700' },
  { value: 'otros',     label: 'Otros',                color: 'bg-slate-100 text-slate-600' },
];

const FRECUENCIAS = [
  { value: 'mensual',   label: 'Mensual' },
  { value: 'anual',     label: 'Anual' },
  { value: 'trimestral',label: 'Trimestral' },
  { value: 'unico',     label: 'Pago único' },
];

interface Gasto {
  id: string;
  concepto: string;
  categoria: string;
  monto: number;
  moneda: 'PEN' | 'USD';
  fecha: string;
  esRecurrente: boolean;
  frecuencia: string;
  notas: string;
  createdAt: string;
}

function loadGastos(): Gasto[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}

function saveGastos(g: Gasto[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(g));
}

const emptyForm = {
  concepto: '',
  categoria: 'ia',
  monto: '',
  moneda: 'USD' as 'PEN' | 'USD',
  fecha: new Date().toISOString().slice(0, 10),
  esRecurrente: true,
  frecuencia: 'mensual',
  notas: '',
};

function GastoModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: Gasto | null;
  onSave: (g: Omit<Gasto, 'id' | 'createdAt'>) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState(
    initial
      ? { ...initial, monto: String(initial.monto) }
      : { ...emptyForm }
  );
  const [err, setErr] = useState('');

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.concepto.trim()) return setErr('El concepto es obligatorio');
    const monto = parseFloat(form.monto as any);
    if (!monto || monto <= 0) return setErr('El monto debe ser mayor a 0');
    setErr('');
    onSave({ ...form, monto });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? 'Editar gasto' : 'Nuevo gasto operativo'}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>Guardar</Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Concepto */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Concepto *</label>
          <input
            value={form.concepto}
            onChange={(e) => set('concepto', e.target.value)}
            placeholder="Ej. Claude Code, Fly.io, Google Play"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Categoría */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Categoría</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIAS.map((c) => (
              <button
                key={c.value}
                onClick={() => set('categoria', c.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  form.categoria === c.value
                    ? 'border-blue-500 ring-2 ring-blue-200 ' + c.color
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Monto + Moneda */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Monto *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.monto}
              onChange={(e) => set('monto', e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Moneda</label>
            <div className="flex gap-2">
              {(['USD', 'PEN'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => set('moneda', m)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    form.moneda === m
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {m === 'USD' ? '$ USD' : 'S/ PEN'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Fecha + Recurrente */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Fecha de pago</label>
            <input
              type="date"
              value={form.fecha}
              onChange={(e) => set('fecha', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Frecuencia</label>
            <select
              value={form.frecuencia}
              onChange={(e) => set('frecuencia', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {FRECUENCIAS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Recurrente toggle */}
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <div
            onClick={() => set('esRecurrente', !form.esRecurrente)}
            className={`w-10 h-5 rounded-full transition-colors relative ${form.esRecurrente ? 'bg-blue-600' : 'bg-slate-300'}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.esRecurrente ? 'left-5' : 'left-0.5'}`} />
          </div>
          <span className="text-sm text-slate-700">Gasto recurrente</span>
        </label>

        {/* Notas */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Notas (opcional)</label>
          <textarea
            value={form.notas}
            onChange={(e) => set('notas', e.target.value)}
            rows={2}
            placeholder="Ej. Plan Pro, cuenta personal, etc."
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{err}</p>}
      </div>
    </Modal>
  );
}

export default function SuperAdminComprasPage() {
  const [gastos, setGastos] = useState<Gasto[]>(loadGastos);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Gasto | null>(null);
  const [filterCat, setFilterCat] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: rate, isFetching: loadingRate } = useUsdToPen();

  const toSoles = (usd: number) => rate ? usd * rate : null;

  const persist = (g: Gasto[]) => { setGastos(g); saveGastos(g); };

  const handleSave = (data: Omit<Gasto, 'id' | 'createdAt'>) => {
    if (editing) {
      persist(gastos.map((g) => g.id === editing.id ? { ...g, ...data } : g));
      setEditing(null);
    } else {
      persist([{ id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...data }, ...gastos]);
    }
    setShowModal(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('¿Eliminar este gasto?')) persist(gastos.filter((g) => g.id !== id));
  };

  const filtered = useMemo(() =>
    filterCat ? gastos.filter((g) => g.categoria === filterCat) : gastos,
    [gastos, filterCat]
  );

  // KPIs
  const totalUSD = gastos.filter((g) => g.moneda === 'USD').reduce((s, g) => s + g.monto, 0);
  const totalPEN = gastos.filter((g) => g.moneda === 'PEN').reduce((s, g) => s + g.monto, 0);
  const totalEnSoles = rate ? totalUSD * rate + totalPEN : null;
  const recurrentes = gastos.filter((g) => g.esRecurrente).length;

  const catInfo = (cat: string) => CATEGORIAS.find((c) => c.value === cat) ?? CATEGORIAS[CATEGORIAS.length - 1];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Gastos Operativos</h1>
          <p className="text-sm text-slate-500 mt-0.5">Suscripciones, licencias y herramientas de WCode</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={() => { setEditing(null); setShowModal(true); }}>
          Nuevo gasto
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="text-center py-4">
          <p className="text-2xl font-bold text-slate-700">{gastos.length}</p>
          <p className="text-xs text-slate-500 mt-1">Total gastos</p>
        </Card>
        <Card className="text-center py-4">
          <p className="text-2xl font-bold text-green-600">${totalUSD.toFixed(2)}</p>
          {toSoles(totalUSD) !== null && (
            <p className="text-xs text-green-500 mt-0.5">≈ S/ {toSoles(totalUSD)!.toFixed(2)}</p>
          )}
          <p className="text-xs text-slate-500 mt-1">Total USD</p>
        </Card>
        <Card className="text-center py-4">
          <p className="text-2xl font-bold text-blue-600">
            S/ {totalEnSoles !== null ? totalEnSoles.toFixed(2) : totalPEN.toFixed(2)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {totalEnSoles !== null ? 'Total en soles' : 'Total PEN'}
          </p>
        </Card>
        <Card className="text-center py-4">
          <p className="text-2xl font-bold text-purple-600">{recurrentes}</p>
          <p className="text-xs text-slate-500 mt-1">Recurrentes</p>
        </Card>
      </div>

      {/* Tipo de cambio */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <TrendingUp size={13} />
        {loadingRate ? (
          <span>Obteniendo tipo de cambio...</span>
        ) : rate ? (
          <span>Tipo de cambio: <strong className="text-slate-600">1 USD = S/ {rate.toFixed(3)}</strong> · Actualizado automáticamente</span>
        ) : (
          <span>No se pudo obtener el tipo de cambio</span>
        )}
      </div>

      {/* Filtro por categoría */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterCat('')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
            !filterCat ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
          }`}
        >
          Todos
        </button>
        {CATEGORIAS.map((c) => {
          const count = gastos.filter((g) => g.categoria === c.value).length;
          if (!count) return null;
          return (
            <button
              key={c.value}
              onClick={() => setFilterCat(filterCat === c.value ? '' : c.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                filterCat === c.value
                  ? 'border-blue-500 ring-2 ring-blue-200 ' + c.color
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
              }`}
            >
              {c.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <Card className="py-16 text-center">
          <DollarSign size={36} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-400 text-sm">No hay gastos registrados</p>
          <Button className="mt-4" onClick={() => setShowModal(true)}>Agregar primer gasto</Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((g) => {
            const cat = catInfo(g.categoria);
            const expanded = expandedId === g.id;
            return (
              <Card key={g.id} padding="none" className="overflow-hidden">
                <div className="flex items-center gap-4 px-4 py-3">
                  {/* Icono categoría */}
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${cat.color}`}>
                    <Tag size={15} />
                  </div>

                  {/* Info principal */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-800 text-sm">{g.concepto}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cat.color}`}>{cat.label}</span>
                      {g.esRecurrente && (
                        <span className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                          <RefreshCw size={10} /> {FRECUENCIAS.find((f) => f.value === g.frecuencia)?.label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
                      <span className="flex items-center gap-1"><Calendar size={11} />{new Date(g.fecha).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      {g.notas && <span className="truncate max-w-xs">{g.notas}</span>}
                    </div>
                  </div>

                  {/* Monto */}
                  <div className="text-right shrink-0">
                    <p className="font-bold text-slate-800 text-base">
                      {g.moneda === 'USD' ? '$' : 'S/'} {g.monto.toFixed(2)}
                      <span className="text-xs font-normal text-slate-400 ml-1">{g.moneda}</span>
                    </p>
                    {g.moneda === 'USD' && (
                      <p className="text-xs text-emerald-600 font-medium">
                        {toSoles(g.monto) !== null
                          ? `≈ S/ ${toSoles(g.monto)!.toFixed(2)}`
                          : loadingRate ? 'Cargando...' : '—'}
                      </p>
                    )}
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => { setEditing(g); setShowModal(true); }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      title="Editar"
                    >
                      <Receipt size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(g.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 size={15} />
                    </button>
                    {g.notas && (
                      <button
                        onClick={() => setExpandedId(expanded ? null : g.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>
                    )}
                  </div>
                </div>

                {expanded && g.notas && (
                  <div className="px-4 pb-3 border-t border-slate-100 pt-2">
                    <p className="text-xs text-slate-500">{g.notas}</p>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {showModal && (
        <GastoModal
          initial={editing}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditing(null); }}
        />
      )}
    </div>
  );
}
