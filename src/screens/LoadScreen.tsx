import { useEffect, useState } from "react";
import type { FarmId, LoadItem } from "../../shared/types";
import { FARM_SHEETS } from "../../shared/types";
import { api } from "../api";
import { PrimaryButton, Screen } from "../ui";

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

  useEffect(() => {
    api<{ items: LoadItem[]; demo: boolean }>(`/api/load?farm=${farmId}`)
      .then((data) => {
        setItems(data.items);
        setDemo(data.demo);
      })
      .catch(() => setError("לא הצלחנו לטעון את רשימת החוסרים"))
      .finally(() => setLoading(false));
  }, [farmId]);

  const loadedCount = items.filter((item) => item.loaded).length;

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
          loadedIds: items.filter((item) => item.loaded).map((item) => item.itemId),
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
        <p className="text-black/60">טוען חוסרים…</p>
      </Screen>
    );
  }

  return (
    <Screen
      title="העמסה מהמחסן"
      subtitle={`${FARM_SHEETS[farmId].name} · סמנו מה העמסתם על הרכב`}
      onBack={onBack}
      demo={demo}
    >
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      {message && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/15 bg-white px-4 py-10 text-center">
          <p className="font-medium">אין מה להשלים בחווה זו</p>
          <p className="mt-1 text-sm text-black/55">כל הפריטים עומדים ביעד המלאי.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-black/60">
            הועמסו {loadedCount} מתוך {items.length} פריטים
          </p>
          <div className="grid gap-2">
            {items.map((item) => (
              <label
                key={item.itemId}
                className="flex min-h-16 items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm"
              >
                <input
                  type="checkbox"
                  checked={item.loaded}
                  onChange={() =>
                    setItems((current) =>
                      current.map((row) =>
                        row.itemId === item.itemId ? { ...row, loaded: !row.loaded } : row,
                      ),
                    )
                  }
                  className="size-6 accent-[#3d6b4a]"
                />
                <span className="flex-1">
                  <span className="block font-semibold">{item.name}</span>
                  <span className="text-sm text-black/55">להשלים {item.toSupply}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="sticky bottom-0 bg-[#f4efe4] pt-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <PrimaryButton onClick={save} disabled={saving}>
              {saving ? "שומר…" : "שמירת העמסה"}
            </PrimaryButton>
          </div>
        </>
      )}
    </Screen>
  );
}
