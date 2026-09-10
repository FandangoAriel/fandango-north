"use client";

import { useMemo, useState } from "react";
import { RotateCcw, Sprout } from "lucide-react";
import { toast } from "sonner";
import { OverviewView } from "@/components/overview-view";
import { SiteView } from "@/components/site-view";
import { SupplyView } from "@/components/supply-view";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useInventory } from "@/lib/inventory-store";
import { SPREADSHEET_SOURCE } from "@/lib/seed";
import type { SiteId } from "@/lib/types";

type TabId = "overview" | SiteId | "supply";

export function AppClient() {
  const { state, hydrated, reset } = useInventory();
  const [tab, setTab] = useState<TabId>("overview");
  const [resetOpen, setResetOpen] = useState(false);

  const sitesById = useMemo(
    () => Object.fromEntries(state.sites.map((site) => [site.id, site])),
    [state.sites],
  );

  if (!hydrated) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        טוען את המלאי…
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b bg-card/80 print:hidden">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Sprout className="size-5" />
            </div>
            <div>
              <p className="text-xs font-medium tracking-wide text-primary">פאנדנגו</p>
              <h1 className="text-xl font-bold leading-tight">ציוד חוות הצפון</h1>
              <p className="text-sm text-muted-foreground">{SPREADSHEET_SOURCE}</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => setResetOpen(true)}>
            <RotateCcw />
            איפוס לגיליון
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Tabs
          value={tab}
          onValueChange={(value) => {
            if (typeof value === "string") setTab(value as TabId);
          }}
        >
          <TabsList className="mb-6 h-auto w-full flex-wrap justify-start print:hidden sm:w-fit">
            <TabsTrigger value="overview">סקירה</TabsTrigger>
            {state.sites.map((site) => (
              <TabsTrigger key={site.id} value={site.id}>
                {site.name}
              </TabsTrigger>
            ))}
            <TabsTrigger value="supply">רשימת אספקה</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewView sites={state.sites} onOpenSite={setTab} />
          </TabsContent>
          {state.sites.map((site) => (
            <TabsContent key={site.id} value={site.id}>
              <SiteView site={sitesById[site.id] ?? site} />
            </TabsContent>
          ))}
          <TabsContent value="supply">
            <SupplyView sites={state.sites} />
          </TabsContent>
        </Tabs>
      </main>

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
