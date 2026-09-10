"use client";

import { SupplyView } from "@/components/supply-view";
import { useInventory } from "@/lib/inventory-store";

export function SupplyPage() {
  const { state } = useInventory();
  return <SupplyView sites={state.sites} />;
}
