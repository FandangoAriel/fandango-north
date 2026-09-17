import { Pencil, Plus, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { EquipmentItem, Farm, FarmId, ReportRecord, StockUpdate } from "../../shared/types";
import { isNewEquipmentId } from "../../shared/types";
import { api } from "../api";
import { CompactName, CompactQty, ConfirmBar, ChipButton, DirtyMediaField, NoteField, PrimaryButton, Screen } from "../ui";
import { blobToBase64, compressImage, idbGet, idbPut, kindFromMime, MAX_MEDIA_BYTES } from "../dirtyMedia";
import { SortableList, SortableRow } from "../sortable";
import { useEnterRefresh } from "../useEnterRefresh";

const ROW = "grid grid-cols-[24px_minmax(0,1fr)_4.75rem_3.25rem] items-center gap-x-1 border-b border-black/8 px-1 py-0.5";

type DirtyDraft = {
  id: string;
  kind: "image" | "video";
  name: string;
  mime: string;
  previewUrl: string;
  file?: File;
  url?: string;
};

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

  const [focusNew, setFocusNew] = useState<string | null>(null);
  const [reorderMode, setReorderMode] = useState(false);
  const [dirtyMedia, setDirtyMedia] = useState<DirtyDraft[]>([]);

  function clearDirtyMedia(next: DirtyDraft[] = []) {
    setDirtyMedia((current) => {
      for (const item of current) {
        if (item.previewUrl.startsWith("blob:")) URL.revokeObjectURL(item.previewUrl);
      }
      return next;
    });
  }

  async function addDirtyFiles(files: File[]) {
    const added: DirtyDraft[] = [];
    for (const file of files) {
      if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
        setError("אפשר לצרף רק תמונה או סרטון");
        continue;
      }
      if (file.size > MAX_MEDIA_BYTES && file.type.startsWith("video/")) {
        setError("הסרטון גדול מדי. הקליטו קצר יותר או צרפו תמונה.");
        continue;
      }
      const id = crypto.randomUUID();
      const kind = kindFromMime(file.type, file.name);
      added.push({
        id,
        kind,
        name: file.name || (kind === "video" ? "סרטון" : "תמונה"),
        mime: file.type || (kind === "video" ? "video/mp4" : "image/jpeg"),
        previewUrl: URL.createObjectURL(file),
        file,
      });
    }
    if (added.length) {
      setError("");
      setDirtyMedia((current) => {
        const room = Math.max(0, 4 - current.length);
        if (added.length > room) setError("אפשר לצרף עד 4 קבצים");
        return [...current, ...added.slice(0, room)];
      });
    }
  }

  function mergeNewItems(next: Farm, previous: Farm | null): Farm {
    const extras = previous?.equipment.filter((item) => isNewEquipmentId(item.id)) ?? [];
    if (!extras.length) return next;
    return {
      ...next,
      equipment: [...next.equipment, ...extras],
      itemOrder: [...(next.itemOrder ?? next.equipment.map((item) => item.id)), ...extras.map((item) => item.id)],
    };
  }

  function loadFarm(resetDrafts: boolean) {
    return api<{ farm: Farm; demo: boolean }>(`/api/inventory?farm=${farmId}`).then((data) => {
      setFarm((previous) => (resetDrafts ? data.farm : mergeNewItems(data.farm, previous)));
      setDemo(data.demo);
      if (resetDrafts) {
        setActualDraft({});
        setMaxDraft({});
        setEditingMax(null);
        setNote("");
        setEditingReport(null);
        setWarn("");
        setFocusNew(null);
        clearDirtyMedia();
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
    void (async () => {
      const next: DirtyDraft[] = [];
      for (const item of report.dirtyMedia ?? []) {
        let previewUrl = "";
        const blob = await idbGet(item.id).catch(() => undefined);
        if (blob) previewUrl = URL.createObjectURL(blob);
        else if (item.url) previewUrl = item.url;
        if (!previewUrl) continue;
        next.push({
          id: item.id,
          kind: item.kind,
          name: item.name,
          mime: item.mime,
          previewUrl,
          url: item.url,
        });
      }
      clearDirtyMedia(next);
    })();
  }

  function fillFromSheet() {
    if (!farm) return;
    const next: Record<string, string> = {};
    for (const item of farm.equipment) {
      if (isNewEquipmentId(item.id)) continue;
      next[item.id] = String(item.actual);
    }
    setActualDraft((current) => ({ ...current, ...next }));
    setEditingReport(null);
    setMessage("מולא לפי המלאי שבגיליון. אפשר לערוך ולשמור.");
  }

  function addItem() {
    if (!farm) return;
    const id = `new:${crypto.randomUUID()}`;
    const item: EquipmentItem = { id, name: "", actual: 0, maxStock: 0, toComplete: 0 };
    setFarm({
      ...farm,
      equipment: [...farm.equipment, item],
      itemOrder: [...(farm.itemOrder ?? farm.equipment.map((row) => row.id)), id],
    });
    setMaxDraft((current) => ({ ...current, [id]: "" }));
    setActualDraft((current) => ({ ...current, [id]: "" }));
    setFocusNew(id);
    setWarn("");
    setMessage("");
  }

  function removeNewItem(id: string) {
    if (!farm) return;
    setFarm({
      ...farm,
      equipment: farm.equipment.filter((item) => item.id !== id),
      itemOrder: farm.itemOrder?.filter((itemId) => itemId !== id),
    });
    setActualDraft((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setMaxDraft((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    if (editingMax === id) setEditingMax(null);
    if (focusNew === id) setFocusNew(null);
  }

  function renameNewItem(id: string, name: string) {
    if (!farm) return;
    setFarm({
      ...farm,
      equipment: farm.equipment.map((item) => (item.id === id ? { ...item, name } : item)),
    });
  }

  async function reorder(ids: string[]) {
    if (!farm) return;
    const extraIds = farm.equipment.filter((item) => isNewEquipmentId(item.id)).map((item) => item.id);
    const orderedIds = [...ids, ...extraIds];
    setFarm({
      ...farm,
      equipment: orderedIds.map((id) => farm.equipment.find((item) => item.id === id)!).filter(Boolean),
      itemOrder: orderedIds,
    });
    try {
      const data = await api<{ farm: Farm; demo: boolean }>("/api/order", {
        method: "POST",
        body: JSON.stringify({ farmId, itemIds: ids }),
      });
      setFarm(mergeNewItems(data.farm, farm));
      setDemo(data.demo);
    } catch {
      setError("לא הצלחנו לשמור את הסדר");
    }
  }

  async function save() {
    if (!farm) return;
    setError("");
    const added = farm.equipment.filter((item) => isNewEquipmentId(item.id));
    if (added.some((item) => !item.name.trim())) {
      setError("כתבו שם לפריט החדש, או מחקו אותו");
      return;
    }
    const names = farm.equipment.map((item) => item.name.trim()).filter(Boolean);
    if (new Set(names).size !== names.length) {
      setError("יש שני פריטים עם אותו שם");
      return;
    }
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
        const isNew = isNewEquipmentId(item.id);
        const update: StockUpdate = { id: item.id, name: item.name.trim(), isNew: isNew || undefined };
        let changed = isNew;
        const actualRaw = actualDraft[item.id];
        if (actualRaw !== undefined && actualRaw !== "") {
          update.actual = Number(actualRaw);
          changed = true;
        } else if (isNew) {
          update.actual = 0;
        }
        const maxRaw = maxDraft[item.id];
        if (maxRaw !== undefined && maxRaw !== "") {
          const nextMax = Number(maxRaw);
          if (isNew || nextMax !== item.maxStock) {
            update.maxStock = nextMax;
            changed = true;
          }
        } else if (isNew) {
          update.maxStock = update.actual ?? 0;
        }
        if (changed) items.push(update);
      }
      const payloadMedia = [];
      for (const item of dirtyMedia) {
        const file = item.file;
        if (file) {
          const blob: Blob = item.kind === "image" ? await compressImage(file).catch(() => file) : file;
          if (blob.size > MAX_MEDIA_BYTES) {
            setError(item.kind === "video" ? "הסרטון גדול מדי. הקליטו קצר יותר או צרפו תמונה." : "התמונה גדולה מדי");
            setSaving(false);
            return;
          }
          await idbPut(item.id, blob).catch(() => undefined);
          payloadMedia.push({
            id: item.id,
            kind: item.kind,
            name: item.name,
            mime: item.kind === "image" ? "image/jpeg" : item.mime,
            data: await blobToBase64(blob),
          });
        } else if (item.url) {
          payloadMedia.push({
            id: item.id,
            kind: item.kind,
            name: item.name,
            mime: item.mime,
            url: item.url,
          });
        }
      }
      const data = await api<{ farm: Farm; demo: boolean }>("/api/report", {
        method: "POST",
        body: JSON.stringify({ farmId, user, note, items, dirtyMedia: payloadMedia }),
      });
      setFarm(data.farm);
      setDemo(data.demo);
      setActualDraft({});
      setMaxDraft({});
      setEditingMax(null);
      setFocusNew(null);
      setNote("");
      setEditingReport(null);
      clearDirtyMedia();
      const addedCount = items.filter((item) => item.isNew).length;
      setMessage(
        addedCount
          ? addedCount === 1
            ? "הפריט נוסף והדיווח נשמר"
            : `${addedCount} פריטים נוספו והדיווח נשמר`
          : items.length || note.trim() || payloadMedia.length
            ? payloadMedia.length
              ? "הדיווח נשמר עם תיעוד ציוד מלוכלך"
              : "הדיווח נשמר"
            : "אין כמויות לדיווח",
      );
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

  const existing = farm?.equipment.filter((item) => !isNewEquipmentId(item.id)) ?? [];
  const added = farm?.equipment.filter((item) => isNewEquipmentId(item.id)) ?? [];
  const ids = existing.map((item) => item.id);

  function existingRow(item: EquipmentItem, grip: ReactNode) {
    const maxValue = maxDraft[item.id] ?? String(item.maxStock);
    const editing = editingMax === item.id;
    return (
      <div className={ROW}>
        {grip}
        <span className="min-w-0 truncate text-[13px] font-medium leading-tight">{item.name}</span>
        <div className="flex items-center justify-center gap-0.5">
          {editing ? (
            <CompactQty
              label={`מקס של ${item.name}`}
              value={maxValue}
              onChange={(value) => setMaxDraft((current) => ({ ...current, [item.id]: value }))}
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
    );
  }

  const existingRows = existing.map((item) =>
    reorderMode ? (
      <SortableRow key={item.id} id={item.id}>
        {({ grip }) => existingRow(item, grip)}
      </SortableRow>
    ) : (
      <div key={item.id}>{existingRow(item, <span />)}</div>
    ),
  );

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
        <ChipButton active={reorderMode} onClick={() => setReorderMode((on) => !on)}>
          שינוי סדר
        </ChipButton>
        <ChipButton active={showHistory} onClick={() => setShowHistory((open) => !open)}>
          עריכת דיווח קודם
        </ChipButton>
        <ChipButton onClick={fillFromSheet}>מילוי לפי הגיליון</ChipButton>
        <ChipButton onClick={() => loadFarm(false).catch(() => setError("הרענון נכשל"))}>
          רענון מהגיליון
        </ChipButton>
      </div>
      {reorderMode && (
        <p className="text-[11px] text-[#3d6b4a]">מצב סידור פעיל — גררו את הפריטים. כבו כדי לגלול את הרשימה.</p>
      )}
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
                <span className="text-black/45">
                  {report.items.length} פריטים
                  {report.dirtyMedia?.length ? " · ציוד מלוכלך" : ""}
                </span>
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
        {reorderMode ? (
          <SortableList ids={ids} onReorder={reorder}>
            {existingRows}
          </SortableList>
        ) : (
          existingRows
        )}
        {added.map((item) => (
          <div key={item.id} className={ROW}>
            <button
              type="button"
              aria-label="מחיקת פריט חדש"
              onClick={() => removeNewItem(item.id)}
              className="flex size-6 shrink-0 items-center justify-center rounded-md text-[#9f1239]"
            >
              <X size={14} strokeWidth={2.4} />
            </button>
            <CompactName
              label="שם פריט חדש"
              value={item.name}
              autoFocus={focusNew === item.id}
              onChange={(value) => renameNewItem(item.id, value)}
            />
            <div className="flex items-center justify-center">
              <CompactQty
                label={`מקס של ${item.name || "פריט חדש"}`}
                value={maxDraft[item.id] ?? ""}
                onChange={(value) => setMaxDraft((current) => ({ ...current, [item.id]: value }))}
              />
            </div>
            <div className="flex justify-center">
              <CompactQty
                label={`מלאי קיים של ${item.name || "פריט חדש"}`}
                value={actualDraft[item.id] ?? ""}
                onChange={(value) => {
                  setWarn("");
                  setActualDraft((current) => ({ ...current, [item.id]: value }));
                }}
              />
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addItem}
          className="flex min-h-10 w-full items-center justify-center gap-1 border-t border-black/8 text-[13px] font-medium text-[#3d6b4a]"
        >
          <Plus size={16} strokeWidth={2.4} />
          הוספת פריט
        </button>
      </div>
      <NoteField value={note} onChange={setNote} label="הערה" />
      <DirtyMediaField
        items={dirtyMedia}
        onAdd={(files) => void addDirtyFiles(files)}
        onRemove={(id) =>
          setDirtyMedia((current) => {
            const item = current.find((row) => row.id === id);
            if (item?.previewUrl.startsWith("blob:")) URL.revokeObjectURL(item.previewUrl);
            return current.filter((row) => row.id !== id);
          })
        }
      />
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
