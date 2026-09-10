"use client";

import { Printer, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { siteShortages, siteSupplyUnits, toSupply } from "@/lib/stats";
import type { Site } from "@/lib/types";

export function SupplyView({ sites }: { sites: Site[] }) {
  const rows = sites
    .map((site) => ({
      site,
      items: siteShortages(site),
      units: siteSupplyUnits(site),
    }))
    .filter((row) => row.items.length > 0);

  function printList() {
    window.print();
  }

  function copyList() {
    const lines = rows.flatMap(({ site, items }) => [
      site.name,
      ...items.map((item) => `  ${item.name}: ${toSupply(item)} (יש ${item.actual} / יעד ${item.maxStock})`),
      "",
    ]);
    const text = ["רשימת אספקה — חוות פאנדנגו בצפון", "", ...lines].join("\n");
    void navigator.clipboard.writeText(text).then(
      () => toast.success("הרשימה הועתקה"),
      () => toast.error("לא ניתן להעתיק"),
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-muted/40 px-4 py-16 text-center">
        <Truck className="size-8 text-muted-foreground" />
        <p className="font-medium">אין כרגע פריטים לספקה</p>
        <p className="text-sm text-muted-foreground">כל האתרים עומדים ביעד המלאי.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <h2 className="text-lg font-semibold">רשימת אספקה לאתרים</h2>
          <p className="text-sm text-muted-foreground">
            מה צריך להביא לכל חווה כדי להשלים למלאי המקסימום
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={copyList}>
            העתקה
          </Button>
          <Button onClick={printList}>
            <Printer />
            הדפסה
          </Button>
        </div>
      </div>

      <div className="hidden print:block">
        <h1 className="text-xl font-bold">רשימת אספקה — פאנדנגו צפון</h1>
      </div>

      {rows.map(({ site, items, units }) => (
        <section key={site.id} className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 print:break-inside-avoid print:ring-black/20">
          <header className="flex items-center justify-between bg-muted/70 px-4 py-3">
            <h3 className="font-semibold">{site.name}</h3>
            <p className="text-sm text-muted-foreground">
              {items.length} פריטים · {units} יחידות
            </p>
          </header>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-right text-muted-foreground">
                <th className="px-4 py-2 font-medium">ציוד</th>
                <th className="px-4 py-2 font-medium">בפועל</th>
                <th className="px-4 py-2 font-medium">יעד</th>
                <th className="px-4 py-2 font-medium">לספק</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="px-4 py-2">{item.name}</td>
                  <td className="px-4 py-2 tabular-nums">{item.actual}</td>
                  <td className="px-4 py-2 tabular-nums">{item.maxStock}</td>
                  <td className="px-4 py-2 font-semibold tabular-nums">{toSupply(item)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
