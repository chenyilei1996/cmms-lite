import Link from "next/link";
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import type { Tone } from "@/lib/constants";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "soft";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary:
    "bg-ink text-white hover:bg-ink-soft active:scale-[0.98] shadow-[0_8px_20px_-12px_rgba(23,25,28,0.7)]",
  secondary:
    "bg-surface text-ink border border-line hover:border-ink/30 hover:bg-white active:scale-[0.98]",
  ghost: "text-ink-soft hover:bg-ink/5",
  danger: "bg-danger text-white hover:bg-[#8f1d17] active:scale-[0.98]",
  soft: "bg-accent-soft text-accent-ink hover:bg-[#dbe7ef]",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[12px]",
  md: "h-10 px-4 text-[13px]",
  lg: "h-12 px-6 text-[14px]",
};

export function buttonClass(
  variant: Variant = "primary",
  size: Size = "md",
  className?: string,
) {
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
}) {
  return (
    <button className={buttonClass(variant, size, className)} {...props} />
  );
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={buttonClass(variant, size, className)}
      {...props}
    >
      {children}
    </Link>
  );
}

const toneClass: Record<Tone, string> = {
  mint: "bg-mint-soft text-mint",
  accent: "bg-accent-soft text-accent-ink",
  honey: "bg-honey-soft text-honey",
  neutral: "bg-[#EDEBE5] text-[#66625B]",
  danger: "bg-danger-soft text-danger",
  ink: "bg-ink text-white",
};

export function Badge({
  tone = "neutral",
  children,
  dot = false,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium leading-none whitespace-nowrap",
        toneClass[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current opacity-70" />}
      {children}
    </span>
  );
}

export function Field({
  label,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-[12px] font-medium text-ink-soft">
          {label}
          {required && <span className="ml-0.5 text-accent">*</span>}
        </span>
        {hint && <span className="text-[11px] text-muted">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

const control =
  "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink placeholder:text-muted/70 transition-colors focus:border-ink/40 focus:outline-none focus:ring-4 focus:ring-ink/5";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, "h-11", className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={cn(control, "min-h-28 resize-y", className)} {...props} />
  );
}

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(control, "h-11 appearance-none pr-9", className)} {...props}>
      {children}
    </select>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="rise mb-7 flex flex-col gap-4 lg:mb-9 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="label-mono mb-2.5 flex items-center gap-2">
            <span className="h-px w-5 bg-accent/50" />
            {eyebrow}
          </p>
        )}
        <h1 className="text-balance text-[27px] font-semibold leading-[1.15] tracking-[-0.03em] text-ink lg:text-[34px]">
          {title}
        </h1>
        {description && (
          <p className="mt-2.5 max-w-xl text-[13px] leading-relaxed text-muted">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      )}
    </header>
  );
}

export function SectionTitle({
  title,
  extra,
  className,
}: {
  title: string;
  extra?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-3 flex items-end justify-between gap-3 border-b border-line/70 pb-2.5",
        className,
      )}
    >
      <h2 className="text-[13px] font-semibold tracking-wide text-ink">{title}</h2>
      {extra}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface/60 px-6 py-12 text-center">
      {icon && <div className="mb-3 text-muted/60">{icon}</div>}
      <p className="text-[13px] font-medium text-ink">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-[12px] text-muted">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Avatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClass =
    size === "sm" ? "size-7 text-[11px]" : size === "lg" ? "size-10 text-[14px]" : "size-8 text-[12px]";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-ink text-white font-medium",
        sizeClass,
        className,
      )}
    >
      {name.slice(0, 1)}
    </span>
  );
}

export function StatCard({
  label,
  value,
  sub,
  tone = "neutral",
  icon,
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("card relative overflow-hidden p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="label-mono">{label}</p>
        {icon && (
          <span
            className={cn(
              "flex size-8 items-center justify-center rounded-full",
              toneClass[tone],
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <p className="mt-4 text-[34px] font-semibold leading-none tracking-[-0.03em] tabular-nums">
        {value}
      </p>
      {sub && <div className="mt-2 text-[11px] text-muted">{sub}</div>}
    </div>
  );
}

export function Bar({
  value,
  total,
  tone = "accent",
}: {
  value: number;
  total: number;
  tone?: "accent" | "mint" | "honey" | "ink";
}) {
  const width = total ? Math.max(2, Math.round((value / total) * 100)) : 0;
  const color = {
    accent: "bg-accent",
    mint: "bg-mint",
    honey: "bg-honey",
    ink: "bg-ink",
  }[tone];
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/8">
      <div
        className={cn("h-full rounded-full transition-all duration-500", color)}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

/** iOS/SF Symbols 风格的细描边展开箭头，用于列表行的 disclosure 指示。 */
export function ChevronRight({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M9.5 5.5 16 12l-6.5 6.5" />
    </svg>
  );
}
