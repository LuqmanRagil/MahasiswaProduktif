import { AlertDialog as A } from "radix-ui";
import { AlertTriangle } from "lucide-react";
import { Button } from "./button";

/** Konfirmasi sebelum tindakan berisiko (hapus data, dll). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Hapus",
  onConfirm,
  loading,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  loading?: boolean;
}) {
  return (
    <A.Root open={open} onOpenChange={onOpenChange}>
      <A.Portal>
        <A.Overlay className="fixed inset-0 z-[60] bg-slate-900/40 data-[state=open]:animate-in" />
        <A.Content className="fixed top-1/2 left-1/2 z-[60] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-surface p-5 shadow-[var(--shadow-pop)] data-[state=open]:animate-pop">
          <div className="flex gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <A.Title className="text-base font-semibold">{title}</A.Title>
              <A.Description className="mt-1 text-sm text-muted">{description}</A.Description>
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <A.Cancel asChild>
              <Button variant="outline">Batal</Button>
            </A.Cancel>
            <Button
              variant="danger"
              loading={loading}
              onClick={(e) => {
                e.preventDefault();
                onConfirm();
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </A.Content>
      </A.Portal>
    </A.Root>
  );
}
