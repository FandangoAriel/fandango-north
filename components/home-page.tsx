"use client";

import { OverviewView } from "@/components/overview-view";
import { useInventory } from "@/lib/inventory-store";

export function HomePage() {
  const { state } = useInventory();
  return <OverviewView sites={state.sites} />;
}
