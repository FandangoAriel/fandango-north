"use client";

import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { InventoryProvider } from "@/lib/inventory-store";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <TooltipProvider delay={200}>
        <InventoryProvider>
          {children}
          <Toaster position="top-center" dir="rtl" richColors />
        </InventoryProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
