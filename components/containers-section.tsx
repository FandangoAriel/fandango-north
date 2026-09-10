"use client";

import { useState } from "react";
import { Container, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useInventory } from "@/lib/inventory-store";
import { formatHeDate } from "@/lib/stats";
import type { Site } from "@/lib/types";

export function ContainersSection({ site }: { site: Site }) {
  const { addContainer, toggleSupplied, removeContainer } = useInventory();
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [containerType, setContainerType] = useState("");
  const [plannedDate, setPlannedDate] = useState("");
  const [dueDate, setDueDate] = useState("");

  function submit() {
    if (!customerName.trim() || !containerType.trim()) {
      toast.error("צריך שם לקוח וסוג מיכל");
      return;
    }
    addContainer(site.id, {
      customerId,
      customerName,
      containerType,
      plannedDate: plannedDate || null,
      dueDate: dueDate || null,
    });
    toast.success("המיכל נוסף לרשימה");
    setCustomerId("");
    setCustomerName("");
    setContainerType("");
    setPlannedDate("");
    setDueDate("");
    setOpen(false);
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">מיכלים משולטים</h2>
          <p className="text-sm text-muted-foreground">
            מיכלים שמתוכננים לאתר, כולל לקוח ותאריך פעילות
          </p>
        </div>
        <Button variant="outline" onClick={() => setOpen(true)}>
          <Plus />
          מיכל חדש
        </Button>
      </div>

      {site.containers.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-muted/40 px-4 py-12 text-center">
          <Container className="size-8 text-muted-foreground" />
          <p className="font-medium">אין מיכלים משולטים באתר זה</p>
          <p className="text-sm text-muted-foreground">כשמצרפים מיכל ללקוח הוא יופיע כאן.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {site.containers.map((job) => (
            <article
              key={job.id}
              className={`flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:flex-row sm:items-center sm:justify-between ${
                job.supplied ? "opacity-70" : ""
              }`}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={job.supplied}
                  onCheckedChange={() => toggleSupplied(site.id, job.id)}
                  aria-label="סופק באתר"
                />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{job.customerName}</h3>
                    {job.supplied ? (
                      <Badge variant="secondary">סופק ב{site.name}</Badge>
                    ) : (
                      <Badge variant="outline">ממתין</Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{job.containerType}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {job.customerId ? `מס׳ לקוח ${job.customerId}` : "בלי מספר לקוח"}
                    {" · "}
                    פעילות {formatHeDate(job.plannedDate)}
                    {" · "}
                    יעד {formatHeDate(job.dueDate)}
                  </p>
                </div>
              </div>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="מחק מיכל"
                onClick={() => {
                  removeContainer(site.id, job.id);
                  toast.message("המיכל הוסר");
                }}
              >
                <Trash2 />
              </Button>
            </article>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>מיכל משולט חדש</DialogTitle>
            <DialogDescription>השיוך יישמר לאתר {site.name}.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="cust-name">שם לקוח</Label>
              <Input
                id="cust-name"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder="מקדונלדס - עמיעד"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cust-id">מספר לקוח</Label>
              <Input
                id="cust-id"
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
                placeholder="30251"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ctype">סוג מיכל</Label>
              <Input
                id="ctype"
                value={containerType}
                onChange={(event) => setContainerType(event.target.value)}
                placeholder="מיכל 600"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="planned">תאריך פעילות</Label>
                <Input
                  id="planned"
                  type="date"
                  value={plannedDate}
                  onChange={(event) => setPlannedDate(event.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="due">תאריך יעד</Label>
                <Input
                  id="due"
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="sm:justify-start">
            <Button onClick={submit}>הוספה</Button>
            <Button variant="outline" onClick={() => setOpen(false)}>
              ביטול
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
