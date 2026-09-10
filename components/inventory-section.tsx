"use client";

import { useMemo, useState } from "react";
import { PackagePlus, Search, Trash2, Warehouse } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QtyStepper } from "@/components/qty-stepper";
import { useInventory } from "@/lib/inventory-store";
import {
  fillPercent,
  isEmpty,
  isShortage,
  matchesFilter,
  surplus,
  toSupply,
} from "@/lib/stats";
import type { EquipmentFilter, EquipmentItem, Site } from "@/lib/types";

const FILTERS: { id: EquipmentFilter; label: string }[] = [
  { id: "all", label: "הכול" },
  { id: "shortage", label: "חסר" },
  { id: "empty", label: "אפס במלאי" },
  { id: "ok", label: "מלא" },
];

function StockBar({ item }: { item: EquipmentItem }) {
  const pct = fillPercent(item);
  const tone = isEmpty(item)
    ? "bg-destructive"
    : isShortage(item)
      ? "bg-amber-500"
      : surplus(item)
        ? "bg-sky-600"
        : "bg-primary";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function ItemStatus({ item }: { item: EquipmentItem }) {
  if (item.maxStock === 0 && item.actual === 0) {
    return <Badge variant="secondary">אין יעד</Badge>;
  }
  if (surplus(item) > 0) {
    return <Badge variant="secondary">עודף {surplus(item)}</Badge>;
  }
  if (isEmpty(item)) {
    return <Badge variant="destructive">חסר לגמרי</Badge>;
  }
  if (isShortage(item)) {
    return <Badge variant="outline">לספק {toSupply(item)}</Badge>;
  }
  return (
    <Badge className="bg-primary/15 text-primary hover:bg-primary/20" variant="secondary">
      מלא
    </Badge>
  );
}

export function InventorySection({ site }: { site: Site }) {
  const { updateActual, updateMax, fillItem, addItem, removeItem } = useInventory();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<EquipmentFilter>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [actual, setActual] = useState(0);
  const [maxStock, setMaxStock] = useState(0);

  const items = useMemo(() => {
    const q = query.trim();
    return site.equipment.filter((item) => {
      if (!matchesFilter(item, filter)) return false;
      if (!q) return true;
      return item.name.includes(q);
    });
  }, [site.equipment, filter, query]);

  function submitNew() {
    if (!name.trim()) {
      toast.error("צריך שם לפריט");
      return;
    }
    addItem(site.id, { name, actual, maxStock });
    toast.success("הפריט נוסף למלאי");
    setName("");
    setActual(0);
    setMaxStock(0);
    setAddOpen(false);
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">מלאי ציוד</h2>
          <p className="text-sm text-muted-foreground">
            כמות לספק = מלאי מקסימום פחות כמות בפועל
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <PackagePlus />
          פריט חדש
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="חיפוש פריט…"
            className="pr-8"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((option) => (
            <Button
              key={option.id}
              size="sm"
              variant={filter === option.id ? "default" : "outline"}
              onClick={() => setFilter(option.id)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-muted/40 px-4 py-12 text-center">
          <Warehouse className="size-8 text-muted-foreground" />
          <p className="font-medium">אין פריטים שמתאימים לסינון</p>
          <p className="text-sm text-muted-foreground">נסו חיפוש אחר או בחרו «הכול».</p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl ring-1 ring-foreground/10 md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/70 text-muted-foreground">
                <tr className="text-right">
                  <th className="px-3 py-2 font-medium">ציוד</th>
                  <th className="px-3 py-2 font-medium">בפועל</th>
                  <th className="px-3 py-2 font-medium">מקסימום</th>
                  <th className="px-3 py-2 font-medium">לספק</th>
                  <th className="px-3 py-2 font-medium">מצב</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-border/80">
                    <td className="px-3 py-2.5">
                      <div className="font-medium">{item.name}</div>
                      <div className="mt-1 max-w-48">
                        <StockBar item={item} />
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <QtyStepper
                        value={item.actual}
                        onChange={(next) => updateActual(site.id, item.id, next)}
                        ariaLabel={`כמות בפועל של ${item.name}`}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <QtyStepper
                        value={item.maxStock}
                        onChange={(next) => updateMax(site.id, item.id, next)}
                        ariaLabel={`מלאי מקסימום של ${item.name}`}
                      />
                    </td>
                    <td className="px-3 py-2.5 tabular-nums font-semibold">
                      {toSupply(item)}
                    </td>
                    <td className="px-3 py-2.5">
                      <ItemStatus item={item} />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-1">
                        {isShortage(item) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              fillItem(site.id, item.id);
                              toast.success(`${item.name} סומן כמלא`);
                            }}
                          >
                            מלא יעד
                          </Button>
                        )}
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`מחק ${item.name}`}
                          onClick={() => {
                            removeItem(site.id, item.id);
                            toast.message("הפריט הוסר");
                          }}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 md:hidden">
            {items.map((item) => (
              <article
                key={item.id}
                className="space-y-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-medium">{item.name}</h3>
                    <div className="mt-1">
                      <ItemStatus item={item} />
                    </div>
                  </div>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`מחק ${item.name}`}
                    onClick={() => removeItem(site.id, item.id)}
                  >
                    <Trash2 />
                  </Button>
                </div>
                <StockBar item={item} />
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">בפועל</p>
                    <QtyStepper
                      value={item.actual}
                      onChange={(next) => updateActual(site.id, item.id, next)}
                      ariaLabel={`כמות בפועל של ${item.name}`}
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">מקסימום</p>
                    <QtyStepper
                      value={item.maxStock}
                      onChange={(next) => updateMax(site.id, item.id, next)}
                      ariaLabel={`מלאי מקסימום של ${item.name}`}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">לספק</span>
                  <span className="font-semibold tabular-nums">{toSupply(item)}</span>
                </div>
                {isShortage(item) && (
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => fillItem(site.id, item.id)}
                  >
                    מלא יעד
                  </Button>
                )}
              </article>
            ))}
          </div>
        </>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>הוספת פריט למלאי</DialogTitle>
            <DialogDescription>הפריט יופיע באתר {site.name}.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="item-name">שם הציוד</Label>
              <Input
                id="item-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="למשל מנעולי קאבה"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>כמות בפועל</Label>
                <QtyStepper value={actual} onChange={setActual} ariaLabel="כמות בפועל" />
              </div>
              <div className="grid gap-1.5">
                <Label>מלאי מקסימום</Label>
                <QtyStepper value={maxStock} onChange={setMaxStock} ariaLabel="מלאי מקסימום" />
              </div>
            </div>
          </div>
          <DialogFooter className="sm:justify-start">
            <Button onClick={submitNew}>הוספה</Button>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              ביטול
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
