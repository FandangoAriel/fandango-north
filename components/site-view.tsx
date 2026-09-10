"use client";

import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ContainersSection } from "@/components/containers-section";
import { InventorySection } from "@/components/inventory-section";
import { formatHeDate, isStale, pendingContainers, siteShortages, siteSupplyUnits } from "@/lib/stats";
import type { Site } from "@/lib/types";

export function SiteView({ site }: { site: Site }) {
  const shortages = siteShortages(site).length;
  const units = siteSupplyUnits(site);
  const pending = pendingContainers(site).length;
  const stale = isStale(site.updatedAt);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">{site.name}</h2>
            {stale && (
              <Badge variant="destructive">
                <AlertTriangle />
                לא עודכן מאז {formatHeDate(site.updatedAt)}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            עדכון אחרון {formatHeDate(site.updatedAt)} · כל שינוי נשמר במחשב זה ומעדכן את התאריך
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-3 text-center">
          <MiniStat label="פריטים חסרים" value={shortages} />
          <MiniStat label="יחידות לספקה" value={units} />
          <MiniStat label="מיכלים ממתינים" value={pending} />
        </dl>
      </div>
      <InventorySection site={site} />
      <ContainersSection site={site} />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-20 rounded-lg bg-muted/70 px-3 py-2">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
