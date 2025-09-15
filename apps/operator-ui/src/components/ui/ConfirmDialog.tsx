import * as Dialog from '@radix-ui/react-dialog';
import Button from './Button';

interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}

export default function ConfirmDialog({
  open,
  title = 'Are you sure?',
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onOpenChange,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/20" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(92vw,420px)] rounded-2xl border border-[var(--border)] bg-white p-6 shadow-soft">
          <Dialog.Title className="text-lg font-semibold text-ink-900">{title}</Dialog.Title>
          {description && (
            <Dialog.Description className="text-sm text-ink-700 mt-1">{description}</Dialog.Description>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>{cancelText}</Button>
            <Button onClick={() => { onConfirm(); onOpenChange(false); }}>{confirmText}</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}


