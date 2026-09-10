"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { InventoryProvider } from "@/lib/inventory-store";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delay={200}>
      <InventoryProvider>
        {children}
        <Toaster theme="light" position="top-center" dir="rtl" richColors />
      </InventoryProvider>
    </TooltipProvider>
  );
}
