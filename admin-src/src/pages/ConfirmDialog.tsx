import { useState, type ReactNode } from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}

/**
 * ConfirmDialog на базе Radix AlertDialog — замена нативного window.confirm().
 * destructive=true красит кнопку в красный и по умолчанию использует фразу «Удалить».
 */
export function ConfirmDialog({
  open, onOpenChange, title, description, confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена', destructive, onConfirm,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);

  async function handle() {
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-neutral-950 border-neutral-800 text-white">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription className="text-neutral-400">{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy} className="bg-transparent border-neutral-800 hover:bg-neutral-900">
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handle();
            }}
            disabled={busy}
            className={cn(
              destructive && 'bg-red-600 hover:bg-red-700 text-white',
              'min-w-24',
            )}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Хук для удобного использования ConfirmDialog без явного состояния.
 */
export function useConfirm() {
  const [state, setState] = useState<{
    open: boolean;
    title: string;
    description?: ReactNode;
    destructive?: boolean;
    confirmLabel?: string;
    onConfirm: () => void | Promise<void>;
  }>({
    open: false,
    title: '',
    onConfirm: () => {},
  });

  function ask(opts: {
    title: string;
    description?: ReactNode;
    destructive?: boolean;
    confirmLabel?: string;
    onConfirm: () => void | Promise<void>;
  }) {
    setState({ ...opts, open: true });
  }

  const dialog = (
    <ConfirmDialog
      open={state.open}
      onOpenChange={(o) => setState((s) => ({ ...s, open: o }))}
      title={state.title}
      description={state.description}
      destructive={state.destructive}
      confirmLabel={state.confirmLabel}
      onConfirm={state.onConfirm}
    />
  );

  return { ask, dialog };
}