import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, ToggleLeft, ToggleRight, Shield, Users } from 'lucide-react';
import { usersService } from '@/services/users.service';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import {} from '@/lib/utils';
import type { User } from '@/types';
import { useAuthStore } from '@/stores/auth.store';

// ── Colores de roles ──────────────────────────────────────────────────────────

const roleVariant = (name: string): 'success' | 'danger' | 'warning' | 'info' | 'default' => {
  if (name === 'administrador') return 'danger';
  if (name === 'supervisor')    return 'warning';
  if (name === 'cajero')        return 'info';
  if (name === 'vendedor')      return 'success';
  if (name === 'almacenero')    return 'default';
  if (name === 'contabilidad')  return 'info';
  return 'default';
};

// ── Esquemas ──────────────────────────────────────────────────────────────────

const createSchema = z.object({
  nombre:   z.string().min(2, 'Requerido'),
  apellido: z.string().min(2, 'Requerido'),
  email:    z.string().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  roleId:   z.string().min(1, 'Seleccione un rol'),
});

const editSchema = z.object({
  nombre:   z.string().min(2, 'Requerido'),
  apellido: z.string().min(2, 'Requerido'),
  email:    z.string().email('Email inválido'),
  roleId:   z.string().min(1, 'Seleccione un rol'),
});

type CreateForm = z.infer<typeof createSchema>;
type EditForm   = z.infer<typeof editSchema>;

// ── Modal ─────────────────────────────────────────────────────────────────────

function UserModal({ open, onClose, user, roles }: {
  open:   boolean;
  onClose: () => void;
  user?:  User | null;
  roles:  { id: string; name: string }[];
}) {
  const qc     = useQueryClient();
  const isEdit = !!user;

  const { register: regCreate, handleSubmit: handleCreate, reset: resetCreate, formState: { errors: errCreate } } =
    useForm<CreateForm>({ resolver: zodResolver(createSchema) });

  const { register: regEdit, handleSubmit: handleEdit, reset: resetEdit, formState: { errors: errEdit } } =
    useForm<EditForm>({
      resolver: zodResolver(editSchema),
      defaultValues: user ? {
        nombre:   user.nombre,
        apellido: user.apellido,
        email:    user.email,
        roleId:   user.role?.id ?? '',
      } : undefined,
    });

  const saveMut = useMutation({
    mutationFn: (payload: Omit<CreateForm, 'password'> & { password?: string }) =>
      isEdit
        ? usersService.update(user!.id, { nombre: payload.nombre, apellido: payload.apellido, email: payload.email, roleId: payload.roleId })
        : usersService.create(payload as CreateForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      if (isEdit) resetEdit(); else resetCreate();
      onClose();
    },
  });

  const handleClose = () => { resetCreate(); resetEdit(); onClose(); };
  const roleOptions = roles.map((r) => ({ value: r.id, label: r.name }));
  const err = (saveMut.error as any)?.response?.data?.message;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isEdit ? 'Editar Usuario' : 'Nuevo Usuario'}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button
            loading={saveMut.isPending}
            onClick={isEdit
              ? handleEdit((d) => saveMut.mutate(d))
              : handleCreate((d) => saveMut.mutate(d))}
          >
            {isEdit ? 'Guardar cambios' : 'Crear usuario'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {err && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {Array.isArray(err) ? err.join(', ') : err}
          </div>
        )}

        {isEdit ? (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Nombre *"   {...regEdit('nombre')}   error={errEdit.nombre?.message} />
              <Input label="Apellido *" {...regEdit('apellido')} error={errEdit.apellido?.message} />
            </div>
            <Input label="Email *" type="email" {...regEdit('email')} error={errEdit.email?.message} />
            <Select label="Rol *" options={roleOptions} placeholder="— Seleccione —" {...regEdit('roleId')} error={errEdit.roleId?.message} />
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Nombre *"   {...regCreate('nombre')}   error={errCreate.nombre?.message} />
              <Input label="Apellido *" {...regCreate('apellido')} error={errCreate.apellido?.message} />
            </div>
            <Input label="Email *" type="email" {...regCreate('email')} error={errCreate.email?.message} />
            <Input label="Contraseña *" type="password" placeholder="Mínimo 8 caracteres" {...regCreate('password')} error={errCreate.password?.message} />
            <Select label="Rol *" options={roleOptions} placeholder="— Seleccione —" {...regCreate('roleId')} error={errCreate.roleId?.message} />
          </>
        )}
      </div>
    </Modal>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function UsuariosPage() {
  const qc         = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const [modal, setModal]     = useState(false);
  const [editing, setEditing] = useState<User | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn:  usersService.getAll,
  });

  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn:  usersService.getRoles,
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      usersService.update(id, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  const allUsers = users ?? [];
  const active   = allUsers.filter((u) => u.isActive).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center">
            <Users size={20} className="text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">{allUsers.length} usuarios registrados</p>
            <p className="text-xs text-slate-500">{active} activos · {allUsers.length - active} inactivos</p>
          </div>
        </div>
        <Button icon={<Plus size={16} />} onClick={() => { setEditing(null); setModal(true); }}>
          Nuevo Usuario
        </Button>
      </div>

      {/* Roles disponibles */}
      {roles && (
        <Card padding="md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield size={15} className="text-slate-400" />
              <CardTitle>Roles del Sistema</CardTitle>
            </div>
          </CardHeader>
          <div className="flex flex-wrap gap-2">
            {roles.map((r) => (
              <div key={r.id} className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200">
                <Badge variant={roleVariant(r.name)}>{r.name}</Badge>
                <span className="text-xs text-slate-500">
                  {allUsers.filter((u) => u.role?.name === r.name).length} usuario(s)
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tabla de usuarios */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b">
                {['Usuario', 'Email', 'Rol', 'Estado', 'Acciones'].map((h) => (
                  <th key={h} className="text-xs font-semibold text-slate-500 px-5 py-3 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="py-16 text-center"><Spinner className="mx-auto" /></td></tr>
              ) : allUsers.length === 0 ? (
                <tr><td colSpan={5} className="py-16 text-center text-slate-400">Sin usuarios</td></tr>
              ) : allUsers.map((u) => {
                const isCurrentUser = u.id === currentUser?.id;
                return (
                  <tr key={u.id} className={`border-b hover:bg-slate-50 ${isCurrentUser ? 'bg-blue-50/30' : ''}`}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {u.nombre[0]}{u.apellido[0]}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">
                            {u.nombre} {u.apellido}
                            {isCurrentUser && <span className="ml-2 text-xs text-blue-500 font-normal">(tú)</span>}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-500">{u.email}</td>
                    <td className="px-5 py-3">
                      <Badge variant={roleVariant(u.role?.name ?? '')}>{u.role?.name ?? '—'}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={u.isActive ? 'success' : 'outline'}>
                        {u.isActive ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setEditing(u); setModal(true); }}
                          className="p-1.5 rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-colors"
                          title="Editar"
                        >
                          <Pencil size={15} />
                        </button>
                        {!isCurrentUser && (
                          <button
                            onClick={() => toggleMut.mutate({ id: u.id, isActive: !u.isActive })}
                            className={`p-1.5 rounded-lg transition-colors ${
                              u.isActive
                                ? 'hover:bg-red-50 text-slate-400 hover:text-red-500'
                                : 'hover:bg-emerald-50 text-slate-400 hover:text-emerald-600'
                            }`}
                            title={u.isActive ? 'Desactivar' : 'Activar'}
                          >
                            {u.isActive ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <UserModal
        open={modal}
        onClose={() => { setModal(false); setEditing(null); }}
        user={editing}
        roles={roles ?? []}
      />
    </div>
  );
}
