import { useEffect, useState } from "react";
import type { Farm, FarmId } from "../../shared/types";
import { toSupply } from "../../shared/types";
import { api } from "../api";
import { PrimaryButton, Qty, Screen } from "../ui";

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

  useEffect(() => {
    api<{ farm: Farm; demo: boolean }>(`/api/inventory?farm=${farmId}`)
      .then((data) => {
        setFarm(data.farm);
        setDemo(data.demo);
      })
      .catch(() => setError("לא הצלחנו לטעון את המלאי"));
  }, [farmId]);

  async function save() {
    if (!farm) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const data = await api<{ farm: Farm; demo: boolean }>("/api/report", {
        method: "POST",
        body: JSON.stringify({
          farmId,
          user,
          items: farm.equipment.map((item) => ({
            id: item.id,
            actual: item.actual,
            name: item.name,
          })),
        }),
      });
      setFarm(data.farm);
      setDemo(data.demo);
      setMessage("המלאי נשמר");
    } catch {
      setError("השמירה נכשלה");
    } finally {
      setSaving(false);
    }
  }

  if (!farm && !error) {
    return (
      <Screen title="דיווח מלאי" onBack={onBack}>
        <p className="text-black/60">טוען מלאי…</p>
      </Screen>
    );
  }

  return (
    <Screen
      title="דיווח מלאי"
      subtitle={`${farm?.name ?? ""} · כמה יש עכשיו בחווה`}
      onBack={onBack}
      demo={demo}
    >
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      {message && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
      <div className="grid gap-3">
        {farm?.equipment.map((item) => {
          const need = toSupply(item);
          return (
            <article key={item.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{item.name}</h2>
                  <p className="text-sm text-black/55">יעד {item.maxStock}</p>
                  {need > 0 ? (
                    <p className="mt-1 text-sm text-[#b45309]">חסר {need}</p>
                  ) : (
                    <p className="mt-1 text-sm text-[#3d6b4a]">מלא</p>
                  )}
                </div>
                <Qty
                  label={`כמות בפועל של ${item.name}`}
                  value={item.actual}
                  onChange={(actual) =>
                    setFarm({
                      ...farm,
                      equipment: farm.equipment.map((row) =>
                        row.id === item.id ? { ...row, actual } : row,
                      ),
                    })
                  }
                />
              </div>
            </article>
          );
        })}
      </div>
      <div className="sticky bottom-0 bg-[#f4efe4] pt-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <PrimaryButton onClick={save} disabled={saving || !farm}>
          {saving ? "שומר…" : "שמירה לגיליון"}
        </PrimaryButton>
      </div>
    </Screen>
  );
}
