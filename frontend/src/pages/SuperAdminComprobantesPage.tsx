import { useState, useEffect, useRef } from 'react';
import { ImageIcon, Upload, Trash2, Download, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';

const STORAGE_KEY = 'sa_vouchers';

interface Voucher {
  id: string;
  name: string;
  date: string;
  dataUrl: string;
  description: string;
}

function loadVouchers(): Voucher[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveVouchers(vouchers: Voucher[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(vouchers));
}

export default function SuperAdminComprobantesPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [pendingVoucher, setPendingVoucher] = useState<Omit<Voucher, 'description'> | null>(null);
  const [description, setDescription] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setVouchers(loadVouchers());
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPendingVoucher({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        date: new Date().toISOString(),
        dataUrl: reader.result as string,
      });
      setDescription('');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSave = () => {
    if (!pendingVoucher) return;
    const newVoucher: Voucher = { ...pendingVoucher, description };
    const updated = [newVoucher, ...vouchers];
    setVouchers(updated);
    saveVouchers(updated);
    setPendingVoucher(null);
    setDescription('');
  };

  const handleDelete = (id: string) => {
    const updated = vouchers.filter((v) => v.id !== id);
    setVouchers(updated);
    saveVouchers(updated);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Comprobantes — Mis Vouchers y Pagos</h1>
          <p className="text-sm text-slate-500 mt-0.5">Galería de imágenes y recibos de pago</p>
        </div>
        <Button
          icon={<Upload size={16} />}
          onClick={() => fileInputRef.current?.click()}
        >
          Subir Comprobante
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {vouchers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-4">
          <ImageIcon size={48} className="text-slate-300" />
          <p className="text-sm font-medium">No hay comprobantes cargados</p>
          <p className="text-xs">Haz clic en "Subir Comprobante" para agregar uno</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {vouchers.map((v) => (
            <div
              key={v.id}
              className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col"
            >
              <div className="relative aspect-video bg-slate-100">
                <img
                  src={v.dataUrl}
                  alt={v.name}
                  className="w-full h-full object-contain"
                />
                <button
                  onClick={() => handleDelete(v.id)}
                  className="absolute top-2 right-2 p-1.5 bg-white/90 hover:bg-red-50 text-slate-500 hover:text-red-600 rounded-lg border border-slate-200 transition-colors"
                  title="Eliminar"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="p-4 flex-1 flex flex-col gap-2">
                <p className="text-sm font-medium text-slate-800 truncate">{v.name}</p>
                {v.description && (
                  <p className="text-xs text-slate-500 line-clamp-2">{v.description}</p>
                )}
                <p className="text-xs text-slate-400">
                  {new Date(v.date).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </p>
                <a
                  href={v.dataUrl}
                  download={v.name}
                  className="mt-auto inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
                >
                  <Download size={13} />
                  Descargar
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!pendingVoucher}
        onClose={() => setPendingVoucher(null)}
        title="Agregar descripción"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingVoucher(null)}>
              <X size={14} />
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              Guardar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {pendingVoucher && (
            <div className="rounded-lg overflow-hidden bg-slate-100 aspect-video">
              <img
                src={pendingVoucher.dataUrl}
                alt="preview"
                className="w-full h-full object-contain"
              />
            </div>
          )}
          <p className="text-sm text-slate-600 font-medium truncate">{pendingVoucher?.name}</p>
          <Input
            label="Descripción (opcional)"
            placeholder="Ej: Pago mensual cliente ABC"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
        </div>
      </Modal>
    </div>
  );
}