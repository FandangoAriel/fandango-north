"use client";

import type { ReactNode } from "react";
import { AlertTriangle, ArrowLeft, Container, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatHeDate,
  isStale,
  pendingContainers,
  siteShortages,
  siteSupplyUnits,
  toSupply,
} from "@/lib/stats";
import type { Site, SiteId } from "@/lib/types";

const SITE_ACCENT: Record<SiteId, string> = {
  "beit-haemek": "bg-emerald-700",
  "lehavot-haviva": "bg-amber-800",
  "kfar-hasidim": "bg-teal-800",
};

export function OverviewView({
  sites,
  onOpenSite,
}: {
  sites: Site[];
  onOpenSite: (id: SiteId) => void;
}) {
  const shortageItems = sites.reduce((sum, site) => sum + siteShortages(site).length, 0);
  const units = sites.reduce((sum, site) => sum + siteSupplyUnits(site), 0);
  const pending = sites.reduce((sum, site) => sum + pendingContainers(site).length, 0);
  const staleSites = sites.filter((site) => isStale(site.updatedAt));

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="פריטים חסרים" value={shortageItems} hint="צריך להשלים למלאי יעד" />
        <Kpi label="יחידות לספקה" value={units} hint="סך הפער מול המקסימום" />
        <Kpi label="מיכלים ממתינים" value={pending} hint="עדיין לא סופקו באתר" />
        <Kpi
          label="אתרים לא מעודכנים"
          value={staleSites.length}
          hint={staleSites.length ? staleSites.map((s) => s.name).join(" · ") : "כל האתרים בטווח סביר"}
          warn={staleSites.length > 0}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {sites.map((site) => {
          const shortages = siteShortages(site);
          const jobs = pendingContainers(site);
          const unitsForSite = siteSupplyUnits(site);
          const stale = isStale(site.updatedAt);
          return (
            <Card key={site.id} className="cursor-pointer transition hover:ring-foreground/20" onClick={() => onOpenSite(site.id)}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`size-2.5 rounded-full ${SITE_ACCENT[site.id]}`} />
                    <CardTitle>{site.name}</CardTitle>
                  </div>
                  {stale && (
                    <Badge variant="destructive">
                      <AlertTriangle />
                      מיושן
                    </Badge>
                  )}
                </div>
                <CardDescription>עדכון אחרון {formatHeDate(site.updatedAt)}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <Stat icon={<Package className="size-4" />} label="לספק" value={`${unitsForSite} יח׳`} />
                  <Stat icon={<Container className="size-4" />} label="מיכלים" value={String(jobs.length)} />
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">החוסרים הגדולים</p>
                  {shortages.length === 0 ? (
                    <p className="text-sm">המלאי באתר מלא.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {shortages.slice(0, 4).map((item) => (
                        <li key={item.id} className="flex items-center justify-between text-sm">
                          <span>{item.name}</span>
                          <span className="tabular-nums text-muted-foreground">
                            {item.actual}/{item.maxStock} · +{toSupply(item)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <Button variant="outline" className="w-full" onClick={() => onOpenSite(site.id)}>
                  כניסה לאתר
                  <ArrowLeft />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  warn,
}: {
  label: string;
  value: number;
  hint: string;
  warn?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className={`text-3xl tabular-nums ${warn ? "text-destructive" : ""}`}>
          {value}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardHeader>
    </Card>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg bg-muted/60 px-3 py-2">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
