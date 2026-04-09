import { cn } from "@/lib/utils";

interface LiveBadgeProps {
  isLive: boolean;
  className?: string;
}

export function LiveBadge({ isLive, className }: LiveBadgeProps) {
  if (!isLive) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        "bg-emerald-500/15 text-emerald-500 border border-emerald-500/20",
        "animate-in fade-in duration-300",
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
      atualizado
    </span>
  );
}
