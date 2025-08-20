import * as Dialog from '@radix-ui/react-dialog';

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
        <Dialog.Overlay style={{
          background: 'rgba(15,23,42,0.35)', position: 'fixed', inset: 0
        }} />
        <Dialog.Content style={{
          position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
          background: '#fff', borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
          width: 'min(92vw, 420px)', padding: 16, border: '1px solid #e2e8f0'
        }}>
          <Dialog.Title style={{ fontSize: 16, fontWeight: 600, color: '#0f172a' }}>{title}</Dialog.Title>
          {description && (
            <Dialog.Description style={{ fontSize: 14, color: '#475569', marginTop: 6 }}>{description}</Dialog.Description>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button onClick={() => onOpenChange(false)} style={{
              border: '1px solid #e2e8f0', background: '#fff', padding: '8px 12px', borderRadius: 10
            }}>{cancelText}</button>
            <button onClick={() => { onConfirm(); onOpenChange(false); }} style={{
              background: '#ec4899', color: '#fff', padding: '8px 12px', borderRadius: 10
            }}>{confirmText}</button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}


