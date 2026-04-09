import { useEffect } from 'react';
import type { UseFormWatch, UseFormReset, FieldValues } from 'react-hook-form';

/**
 * Persiste el estado de un formulario en sessionStorage mientras está abierto.
 * Si el usuario refresca la página, los valores se restauran automáticamente.
 * Solo funciona para formularios nuevos (isEdit = false).
 */
export function useFormPersist<T extends FieldValues>(
  key: string,
  watch: UseFormWatch<T>,
  reset: UseFormReset<T>,
  isOpen: boolean,
  isEdit = false,
) {
  const storageKey = `form_persist_${key}`;

  // Restaurar al abrir el modal (solo si es nuevo, no edición)
  useEffect(() => {
    if (!isOpen || isEdit) return;
    const saved = sessionStorage.getItem(storageKey);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      reset(parsed);
    } catch { /* ignorar errores de parseo */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Guardar en cada cambio mientras el modal está abierto
  useEffect(() => {
    if (!isOpen || isEdit) return;
    const sub = watch((values) => {
      sessionStorage.setItem(storageKey, JSON.stringify(values));
    });
    return () => sub.unsubscribe();
  }, [storageKey, watch, isOpen, isEdit]);

  return {
    /** Llamar después de un submit exitoso para limpiar los datos guardados */
    clearPersisted: () => sessionStorage.removeItem(storageKey),
  };
}