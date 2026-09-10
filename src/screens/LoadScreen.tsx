import { useEffect, useState } from "react";
import type { FarmId, LoadItem } from "../../shared/types";
import { FARM_SHEETS, nextLoadMark } from "../../shared/types";
import { api } from "../api";
import { CompactQty, NoteField, PrimaryButton, Screen, TriMark } from "../ui";

function LoadRows({
  items,
  onCycle,
  onHaveQty,
}: {
  items: LoadItem[];
  onCycle: (id: string) => void;
  onHaveQty: (id: string, value: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg bg-white">
      {items.map((item) => (
        <div
          key={item.itemId}
          className="flex items-center gap-1.5 border-b border-black/8 px-2 py-0.5 last:border-b-0"
        >
          <TriMark mark={item.mark} onCycle={() => onCycle(item.itemId)} label={item.name} />
          <span className="min-w-0 flex-1 truncate text-[13px] leading-tight">
            {item.name}
            {item.kind === "stock" ? (
              <>
                {" "}
                <span className="text-[13px] font-semibold tabular-nums text-[#b45309]">
                  {item.toSupply}
                </span>
              </>
            ) : null}
          </span>
          {item.mark === "partial" && (
            <CompactQty
              label={`כמות שיש מ${item.name}`}
              value={item.haveQty == null ? "" : String(item.haveQty)}
              placeholder="יש"
              onChange={(value) => onHaveQty(item.itemId, value)}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export function LoadScreen({
  farmId,
  user,
  onBack,
}: {
  farmId: FarmId;
  user: string;
  onBack: () => void;
}) {
  const [items, setItems] = useState<LoadItem[]>([]);
  const [demo, setDemo] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");

  useEffect(() => {
    api<{ items: LoadItem[]; demo: boolean }>(`/api/load?farm=${farmId}`)
      .then((data) => {
        setItems(
          data.items.map((item) => ({
            ...item,
            mark: item.mark ?? "unset",
            haveQty: item.haveQty ?? null,
          })),
        );
        setDemo(data.demo);
      })
      .catch(() => setError("לא הצלחנו לטעון את רשימת ההעמסה"))
      .finally(() => setLoading(false));
  }, [farmId]);

  const markedCount = items.filter((item) => item.mark !== "unset").length;
  const containers = items.filter((item) => item.kind === "container");
  const stock = items.filter((item) => item.kind === "stock");

  function cycle(id: string) {
    setItems((current) =>
      current.map((row) => {
        if (row.itemId !== id) return row;
        const mark = nextLoadMark(row.mark);
        return {
          ...row,
          mark,
          haveQty: mark === "partial" ? row.haveQty : null,
        };
      }),
    );
  }

  function setHaveQty(id: string, value: string) {
    setItems((current) =>
      current.map((row) =>
        row.itemId === id ? { ...row, haveQty: value === "" ? null : Number(value) } : row,
      ),
    );
  }

  async function save() {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await api("/api/load", {
        method: "POST",
        body: JSON.stringify({
          farmId,
          user,
          note,
          items: items.map((item) => ({
            itemId: item.itemId,
            mark: item.mark,
            haveQty: item.haveQty ?? null,
          })),
        }),
      });
      setMessage("ההעמסה נשמרה");
    } catch {
      setError("השמירה נכשלה");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Screen title="העמסה מהמחסן" onBack={onBack}>
        <p className="text-sm text-black/60">טוען רשימת העמסה…</p>
      </Screen>
    );
  }

  return (
    <Screen
      title="העמסה מהמחסן"
      subtitle={`${FARM_SHEETS[farmId].name} · סמנו מה העמסתם`}
      onBack={onBack}
      demo={demo}
    >
      {error && <p className="rounded-md bg-red-50 px-2 py-1 text-[12px] text-red-800">{error}</p>}
      {message && (
        <p className="rounded-md bg-emerald-50 px-2 py-1 text-[12px] text-emerald-800">{message}</p>
      )}
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-black/15 bg-white px-3 py-6 text-center">
          <p className="text-sm font-medium">אין מה להעמיס לחווה זו</p>
          <p className="mt-0.5 text-[12px] text-black/55">אין מיכלים ממתינים ואין חוסר במלאי.</p>
        </div>
      ) : (
        <>
          <p className="text-[12px] text-black/60">
            סומנו {markedCount} מתוך {items.length}
          </p>
          {containers.length > 0 && (
            <section>
              <h2 className="mb-0.5 text-[11px] font-semibold text-[#3d6b4a]">מיכלים משולטים</h2>
              <LoadRows items={containers} onCycle={cycle} onHaveQty={setHaveQty} />
            </section>
          )}
          {stock.length > 0 && (
            <section>
              <h2 className="mb-0.5 text-[11px] font-semibold text-[#3d6b4a]">ציוד להשלמה</h2>
              <LoadRows items={stock} onCycle={cycle} onHaveQty={setHaveQty} />
            </section>
          )}
          <NoteField value={note} onChange={setNote} label="הערה" />
          <div className="sticky bottom-0 bg-[#f4efe4] pt-2 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
            <PrimaryButton onClick={save} disabled={saving}>
              {saving ? "שומר…" : "שמירת העמסה"}
            </PrimaryButton>
          </div>
        </>
      )}
    </Screen>
  );
}
