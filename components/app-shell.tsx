"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { RotateCcw, Sprout } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useInventory } from "@/lib/inventory-store";
import { SPREADSHEET_SOURCE } from "@/lib/seed";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { state, reset } = useInventory();
  const [resetOpen, setResetOpen] = useState(false);

  const links = [
    { href: "/", label: "סקירה" },
    ...state.sites.map((site) => ({ href: `/sites/${site.id}`, label: site.name })),
    { href: "/supply", label: "רשימת אספקה" },
  ];

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b bg-card/80 print:hidden">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="flex items-start gap-3">
            <div className="mt-0.5 flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Sprout className="size-5" />
            </div>
            <div>
              <p className="text-xs font-medium tracking-wide text-primary">פאנדנגו</p>
              <h1 className="text-xl font-bold leading-tight">ציוד חוות הצפון</h1>
              <p className="text-sm text-muted-foreground">{SPREADSHEET_SOURCE}</p>
            </div>
          </Link>
          <Button variant="outline" onClick={() => setResetOpen(true)}>
            <RotateCcw />
            איפוס לגיליון
          </Button>
        </div>
        <nav className="mx-auto flex w-full max-w-6xl flex-wrap gap-1 px-4 pb-3">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>

      <footer className="border-t py-4 text-center text-xs text-muted-foreground print:hidden">
        הנתונים נשמרים בדפדפן זה בלבד. שינוי מלאי מעדכן את תאריך האתר.
      </footer>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>לחזור לנתוני הגיליון?</DialogTitle>
            <DialogDescription>
              כל השינויים שנשמרו במחשב זה יימחקו, והמלאי יחזור למצב מ־9 בספטמבר 2026 (כפר חסידים
              מ־20 במאי).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-start">
            <Button
              variant="destructive"
              onClick={() => {
                reset();
                setResetOpen(false);
                toast.success("המלאי אופס לגיליון המקורי");
              }}
            >
              איפוס
            </Button>
            <Button variant="outline" onClick={() => setResetOpen(false)}>
              ביטול
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
