import { useState, useEffect } from 'react';
import {
  Plus, Pencil, Trash2, X, Eye, EyeOff,
  KeyRound, Bell, CreditCard, Check,
} from 'lucide-react';
import api from '@/lib/api';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Plan {
  id: string;
  nombre: string;
  descripcion?: string;
  precio: number | string;
  duracionDias: number;
  isActive: boolean;
  maxUsuarios?: number | null;
  maxProductos?: number | null;
  maxVentasMes?: number | null;
  maxDocumentosMes?: number | null;
}

interface AffectedBusiness {
  id: string;
  nombre: string;
  ruc: string;
  uso: number;
  limiteNuevo: number;
}

interface ValidationResult {
  afectados: {
    campo: string;
    label: string;
    limiteNuevo: number;
    negocios: AffectedBusiness[];
  }[];
}

interface Credential {
  id: string;
  servicio: string;
  url?: string;
  usuario?: string;
  passwordDecrypted?: string;
  notas?: string;
  createdAt: string;
}

interface Reminder {
  id: string;
  servicio: string;
  monto?: number | string;
  moneda: string;
  diaVencimiento?: number;
  notas?: string;
  activo: boolean;
  createdAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtMoney = (v: number | string | undefined, moneda = 'USD') => {
  if (!v) return '—';
  return `${moneda} ${Number(v).toFixed(2)}`;
};

const TODAY_DAY = new Date().getDate();

function daysUntil(dia?: number): number | null {
  if (!dia) return null;
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), dia);
  if (target < now) target.setMonth(target.getMonth() + 1);
  return Math.ceil((target.getTime() - now.getTime()) / 86_400_000);
}

// ── Componentes comunes ───────────────────────────────────────────────────────

function SectionHeader({ title, desc, onAdd }: { title: string; desc: string; onAdd: () => void }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h2 className="text-base font-bold text-slate-800">{title}</h2>
        <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
      </div>
      <button
        onClick={onAdd}
        className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded-xl text-xs font-semibold transition-colors"
      >
        <Plus size={13} /> Agregar
      </button>
    </div>
  );
}

// ── Tab: Planes ───────────────────────────────────────────────────────────────

const EMPTY_PLAN = {
  nombre: '', descripcion: '', precio: '', duracionDias: 30,
  maxUsuarios: '', maxProductos: '', maxVentasMes: '', maxDocumentosMes: '',
};

function PlanesTab() {
  const [plans, setPlans]           = useState<Plan[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [editing, setEditing]       = useState<Plan | null>(null);
  const [form, setForm]             = useState(EMPTY_PLAN);
  const [saving, setSaving]         = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [validating, setValidating] = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/super-admin/plans')
      .then((r) => setPlans(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(EMPTY_PLAN); setShowForm(true); setValidation(null); };
  const openEdit = (p: Plan) => {
    setEditing(p);
    setForm({
      nombre: p.nombre, descripcion: p.descripcion ?? '', precio: String(p.precio),
      duracionDias: p.duracionDias,
      maxUsuarios:      p.maxUsuarios      != null ? String(p.maxUsuarios)      : '',
      maxProductos:     p.maxProductos     != null ? String(p.maxProductos)     : '',
      maxVentasMes:     p.maxVentasMes     != null ? String(p.maxVentasMes)     : '',
      maxDocumentosMes: p.maxDocumentosMes != null ? String(p.maxDocumentosMes) : '',
    });
    setShowForm(true);
    setValidation(null);
  };

  const buildLimitsPayload = () => ({
    maxUsuarios:      form.maxUsuarios      ? Number(form.maxUsuarios)      : null,
    maxProductos:     form.maxProductos     ? Number(form.maxProductos)     : null,
    maxVentasMes:     form.maxVentasMes     ? Number(form.maxVentasMes)     : null,
    maxDocumentosMes: form.maxDocumentosMes ? Number(form.maxDocumentosMes) : null,
  });

  const handleValidate = async () => {
    if (!editing) { handleSave(); return; }
    setValidating(true);
    try {
      const limits = buildLimitsPayload();
      const { data } = await api.post(`/super-admin/plans/${editing.id}/validate-change`, limits);
      if (data.afectados?.length > 0) {
        setValidation(data);
      } else {
        handleSave();
      }
    } catch {
      handleSave();
    } finally {
      setValidating(false);
    }
  };

  const handleSave = async () => {
    if (!form.nombre || !form.precio) return;
    setSaving(true);
    try {
      const payload = {
        nombre: form.nombre, descripcion: form.descripcion,
        precio: Number(form.precio), duracionDias: form.duracionDias,
        ...buildLimitsPayload(),
      };
      if (editing) {
        await api.patch(`/super-admin/plans/${editing.id}`, payload);
      } else {
        await api.post('/super-admin/plans', payload);
      }
      setShowForm(false);
      setValidation(null);
      load();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (p: Plan) => {
    await api.patch(`/super-admin/plans/${p.id}`, { isActive: !p.isActive });
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este plan?')) return;
    await api.delete(`/super-admin/plans/${id}`);
    load();
  };

  return (
    <div>
      <SectionHeader
        title="Planes de suscripción"
        desc="Define los planes que puedes asignar a cada negocio."
        onAdd={openNew}
      />

      {loading ? (
        <div className="text-center py-10 text-slate-400 text-sm">Cargando...</div>
      ) : plans.length === 0 ? (
        <div className="text-center py-10 text-slate-400 text-sm">Sin planes creados</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((p) => (
            <div key={p.id} className={`bg-white border rounded-2xl p-4 space-y-2 transition-opacity ${p.isActive ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-slate-800">{p.nombre}</p>
                  {p.descripcion && <p className="text-xs text-slate-500 mt-0.5">{p.descripcion}</p>}
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {p.isActive ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <span className="text-xl font-bold text-slate-900">S/. {Number(p.precio).toFixed(2)}</span>
                <span className="text-xs text-slate-400">/ {p.duracionDias} días</span>
              </div>
              {/* Límites */}
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {[
                  { label: 'Usuarios',   val: p.maxUsuarios },
                  { label: 'Productos',  val: p.maxProductos },
                  { label: 'Ventas/mes', val: p.maxVentasMes },
                  { label: 'Docs/mes',   val: p.maxDocumentosMes },
                ].map(({ label, val }) => (
                  <span key={label} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${val != null ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-400'}`}>
                    {label}: {val != null ? val : '∞'}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button onClick={() => openEdit(p)} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-600 hover:bg-slate-50">
                  <Pencil size={12} /> Editar
                </button>
                <button onClick={() => handleToggle(p)} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-600 hover:bg-slate-50">
                  {p.isActive ? 'Desactivar' : 'Activar'}
                </button>
                <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-xl border border-red-100 text-red-500 hover:bg-red-50">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-bold text-slate-800">{editing ? 'Editar plan' : 'Nuevo plan'}</p>
              <button onClick={() => setShowForm(false)}><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Nombre del plan *</label>
                <input value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:border-slate-500" placeholder="Ej: Básico, Pro, Enterprise" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Descripción</label>
                <input value={form.descripcion} onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:border-slate-500" placeholder="Descripción breve" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Precio (S/.) *</label>
                  <input type="number" min="0" step="0.01" value={form.precio} onChange={(e) => setForm((f) => ({ ...f, precio: e.target.value }))}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:border-slate-500" placeholder="0.00" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Duración (días)</label>
                  <input type="number" min="1" value={form.duracionDias} onChange={(e) => setForm((f) => ({ ...f, duracionDias: Number(e.target.value) }))}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:border-slate-500" />
                </div>
              </div>

              {/* Límites — vacío = ilimitado */}
              <div className="pt-1">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Límites (vacío = ilimitado)</p>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { key: 'maxUsuarios',      label: 'Máx. usuarios' },
                    { key: 'maxProductos',     label: 'Máx. productos' },
                    { key: 'maxVentasMes',     label: 'Máx. ventas/mes' },
                    { key: 'maxDocumentosMes', label: 'Máx. docs SUNAT/mes' },
                  ] as const).map(({ key, label }) => (
                    <div key={key}>
                      <label className="text-xs text-slate-500 mb-1 block">{label}</label>
                      <input
                        type="number" min="1"
                        value={(form as any)[key]}
                        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400"
                        placeholder="∞"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Advertencia de negocios afectados */}
              {validation && validation.afectados.length > 0 && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-bold text-amber-800">Advertencia: negocios que superarían el nuevo límite</p>
                  {validation.afectados.map((g) => (
                    <div key={g.campo}>
                      <p className="text-xs font-semibold text-amber-700">{g.label} → nuevo límite: {g.limiteNuevo}</p>
                      <ul className="mt-1 space-y-0.5">
                        {g.negocios.map((n) => (
                          <li key={n.id} className="text-xs text-amber-700 flex items-center gap-1.5">
                            <span className="font-mono text-[10px] bg-amber-100 px-1 rounded">{n.ruc}</span>
                            {n.nombre} — uso actual: <strong>{n.uso}</strong>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  <p className="text-[11px] text-amber-700">Estos negocios quedarán bloqueados al superar su límite. ¿Confirmar de todas formas?</p>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => { setShowForm(false); setValidation(null); }} className="flex-1 py-2 border border-slate-300 rounded-xl text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
              {validation && validation.afectados.length > 0 ? (
                <>
                  <button onClick={() => setValidation(null)} className="py-2 px-3 border border-amber-300 text-amber-700 rounded-xl text-sm hover:bg-amber-50">Revisar</button>
                  <button onClick={handleSave} disabled={saving}
                    className="flex-1 py-2 bg-amber-600 text-white rounded-xl text-sm font-semibold hover:bg-amber-700 disabled:opacity-50">
                    {saving ? 'Guardando...' : 'Confirmar igual'}
                  </button>
                </>
              ) : (
                <button onClick={handleValidate} disabled={saving || validating || !form.nombre || !form.precio}
                  className="flex-1 py-2 bg-slate-800 text-white rounded-xl text-sm font-semibold hover:bg-slate-700 disabled:opacity-50">
                  {validating ? 'Verificando...' : saving ? 'Guardando...' : 'Guardar'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab: Bóveda ───────────────────────────────────────────────────────────────

const EMPTY_CRED = { servicio: '', url: '', usuario: '', password: '', notas: '' };

function BovedaTab() {
  const [creds, setCreds]         = useState<Credential[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState<Credential | null>(null);
  const [form, setForm]           = useState(EMPTY_CRED);
  const [saving, setSaving]       = useState(false);
  const [visible, setVisible]     = useState<Record<string, boolean>>({});
  const [showPwd, setShowPwd]     = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/super-admin/credentials')
      .then((r) => setCreds(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openNew  = () => { setEditing(null); setForm(EMPTY_CRED); setShowForm(true); setShowPwd(false); };
  const openEdit = (c: Credential) => {
    setEditing(c);
    setForm({ servicio: c.servicio, url: c.url ?? '', usuario: c.usuario ?? '', password: c.passwordDecrypted ?? '', notas: c.notas ?? '' });
    setShowForm(true); setShowPwd(false);
  };

  const handleSave = async () => {
    if (!form.servicio) return;
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/super-admin/credentials/${editing.id}`, form);
      } else {
        await api.post('/super-admin/credentials', form);
      }
      setShowForm(false);
      load();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta credencial?')) return;
    await api.delete(`/super-admin/credentials/${id}`);
    load();
  };

  return (
    <div>
      <SectionHeader
        title="Bóveda de credenciales"
        desc="Guarda tus claves de Fly.io, Vercel, Neon y otros servicios."
        onAdd={openNew}
      />

      {loading ? (
        <div className="text-center py-10 text-slate-400 text-sm">Cargando...</div>
      ) : creds.length === 0 ? (
        <div className="flex flex-col items-center py-12 gap-3 text-slate-400">
          <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center">
            <KeyRound size={22} className="text-slate-400" />
          </div>
          <p className="text-sm">Sin credenciales guardadas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {creds.map((c) => (
            <div key={c.id} className="bg-white border border-slate-200 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <KeyRound size={16} className="text-slate-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800">{c.servicio}</p>
                    {c.url && <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline truncate block">{c.url}</a>}
                    {c.usuario && <p className="text-xs text-slate-500 mt-0.5">Usuario: <span className="font-mono">{c.usuario}</span></p>}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              {c.passwordDecrypted && (
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-mono text-xs text-slate-700">
                    {visible[c.id] ? c.passwordDecrypted : '••••••••••••'}
                  </div>
                  <button
                    onClick={() => setVisible((v) => ({ ...v, [c.id]: !v[c.id] }))}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                  >
                    {visible[c.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              )}
              {c.notas && <p className="mt-2 text-xs text-slate-500 italic">{c.notas}</p>}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-bold text-slate-800">{editing ? 'Editar credencial' : 'Nueva credencial'}</p>
              <button onClick={() => setShowForm(false)}><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              {[
                { key: 'servicio', label: 'Servicio *', placeholder: 'Ej: Fly.io, Vercel, Neon' },
                { key: 'url', label: 'URL', placeholder: 'https://fly.io/dashboard' },
                { key: 'usuario', label: 'Usuario / Email', placeholder: 'usuario@ejemplo.com' },
                { key: 'notas', label: 'Notas', placeholder: 'Información adicional...' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="text-xs text-slate-500 mb-1 block">{label}</label>
                  <input
                    value={(form as any)[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:border-slate-500"
                    placeholder={placeholder}
                  />
                </div>
              ))}
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Contraseña</label>
                <div className="flex items-center gap-2">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    className="flex-1 border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:border-slate-500 font-mono"
                    placeholder="Contraseña"
                  />
                  <button type="button" onClick={() => setShowPwd((p) => !p)} className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-50">
                    {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 border border-slate-300 rounded-xl text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button onClick={handleSave} disabled={saving || !form.servicio}
                className="flex-1 py-2 bg-slate-800 text-white rounded-xl text-sm font-semibold hover:bg-slate-700 disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab: Recordatorios ────────────────────────────────────────────────────────

const EMPTY_REM = { servicio: '', monto: '', moneda: 'USD', diaVencimiento: '', notas: '' };

function RecordatoriosTab() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState<Reminder | null>(null);
  const [form, setForm]           = useState(EMPTY_REM);
  const [saving, setSaving]       = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/super-admin/reminders')
      .then((r) => setReminders(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openNew  = () => { setEditing(null); setForm(EMPTY_REM); setShowForm(true); };
  const openEdit = (r: Reminder) => {
    setEditing(r);
    setForm({ servicio: r.servicio, monto: r.monto ? String(r.monto) : '', moneda: r.moneda, diaVencimiento: r.diaVencimiento ? String(r.diaVencimiento) : '', notas: r.notas ?? '' });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.servicio) return;
    setSaving(true);
    try {
      const payload = {
        servicio: form.servicio,
        monto: form.monto ? Number(form.monto) : undefined,
        moneda: form.moneda,
        diaVencimiento: form.diaVencimiento ? Number(form.diaVencimiento) : undefined,
        notas: form.notas || undefined,
      };
      if (editing) {
        await api.patch(`/super-admin/reminders/${editing.id}`, payload);
      } else {
        await api.post('/super-admin/reminders', payload);
      }
      setShowForm(false);
      load();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (r: Reminder) => {
    await api.patch(`/super-admin/reminders/${r.id}`, { activo: !r.activo });
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este recordatorio?')) return;
    await api.delete(`/super-admin/reminders/${id}`);
    load();
  };

  const urgencyColor = (days: number | null) => {
    if (days === null) return 'bg-slate-100 text-slate-600';
    if (days <= 3)  return 'bg-red-100 text-red-700';
    if (days <= 7)  return 'bg-amber-100 text-amber-700';
    return 'bg-emerald-100 text-emerald-700';
  };

  return (
    <div>
      <SectionHeader
        title="Recordatorios de pago"
        desc="Servicios con pago mensual o periódico para que no se te olvide renovar."
        onAdd={openNew}
      />

      {/* Resumen de pagos próximos */}
      {reminders.filter((r) => r.activo && r.diaVencimiento).length > 0 && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex flex-wrap gap-3">
          <p className="text-xs font-semibold text-amber-700 w-full">Próximos vencimientos este mes:</p>
          {reminders
            .filter((r) => r.activo && r.diaVencimiento)
            .sort((a, b) => (a.diaVencimiento ?? 0) - (b.diaVencimiento ?? 0))
            .map((r) => {
              const days = daysUntil(r.diaVencimiento);
              return (
                <span key={r.id} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${urgencyColor(days)}`}>
                  <Bell size={10} />
                  {r.servicio} — día {r.diaVencimiento}
                  {days !== null && <span>({days === 0 ? 'hoy' : `${days}d`})</span>}
                </span>
              );
            })}
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-slate-400 text-sm">Cargando...</div>
      ) : reminders.length === 0 ? (
        <div className="flex flex-col items-center py-12 gap-3 text-slate-400">
          <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center">
            <Bell size={22} className="text-slate-400" />
          </div>
          <p className="text-sm">Sin recordatorios configurados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reminders.map((r) => {
            const days = daysUntil(r.diaVencimiento);
            return (
              <div key={r.id} className={`bg-white border rounded-2xl p-4 transition-opacity ${r.activo ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                      <CreditCard size={16} className="text-amber-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-800">{r.servicio}</p>
                        {!r.activo && <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-semibold">Inactivo</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {r.monto && (
                          <span className="text-xs font-semibold text-slate-700">{fmtMoney(r.monto, r.moneda)}</span>
                        )}
                        {r.diaVencimiento && (
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${r.diaVencimiento === TODAY_DAY ? 'bg-red-100 text-red-700' : urgencyColor(days)}`}>
                            Día {r.diaVencimiento}
                            {days !== null && <span> · {days === 0 ? 'vence hoy' : `${days}d`}</span>}
                          </span>
                        )}
                      </div>
                      {r.notas && <p className="text-xs text-slate-500 italic mt-1">{r.notas}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => handleToggle(r)} title={r.activo ? 'Desactivar' : 'Activar'}
                      className={`p-1.5 rounded-lg transition-colors ${r.activo ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'}`}>
                      <Check size={13} />
                    </button>
                    <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => handleDelete(r.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-bold text-slate-800">{editing ? 'Editar recordatorio' : 'Nuevo recordatorio'}</p>
              <button onClick={() => setShowForm(false)}><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Servicio *</label>
                <input value={form.servicio} onChange={(e) => setForm((f) => ({ ...f, servicio: e.target.value }))}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:border-slate-500"
                  placeholder="Ej: Fly.io, Neon, Vercel Pro" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Monto</label>
                  <input type="number" min="0" step="0.01" value={form.monto}
                    onChange={(e) => setForm((f) => ({ ...f, monto: e.target.value }))}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:border-slate-500"
                    placeholder="0.00" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Moneda</label>
                  <select value={form.moneda} onChange={(e) => setForm((f) => ({ ...f, moneda: e.target.value }))}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:border-slate-500 bg-white">
                    <option>USD</option>
                    <option>PEN</option>
                    <option>EUR</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Día de vencimiento (1-31)</label>
                <input type="number" min="1" max="31" value={form.diaVencimiento}
                  onChange={(e) => setForm((f) => ({ ...f, diaVencimiento: e.target.value }))}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:border-slate-500"
                  placeholder="Ej: 15 = vence el día 15 de cada mes" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Notas</label>
                <textarea value={form.notas} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                  rows={2}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:border-slate-500 resize-none"
                  placeholder="Información adicional..." />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 border border-slate-300 rounded-xl text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button onClick={handleSave} disabled={saving || !form.servicio}
                className="flex-1 py-2 bg-slate-800 text-white rounded-xl text-sm font-semibold hover:bg-slate-700 disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

type Tab = 'planes' | 'boveda' | 'recordatorios';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'planes',        label: 'Planes',        icon: <CreditCard size={15} /> },
  { id: 'boveda',        label: 'Bóveda',         icon: <KeyRound size={15} /> },
  { id: 'recordatorios', label: 'Recordatorios',  icon: <Bell size={15} /> },
];

export default function SuperAdminSistemasPage() {
  const [tab, setTab] = useState<Tab>('planes');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Herramientas Admin</h1>
        <p className="text-sm text-slate-500 mt-0.5">Planes de suscripción, bóveda de credenciales y recordatorios de pago.</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-2xl p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              tab === t.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        {tab === 'planes'        && <PlanesTab />}
        {tab === 'boveda'        && <BovedaTab />}
        {tab === 'recordatorios' && <RecordatoriosTab />}
      </div>
    </div>
  );
}
