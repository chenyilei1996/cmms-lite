"use client";

import { CheckCircle, WarningCircle, X } from "@phosphor-icons/react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type Tone = "success" | "error";
type ToastItem = { id: number; message: string; tone: Tone };
type ToastApi = { show: (message: string, tone?: Tone) => void };

const ToastContext = createContext<ToastApi | null>(null);

const noop: ToastApi = { show: () => {} };

/** 全局轻提示：跨页面操作（状态流转、复制、保存失败）统一反馈。 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, tone: Tone = "success") => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }, 3200);
  }, []);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-[90] flex flex-col items-center gap-2 px-4 lg:bottom-6"
      >
        {items.map((item) => (
          <div
            key={item.id}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[12px] text-ink shadow-[0_18px_40px_-24px_rgba(23,25,28,0.5)]"
          >
            {item.tone === "error" ? (
              <WarningCircle className="mt-px size-4 shrink-0 text-danger" />
            ) : (
              <CheckCircle className="mt-px size-4 shrink-0 text-mint" />
            )}
            <span className="flex-1 leading-relaxed">{item.message}</span>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              aria-label="关闭提示"
              className="text-muted hover:text-ink"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** 未挂载 Provider 时退化为静默，避免客户端组件因此崩溃。 */
export function useToast() {
  return useContext(ToastContext) ?? noop;
}
