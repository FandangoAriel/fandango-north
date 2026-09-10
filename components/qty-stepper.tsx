"use client";

import { Minus, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function QtyStepper({
  value,
  onChange,
  ariaLabel,
  compact,
}: {
  value: number;
  onChange: (next: number) => void;
  ariaLabel: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("inline-flex items-center gap-1", compact && "gap-0.5")} dir="ltr">
      <button
        type="button"
        aria-label={`הפחת ${ariaLabel}`}
        onClick={() => onChange(Math.max(0, value - 1))}
        className="inline-flex size-6 items-center justify-center rounded-md border border-border bg-background text-foreground hover:bg-muted"
      >
        <Minus className="size-3" />
      </button>
      <Input
        type="number"
        min={0}
        inputMode="numeric"
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-7 w-14 px-1 text-center tabular-nums"
      />
      <button
        type="button"
        aria-label={`הוסף ${ariaLabel}`}
        onClick={() => onChange(value + 1)}
        className="inline-flex size-6 items-center justify-center rounded-md border border-border bg-background text-foreground hover:bg-muted"
      >
        <Plus className="size-3" />
      </button>
    </div>
  );
}
