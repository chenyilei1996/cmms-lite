"use client";

import { Check, CircleNotch, Copy } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { buttonClass } from "./ui";
import { cn } from "@/lib/utils";

export function SubmitButton({
  children,
  variant = "primary",
  size = "md",
  className,
  pendingText = "处理中…",
  disabled = false,
  name,
  value,
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "soft";
  size?: "sm" | "md" | "lg";
  className?: string;
  pendingText?: string;
  disabled?: boolean;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending || disabled}
      className={buttonClass(variant, size, className)}
    >
      {pending && <CircleNotch className="size-4 animate-spin" />}
      {pending ? pendingText : children}
    </button>
  );
}

/**
 * 不可逆或影响较大的操作用：提交前二次确认，提交中自动禁用并显示进度。
 * 保留调用方原有按钮样式，适合列表里的文字按钮与图标按钮。
 */
export function ConfirmSubmitButton({
  children,
  message,
  className,
  pendingText = "处理中…",
  iconOnly = false,
  ariaLabel,
  title,
  name,
  value,
}: {
  children: React.ReactNode;
  message: string;
  className?: string;
  pendingText?: string;
  iconOnly?: boolean;
  ariaLabel?: string;
  title?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={ariaLabel}
        title={title}
        disabled={pending}
        onClick={() => setOpen(true)}
        className={cn(
          className,
          "disabled:cursor-not-allowed",
          pending && "cursor-wait opacity-60",
        )}
      >
        {pending ? (
          iconOnly ? (
            <CircleNotch className="size-3.5 animate-spin" />
          ) : (
            <>
              <CircleNotch className="size-4 animate-spin" />
              {pendingText}
            </>
          )
        ) : (
          children
        )}
      </button>

      {/* 真正提交的隐藏按钮，保留调用方的 name / value */}
      <button
        ref={submitRef}
        type="submit"
        name={name}
        value={value}
        hidden
        aria-hidden
        tabIndex={-1}
      />

      <dialog
        ref={dialogRef}
        onCancel={(event) => {
          event.preventDefault();
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
        className="fixed inset-0 m-auto h-fit w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-line bg-surface p-5 text-ink shadow-xl backdrop:bg-ink/40"
      >
        <p className="text-[13px] leading-relaxed">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className={buttonClass("secondary", "sm")}
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              submitRef.current?.click();
            }}
            className={buttonClass("primary", "sm")}
          >
            确认
          </button>
        </div>
      </dialog>
    </>
  );
}

export function CopyButton({ value, label = "复制链接" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
      className={buttonClass("secondary", "sm")}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? "已复制" : label}
    </button>
  );
}

export function PrintButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={cn(buttonClass("primary", "md"), className)}
    >
      打印二维码
    </button>
  );
}
