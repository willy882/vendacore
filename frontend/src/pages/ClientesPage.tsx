import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UserPlus, FileSpreadsheet, Pencil, ChevronLeft, ChevronRight,
  Users, CheckCircle2, XCircle, Search, X, Save, Trash2, Loader2,
} from 'lucide-react';
import { customersService } from '@/services/customers.service';
import { Button }  from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import type { Customer } from '@/types';

// ── Field component ───────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative rounded-xl border border-slate-200 bg-slate-50/60 px-3 pt-5 pb-2.5
      transition-all duration-200
      focus-within:border-blue-400 focus-within:bg-white
      focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.10)]">
      <span className="absolute top-1.5 left-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
        {label}
      </span>
      {children}
    </div>
  );
}

function Section({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <span className="text-[9px] font-extrabold tracking-widest text-slate-400 uppercase whitespace-nowrap">
        {label}
      </span>
      <div className="h-px bg-slate-100 flex-1" />
    </div>
  );
}

const inputCls = 'w-full outline-none text-sm text-slate-800 bg-transparent placeholder:text-slate-300';

// ── Modal nuevo / editar cliente ──────────────────────────────────────────────

function CustomerModal({
  open, onClose, customer,
}: { open: boolean; onClose: () => void; customer?: Customer | null }) {
  const qc     = useQueryClient();
  const isEdit = !!customer;

  const [isActive,     setIsActive]     = useState(true);
  const [tipoDoc,      setTipoDoc]      = useState<'DNI'|'RUC'>('DNI');
  const [numDoc,       setNumDoc]       = useState('');
  const [nombre,       setNombre]       = useState('');
  const [sede,         setSede]         = useState('');
  const [telefono,     setTelefono]     = useState('');
  const [correo,       setCorreo]       = useState('');
  const [departamento, setDepartamento] = useState('');
  const [provincia,    setProvincia]    = useState('');
  const [distrito,     setDistrito]     = useState('');
  const [ubigeo,       setUbigeo]       = useState('');
  const [direccion,    setDireccion]    = useState('');
  const [referencia,   setReferencia]   = useState('');
  const [nota,         setNota]         = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupMsg,     setLookupMsg]     = useState('');
  const [saving,       setSaving]       = useState(false);
  const [apiErr,       setApiErr]       = useState('');

  const numDocRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    if (customer) {
      setIsActive(customer.isActive);
      setTipoDoc((customer.tipoDocumento as 'DNI'|'RUC') ?? 'DNI');
      setNumDoc(customer.numeroDocumento ?? '');
      setNombre(customer.nombreCompleto ?? '');
      setSede(customer.razonSocial ?? '');
      setTelefono(customer.telefono ?? '');
      setCorreo(customer.email ?? '');
      setDepartamento(customer.departamento ?? '');
      setProvincia(customer.provincia ?? '');
      setDistrito(customer.distrito ?? '');
      setUbigeo(customer.ubigeo ?? '');
      setDireccion(customer.direccion ?? '');
      setReferencia(customer.referencia ?? '');
      setNota(customer.nota ?? '');
    } else {
      setIsActive(true); setTipoDoc('DNI'); setNumDoc(''); setNombre('');
      setSede(''); setTelefono(''); setCorreo(''); setDepartamento('');
      setProvincia(''); setDistrito(''); setUbigeo(''); setDireccion('');
      setReferencia(''); setNota('');
    }
    setLookupMsg(''); setApiErr('');
    setTimeout(() => numDocRef.current?.focus(), 100);
  }, [open, customer]);

  const buscarDocumento = async () => {
    const num = numDoc.trim();
    if (!num) return;
    setLookupLoading(true);
    setLookupMsg('');
    try {
      const data = await customersService.lookup(tipoDoc, num);
      setNombre(data.nombreCompleto ?? '');
      if (data.razonSocial)    setSede(data.razonSocial);
      if (data.departamento)   setDepartamento(data.departamento);
      if (data.provincia)      setProvincia(data.provincia);
      if (data.distrito)       setDistrito(data.distrito);
      if (data.ubigeo)         setUbigeo(data.ubigeo);
      if (data.direccion)      setDireccion(data.direccion);
      const src = data.source === 'local' ? 'Encontrado en sistema' : data.source === 'reniec' ? '✓ RENIEC' : '✓ SUNAT';
      setLookupMsg(src);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'No encontrado';
      setLookupMsg('✗ ' + (Array.isArray(msg) ? msg[0] : msg));
    } finally {
      setLookupLoading(false);
    }
  };

  const deleteMut = useMutation({
    mutationFn: () => customersService.delete(customer!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['customers-stats'] });
      onClose();
    },
  });

  const handleSave = async () => {
    if (!nombre.trim()) { setApiErr('El nombre es requerido'); return; }
    setSaving(true); setApiErr('');
    try {
      const payload = {
        nombreCompleto:  nombre.trim(),
        tipoDocumento:   tipoDoc,
        numeroDocumento: numDoc.trim() || undefined,
        razonSocial:     sede.trim()         || undefined,
        telefono:        telefono.trim()      || undefined,
        email:           correo.trim()        || undefined,
        departamento:    departamento.trim()  || undefined,
        provincia:       provincia.trim()     || undefined,
        distrito:        distrito.trim()      || undefined,
        ubigeo:          ubigeo.trim()        || undefined,
        direccion:       direccion.trim()     || undefined,
        referencia:      referencia.trim()    || undefined,
        nota:            nota.trim()          || undefined,
      };
      if (isEdit) {
        await customersService.update(customer!.id, payload);
      } else {
        await customersService.create(payload);
      }
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['customers-stats'] });
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Error al guardar';
      setApiErr(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const isLookupOk = lookupMsg && !lookupMsg.startsWith('✗');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-lg overflow-hidden flex flex-col"
        style={{ maxHeight: '92vh', boxShadow: '0 32px 80px -12px rgba(0,0,0,0.35)' }}
      >

        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-slate-900 to-slate-800 flex-shrink-0 rounded-t-3xl">
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:bg-white/10 hover:text-white transition-all duration-200"
          >
            <X size={15} strokeWidth={2.5} />
          </button>

          <button
            onClick={() => setIsActive((v) => !v)}
            className={`relative w-9 h-5 rounded-full transition-all duration-300 flex-shrink-0 ${isActive ? 'bg-emerald-500' : 'bg-slate-600'}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-300 ${isActive ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
          </button>
          <span className={`text-xs font-bold tracking-widest flex-1 transition-colors duration-300 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`}>
            {isEdit ? (isActive ? 'ACTIVO' : 'INACTIVO') : 'NUEVO CLIENTE'}
          </span>

          {isEdit && (
            <button
              onClick={() => deleteMut.mutate()}
              disabled={deleteMut.isPending}
              className="w-7 h-7 rounded-full flex items-center justify-center text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all duration-200 disabled:opacity-40"
            >
              <Trash2 size={14} />
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-7 h-7 rounded-full flex items-center justify-center text-slate-300 hover:bg-white/10 hover:text-white transition-all duration-200 disabled:opacity-40"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">

          {apiErr && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700 font-medium">
              {apiErr}
            </div>
          )}
          {lookupMsg && (
            <div className={`rounded-xl px-4 py-2.5 text-sm font-medium border ${
              isLookupOk
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-red-50 text-red-600 border-red-200'
            }`}>
              {lookupMsg}
            </div>
          )}

          {/* ── Identificación ── */}
          <Section label="Identificación" />

          {/* Tipo doc: segmented control */}
          <div className="flex rounded-xl overflow-hidden border border-slate-200 bg-slate-50 p-0.5 gap-0.5">
            {(['DNI', 'RUC'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTipoDoc(t)}
                className={`flex-1 py-2 text-xs font-bold tracking-widest rounded-lg transition-all duration-200 ${
                  tipoDoc === t
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Documento + lupa */}
          <Field label="Número de documento">
            <div className="flex items-center gap-2">
              <input
                ref={numDocRef}
                value={numDoc}
                onChange={(e) => setNumDoc(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && buscarDocumento()}
                className={inputCls}
                placeholder={tipoDoc === 'DNI' ? '8 dígitos' : '11 dígitos'}
                maxLength={tipoDoc === 'DNI' ? 8 : 11}
              />
              <button
                onClick={buscarDocumento}
                disabled={lookupLoading || !numDoc.trim()}
                title="Buscar en RENIEC / SUNAT"
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200
                  ${numDoc.trim() && !lookupLoading
                    ? 'bg-blue-500 text-white shadow-[0_4px_14px_rgba(59,130,246,0.4)] hover:bg-blue-600 hover:shadow-[0_6px_20px_rgba(59,130,246,0.5)] active:scale-95'
                    : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                  }`}
              >
                {lookupLoading
                  ? <Loader2 size={14} className="animate-spin" />
                  : <Search size={14} />
                }
              </button>
            </div>
          </Field>

          {/* Nombre */}
          <Field label="Nombre / Razón social">
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className={inputCls}
              placeholder="Apellidos y nombres o razón social"
            />
          </Field>

          {/* ── Contacto ── */}
          <Section label="Contacto" />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Teléfono">
              <input value={telefono} onChange={(e) => setTelefono(e.target.value)} className={inputCls} placeholder="999 999 999" />
            </Field>
            <Field label="Correo electrónico">
              <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} className={inputCls} placeholder="correo@ejemplo.com" />
            </Field>
          </div>

          <Field label="Sede / Empresa">
            <input value={sede} onChange={(e) => setSede(e.target.value)} className={inputCls} placeholder="PRINCIPAL" />
          </Field>

          {/* ── Ubicación ── */}
          <Section label="Ubicación" />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Departamento">
              <input value={departamento} onChange={(e) => setDepartamento(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Provincia">
              <input value={provincia} onChange={(e) => setProvincia(e.target.value)} className={inputCls} />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Field label="Distrito">
                <input value={distrito} onChange={(e) => setDistrito(e.target.value)} className={inputCls} />
              </Field>
            </div>
            <Field label="Ubigeo">
              <input value={ubigeo} onChange={(e) => setUbigeo(e.target.value)} className={inputCls} />
            </Field>
          </div>

          <Field label="Dirección">
            <input value={direccion} onChange={(e) => setDireccion(e.target.value)} className={inputCls} placeholder="Av. / Jr. / Calle..." />
          </Field>

          {/* ── Adicional ── */}
          <Section label="Adicional" />

          <Field label="Referencia">
            <input value={referencia} onChange={(e) => setReferencia(e.target.value)} className={inputCls} placeholder="Cerca a..." />
          </Field>

          <Field label="Nota interna">
            <input value={nota} onChange={(e) => setNota(e.target.value)} className={inputCls} placeholder="Observaciones del cliente..." />
          </Field>

          <div className="pb-1" />
        </div>

        {/* ── Footer ── */}
        <div className="flex border-t border-slate-100 flex-shrink-0 rounded-b-3xl overflow-hidden">
          <button
            onClick={onClose}
            className="flex-1 py-4 text-sm font-semibold text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all duration-200"
          >
            CANCELAR
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-4 text-sm font-bold text-white flex items-center justify-center gap-2
              bg-gradient-to-r from-emerald-500 to-emerald-600
              hover:from-emerald-600 hover:to-emerald-700
              active:scale-[0.98] transition-all duration-150 disabled:opacity-60"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            GUARDAR
          </button>
        </div>

      </div>
    </div>
  );
}

// ── Helpers Excel ─────────────────────────────────────────────────────────────

function exportCSV(customers: Customer[]) {
  const today = new Date().toISOString().slice(0, 10);
  const headers = [
    'documento', 'tipodoc', 'nombre', 'telefono', 'correo',
    'sede', 'departamento', 'provincia', 'distrito',
    'ubigeo', 'direccion', 'referencia', 'nota',
    'activo', 'latitud', 'longitud',
  ];
  const rows = customers.map((c) => [
    c.numeroDocumento  ?? '',
    c.tipoDocumento    ?? '',
    c.nombreCompleto   ?? '',
    c.telefono         ?? '',
    c.email            ?? '',
    c.razonSocial      ?? '',
    c.departamento     ?? '',
    c.provincia        ?? '',
    c.distrito         ?? '',
    c.ubigeo           ?? '',
    c.direccion        ?? '',
    c.referencia       ?? '',
    c.nota             ?? '',
    c.isActive ? 'true' : 'false',
    '',                        // latitud
    '',                        // longitud
  ]);
  const csv = [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `CLIENTES_${today}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Page ──────────────────────────────────────────────────────────────────────

const ROWS_OPTIONS = [10, 25, 50, 100];

export default function ClientesPage() {
  const [search,  setSearch]  = useState('');
  const [page,       setPage]       = useState(1);
  const [limit,      setLimit]      = useState(10);
  const [modal,      setModal]      = useState(false);
  const [editing,    setEditing]    = useState<Customer | null>(null);
  const [exporting,  setExporting]  = useState(false);

  // Reset page on search/limit change
  useEffect(() => { setPage(1); }, [search, limit]);

  const { data: stats } = useQuery({
    queryKey: ['customers-stats'],
    queryFn:  customersService.getStats,
    staleTime: 30_000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['customers', { search, page, limit }],
    queryFn:  () => customersService.getAll({ search, page, limit }),
    placeholderData: (p) => p,
  });

  const customers  = data?.data       ?? [];
  const total      = data?.total      ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const handleExport = async () => {
    setExporting(true);
    try {
      const all = await customersService.getAll({ limit: 9999 });
      exportCSV(all.data);
    } finally {
      setExporting(false);
    }
  };
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to   = Math.min(page * limit, total);

  const openNew  = () => { setEditing(null); setModal(true); };
  const openEdit = (c: Customer) => { setEditing(c); setModal(true); };

  return (
    <div className="p-6 space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Clientes</h1>
          <p className="text-sm text-slate-500 mt-0.5">Gestión de datos comerciales y ubicación</p>

          {/* Stats chips */}
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-3 py-1">
              <Users size={12} />
              {stats?.total ?? total} clientes
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-3 py-1">
              <CheckCircle2 size={12} />
              {stats?.activos ?? total} activos
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200 rounded-full px-3 py-1">
              <XCircle size={12} />
              {stats?.inactivos ?? 0} inactivos
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            icon={<FileSpreadsheet size={15} className="text-emerald-600" />}
            onClick={handleExport}
            disabled={exporting}
            className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
          >
            {exporting ? 'Exportando...' : 'EXCEL'}
          </Button>
          <Button icon={<UserPlus size={15} />} onClick={openNew}>
            NUEVO CLIENTE
          </Button>
        </div>
      </div>

      {/* ── Buscador ── */}
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por documento, nombre, distrito, telefono o nota"
          className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* ── Tabla ── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">Documento</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">Nombre</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">Telefono</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">Sede</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">Distrito</th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr><td colSpan={6} className="py-16 text-center"><Spinner className="mx-auto" /></td></tr>
              ) : customers.length === 0 ? (
                <tr><td colSpan={6} className="py-16 text-center text-slate-400 text-sm">Sin clientes registrados</td></tr>
              ) : customers.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 font-bold text-slate-800">{c.numeroDocumento}</td>
                  <td className="px-5 py-3 text-slate-700">{c.nombreCompleto}</td>
                  <td className="px-5 py-3 text-slate-500">{c.telefono ?? '-'}</td>
                  <td className="px-5 py-3 text-slate-500">{c.razonSocial ?? '-'}</td>
                  <td className="px-5 py-3 text-slate-500 uppercase">{c.distrito ?? '-'}</td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => openEdit(c)}
                      className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
                      title="Editar"
                    >
                      <Pencil size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Paginación ── */}
        <div className="flex items-center justify-end gap-4 px-5 py-3 border-t border-slate-100 bg-white">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Rows per page:</span>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="border border-slate-300 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {ROWS_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <span className="text-xs text-slate-500">
            {from}-{to} of {total}
          </span>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 1}
              className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} className="text-slate-600" />
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages}
              className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={16} className="text-slate-600" />
            </button>
          </div>
        </div>
      </div>

      <CustomerModal
        open={modal}
        onClose={() => { setModal(false); setEditing(null); }}
        customer={editing}
      />
    </div>
  );
}
