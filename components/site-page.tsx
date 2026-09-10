"use client";

import Link from "next/link";
import { SiteView } from "@/components/site-view";
import { buttonVariants } from "@/components/ui/button";
import { useInventory } from "@/lib/inventory-store";
import { cn } from "@/lib/utils";

export function SitePage({ siteId }: { siteId: string }) {
  const { state } = useInventory();
  const site = state.sites.find((item) => item.id === siteId);

  if (!site) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/40 px-4 py-12 text-center">
        <p className="font-medium">האתר לא נמצא</p>
        <Link href="/" className={cn(buttonVariants({ variant: "outline" }), "mt-4")}>
          חזרה לסקירה
        </Link>
      </div>
    );
  }

  return <SiteView site={site} />;
}
