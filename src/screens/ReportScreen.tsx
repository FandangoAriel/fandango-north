import { Pencil } from "lucide-react";
import { useState } from "react";
import type { Farm, FarmId, ReportRecord, StockUpdate } from "../../shared/types";
import { api } from "../api";
import { CompactQty, ConfirmBar, ChipButton, NoteField, PrimaryButton, Screen } from "../ui";
import { SortableList, SortableRow } from "../sortable";
import { useEnterRefresh } from "../useEnterRefresh";

const ROW = "grid grid-cols-[24px_minmax(0,1fr)_4.75rem_3.25rem] items-center gap-x-1 border-b border-black/8 px-1 py-0.5";

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [editingReport, setEditingReport] = useState<ReportRecord | null>(null);
  const [warn, setWarn] = useState("");

  function loadFarm(resetDrafts: boolean) {
    return api<{ farm: Farm; demo: boolean }>(`/api/inventory?farm=${farmId}`).then((data) => {
      setFarm(data.farm);
      setDemo(data.demo);
      if (resetDrafts) {
        setActualDraft({});
        setMaxDraft({});
        setEditingMax(null);
        setNote("");
        setEditingReport(null);
        setWarn("");
      }
    });
  }

  useEnterRefresh(
    () => {
      loadFarm(true).catch(() => setError("לא הצלחנו לטעון את המלאי"));
      api<{ reports: ReportRecord[] }>(`/api/reports?farm=${farmId}`)
        .then((data) => setReports(data.reports))
        .catch(() => setReports([]));
    },
    [farmId],
    () => {
      loadFarm(false).catch(() => setError("לא הצלחנו לטעון את המלאי"));
      api<{ reports: ReportRecord[] }>(`/api/reports?farm=${farmId}`)
        .then((data) => setReports(data.reports))
        .catch(() => setReports([]));
    },
  );

  function applyReport(report: ReportRecord) {
    if (!farm) return;
    const next: Record<string, string> = {};
    const maxNext: Record<string, string> = {};
    for (const item of report.items) {
      const match =
        farm.equipment.find((row) => row.id === item.id) ??
        farm.equipment.find((row) => row.name === item.name);
      if (!match) continue;
      if (item.actual !== undefined) next[match.id] = String(item.actual);
      if (item.maxStock !== undefined) maxNext[match.id] = String(item.maxStock);
    }
    setActualDraft(next);
    setMaxDraft(maxNext);
    setNote(report.note ?? "");
    setEditingReport(report);
    setShowHistory(false);
    setWarn("");
    setMessage(`נפתח דיווח מ־${formatWhen(report.at)}. שמירה תעדכן את הגיליון.`);
  }

  function fillFromSheet() {
    if (!farm) return;
    const next: Record<string, string> = {};
    for (const item of farm.equipment) next[item.id] = String(item.actual);
    setActualDraft(next);
    setEditingReport(null);
    setMessage("מולא לפי המלאי שבגיליון. אפשר לערוך ולשמור.");
  }

  async function reorder(ids: string[]) {
    if (!farm) return;
    setFarm({ ...farm, equipment: ids.map((id) => farm.equipment.find((item) => item.id === id)!).filter(Boolean), itemOrder: ids });
    try {
      const data = await api<{ farm: Farm; demo: boolean }>("/api/order", {
        method: "POST",
        body: JSON.stringify({ farmId, itemIds: ids }),
      });
      setFarm(data.farm);
      setDemo(data.demo);
    } catch {
      setError("לא הצלחנו לשמור את הסדר");
    }
  }

  async function save() {
    if (!farm) return;
    const missing = farm.equipment.filter((item) => !actualDraft[item.id]?.length);
    if (missing.length && !warn) {
      setWarn(`לא דווח מלאי קיים ב־${missing.length} פריטים. לשמור בכל זאת?`);
      return;
    }
    setSaving(true);
    setMessage("");
    setError("");
    setWarn("");
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
      setEditingReport(null);
      setMessage(items.length || note.trim() ? "הדיווח נשמר" : "אין כמויות לדיווח");
      const listed = await api<{ reports: ReportRecord[] }>(`/api/reports?farm=${farmId}`);
      setReports(listed.reports);
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

  const ids = farm?.equipment.map((item) => item.id) ?? [];

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
      <div className="flex flex-wrap gap-2">
        <ChipButton active={showHistory} onClick={() => setShowHistory((open) => !open)}>
          עריכת דיווח קודם
        </ChipButton>
        <ChipButton onClick={fillFromSheet}>מילוי לפי הגיליון</ChipButton>
        <ChipButton onClick={() => loadFarm(false).catch(() => setError("הרענון נכשל"))}>
          רענון מהגיליון
        </ChipButton>
      </div>
      {showHistory && (
        <div className="rounded-lg bg-white px-2 py-1">
          {reports.length === 0 ? (
            <p className="py-2 text-[12px] text-black/50">אין דיווחים קודמים</p>
          ) : (
            reports.map((report) => (
              <button
                key={report.id}
                type="button"
                onClick={() => applyReport(report)}
                className="flex w-full items-center justify-between border-b border-black/8 py-1.5 text-right text-[12px] last:border-b-0"
              >
                <span>
                  {formatWhen(report.at)} · {report.user}
                </span>
                <span className="text-black/45">{report.items.length} פריטים</span>
              </button>
            ))
          )}
        </div>
      )}
      {editingReport && (
        <p className="text-[11px] text-[#3d6b4a]">
          עורכים דיווח מ־{formatWhen(editingReport.at)}. שמירה כותבת מחדש לגיליון.
        </p>
      )}
      <div className="overflow-hidden rounded-lg bg-white">
        <div className={`${ROW} border-b border-black/15 bg-[#f8f4ea] text-[10px] font-semibold text-black/55`}>
          <span />
          <span>פריט</span>
          <span className="text-center">מקס</span>
          <span className="text-center leading-tight">מלאי קיים</span>
        </div>
        <SortableList ids={ids} onReorder={reorder}>
          {farm?.equipment.map((item) => {
            const maxValue = maxDraft[item.id] ?? String(item.maxStock);
            const editing = editingMax === item.id;
            return (
              <SortableRow key={item.id} id={item.id}>
                {({ grip }) => (
                  <div className={ROW}>
                    {grip}
                    <span className="min-w-0 truncate text-[13px] font-medium leading-tight">
                      {item.name}
                    </span>
                    <div className="flex items-center justify-center gap-0.5">
                      {editing ? (
                        <CompactQty
                          label={`מקס של ${item.name}`}
                          value={maxValue}
                          onChange={(value) =>
                            setMaxDraft((current) => ({ ...current, [item.id]: value }))
                          }
                        />
                      ) : (
                        <span className="text-[12px] tabular-nums text-black/55">{maxValue}</span>
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
                        className="flex size-6 shrink-0 items-center justify-center rounded-md text-[#3d6b4a]"
                      >
                        <Pencil size={13} strokeWidth={2.2} />
                      </button>
                    </div>
                    <div className="flex justify-center">
                      <CompactQty
                        label={`מלאי קיים של ${item.name}`}
                        value={actualDraft[item.id] ?? ""}
                        onChange={(value) => {
                          setWarn("");
                          setActualDraft((current) => ({ ...current, [item.id]: value }));
                        }}
                      />
                    </div>
                  </div>
                )}
              </SortableRow>
            );
          })}
        </SortableList>
      </div>
      <NoteField value={note} onChange={setNote} label="הערה" />
      {warn && (
        <ConfirmBar text={warn} onCancel={() => setWarn("")} onConfirm={() => void save()} />
      )}
      <div className="sticky bottom-0 bg-[#f4efe4] pt-2 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
        <PrimaryButton onClick={() => void save()} disabled={saving || !farm}>
          {saving ? "שומר…" : "שמירה לגיליון"}
        </PrimaryButton>
      </div>
    </Screen>
  );
}
