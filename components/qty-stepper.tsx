"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
      <Button
        type="button"
        size="icon-xs"
        variant="outline"
        aria-label={`הפחת ${ariaLabel}`}
        onClick={() => onChange(Math.max(0, value - 1))}
      >
        <Minus />
      </Button>
      <Input
        type="number"
        min={0}
        inputMode="numeric"
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-7 w-14 px-1 text-center tabular-nums"
      />
      <Button
        type="button"
        size="icon-xs"
        variant="outline"
        aria-label={`הוסף ${ariaLabel}`}
        onClick={() => onChange(value + 1)}
      >
        <Plus />
      </Button>
    </div>
  );
}
