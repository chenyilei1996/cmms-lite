import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({
  href = "/app/dashboard",
  dark = false,
  compact = false,
}: {
  href?: string;
  dark?: boolean;
  compact?: boolean;
}) {
  return (
    <Link href={href} className="flex items-center gap-2.5">
      <span
        className={cn(
          "flex size-9 items-center justify-center rounded-[11px] text-[14px] font-bold",
          dark
            ? "bg-accent-on-dark text-ink"
            : "bg-ink text-accent-on-dark",
        )}
      >
        M
      </span>
      {!compact && (
        <span className="leading-none">
          <span
            className={cn(
              "block text-[13px] font-semibold",
              dark ? "text-white" : "text-ink",
            )}
          >
            设备管理
          </span>
          <span
            className={cn(
              "mt-1 block font-mono text-[9px] tracking-[0.2em]",
              dark ? "text-white/35" : "text-muted",
            )}
          >
            YUELI · CMMS
          </span>
        </span>
      )}
    </Link>
  );
}
