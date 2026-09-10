import { Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import type { Farm, FarmId, StockUpdate } from "../../shared/types";
import { api } from "../api";
import { CompactQty, NoteField, PrimaryButton, Screen } from "../ui";

export function ReportScreen({
  farmId,
  user,
  onBack,
}: {
  farmId: FarmId;
  user: string;
  onBack: () => void;
}) {
  const [farm, setFarm] = useState<Farm | null>(null);
  const [demo, setDemo] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [actualDraft, setActualDraft] = useState<Record<string, string>>({});
  const [maxDraft, setMaxDraft] = useState<Record<string, string>>({});
  const [editingMax, setEditingMax] = useState<string | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    api<{ farm: Farm; demo: boolean }>(`/api/inventory?farm=${farmId}`)
      .then((data) => {
        setFarm(data.farm);
        setDemo(data.demo);
        setActualDraft({});
        setMaxDraft({});
        setEditingMax(null);
        setNote("");
      })
      .catch(() => setError("לא הצלחנו לטעון את המלאי"));
  }, [farmId]);

  async function save() {
    if (!farm) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const items: StockUpdate[] = [];
      for (const item of farm.equipment) {
        const update: StockUpdate = { id: item.id, name: item.name };
        let changed = false;
        const actualRaw = actualDraft[item.id];
        if (actualRaw !== undefined && actualRaw !== "") {
          update.actual = Number(actualRaw);
          changed = true;
        }
        const maxRaw = maxDraft[item.id];
        if (maxRaw !== undefined && maxRaw !== "") {
          const nextMax = Number(maxRaw);
          if (nextMax !== item.maxStock) {
            update.maxStock = nextMax;
            changed = true;
          }
        }
        if (changed) items.push(update);
      }
      const data = await api<{ farm: Farm; demo: boolean }>("/api/report", {
        method: "POST",
        body: JSON.stringify({ farmId, user, note, items }),
      });
      setFarm(data.farm);
      setDemo(data.demo);
      setActualDraft({});
      setMaxDraft({});
      setEditingMax(null);
      setNote("");
      setMessage(items.length || note.trim() ? "הדיווח נשמר" : "אין כמויות לדיווח");
    } catch {
      setError("השמירה נכשלה");
    } finally {
      setSaving(false);
    }
  }

  if (!farm && !error) {
    return (
      <Screen title="דיווח מלאי" onBack={onBack}>
        <p className="text-sm text-black/60">טוען מלאי…</p>
      </Screen>
    );
  }

  return (
    <Screen
      title="דיווח מלאי"
      subtitle={`${farm?.name ?? ""} · רשמו כמה יש עכשיו`}
      onBack={onBack}
      demo={demo}
    >
      {error && <p className="rounded-md bg-red-50 px-2 py-1 text-[12px] text-red-800">{error}</p>}
      {message && (
        <p className="rounded-md bg-emerald-50 px-2 py-1 text-[12px] text-emerald-800">{message}</p>
      )}
      <div className="overflow-hidden rounded-lg bg-white">
        {farm?.equipment.map((item) => {
          const maxValue = maxDraft[item.id] ?? String(item.maxStock);
          const editing = editingMax === item.id;
          return (
            <div
              key={item.id}
              className="flex items-center gap-1.5 border-b border-black/8 px-2 py-0.5 last:border-b-0"
            >
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium leading-tight">
                {item.name}
              </span>
              {editing ? (
                <CompactQty
                  label={`מקס של ${item.name}`}
                  value={maxValue}
                  onChange={(value) => setMaxDraft((current) => ({ ...current, [item.id]: value }))}
                />
              ) : (
                <span className="shrink-0 text-[12px] text-black/50">מקס {maxValue}</span>
              )}
              <button
                type="button"
                aria-label={`עריכת מקס של ${item.name}`}
                onClick={() => {
                  setMaxDraft((current) => ({
                    ...current,
                    [item.id]: current[item.id] ?? String(item.maxStock),
                  }));
                  setEditingMax(editing ? null : item.id);
                }}
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-[#3d6b4a]"
              >
                <Pencil size={13} strokeWidth={2.2} />
              </button>
              <CompactQty
                label={`כמות בפועל של ${item.name}`}
                value={actualDraft[item.id] ?? ""}
                onChange={(value) => setActualDraft((current) => ({ ...current, [item.id]: value }))}
              />
            </div>
          );
        })}
      </div>
      <NoteField value={note} onChange={setNote} label="הערה" />
      <div className="sticky bottom-0 bg-[#f4efe4] pt-2 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
        <PrimaryButton onClick={save} disabled={saving || !farm}>
          {saving ? "שומר…" : "שמירה לגיליון"}
        </PrimaryButton>
      </div>
    </Screen>
  );
}
