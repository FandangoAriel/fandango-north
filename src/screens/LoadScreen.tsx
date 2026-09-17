import { useState } from "react";
import type { DirtyMedia, Farm, FarmId, LoadItem } from "../../shared/types";
import { FARM_SHEETS, mergeSubsetOrder, nextLoadMark } from "../../shared/types";
import { loadWhatsAppText, whatsAppUrl } from "../../shared/summary";
import { api } from "../api";
import {
  ChipButton,
  CompactQty,
  ConfirmBar,
  DirtyMediaGallery,
  NoteField,
  PrimaryButton,
  Screen,
  TriMark,
  WhatsAppButton,
} from "../ui";
import { SortableList, SortableRow } from "../sortable";
import { useEnterRefresh } from "../useEnterRefresh";

function itemTitle(item: LoadItem) {
  if (item.kind !== "container" || !item.detail || item.detail === item.name) {
    return item.name;
  }
  return (
    <>
      {item.name}{" "}
      <span className="text-[13px] text-black/55">{item.detail}</span>
    </>
  );
}

function LoadRows({
  items,
  onCycle,
  onHaveQty,
  onReorder,
}: {
  items: LoadItem[];
  onCycle: (id: string) => void;
  onHaveQty: (id: string, value: string) => void;
  onReorder?: (ids: string[]) => void;
}) {
  const body = items.map((item) => {
    const cluster = (
      <div className="flex shrink-0 items-center gap-1">
        {item.mark === "partial" && (
          <CompactQty
            label={`כמות שיש מ${item.name}`}
            value={item.haveQty == null ? "" : String(item.haveQty)}
            placeholder="יש"
            onChange={(value) => onHaveQty(item.itemId, value)}
          />
        )}
        {item.kind === "stock" && (
          <span className="min-w-5 text-center text-[13px] font-semibold tabular-nums text-[#b45309]">
            {item.toSupply}
          </span>
        )}
        <TriMark mark={item.mark} onCycle={() => onCycle(item.itemId)} label={item.name} />
      </div>
    );
    if (!onReorder) {
      return (
        <div
          key={item.itemId}
          className="flex items-center gap-1.5 border-b border-black/8 px-2 py-0.5 last:border-b-0"
        >
          <span className="min-w-0 flex-1 truncate text-[13px] leading-tight">{itemTitle(item)}</span>
          {cluster}
        </div>
      );
    }
    return (
      <SortableRow key={item.itemId} id={item.itemId}>
        {({ grip }) => (
          <div className="flex items-center gap-1.5 border-b border-black/8 px-2 py-0.5 last:border-b-0">
            {grip}
            <span className="min-w-0 flex-1 truncate text-[13px] leading-tight">{itemTitle(item)}</span>
            {cluster}
          </div>
        )}
      </SortableRow>
    );
  });
  const list = <div className="overflow-hidden rounded-lg bg-white">{body}</div>;
  if (!onReorder) return list;
  return (
    <SortableList ids={items.map((item) => item.itemId)} onReorder={onReorder}>
      {list}
    </SortableList>
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
  const [equipmentIds, setEquipmentIds] = useState<string[]>([]);
  const [dirtyMedia, setDirtyMedia] = useState<DirtyMedia[]>([]);
  const [demo, setDemo] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [byLoader, setByLoader] = useState(false);
  const [warn, setWarn] = useState("");
  const [saved, setSaved] = useState(false);

  function loadList(keepMarks = false) {
    return api<{ items: LoadItem[]; equipmentIds?: string[]; dirtyMedia?: DirtyMedia[]; demo: boolean }>(
      `/api/load?farm=${farmId}`,
    ).then((data) => {
        setItems((current) => {
          const prev = new Map(current.map((item) => [item.itemId, item]));
          return data.items.map((item) => {
            const old = keepMarks ? prev.get(item.itemId) : undefined;
            return {
              ...item,
              mark: old?.mark ?? item.mark ?? "unset",
              haveQty: old?.haveQty ?? item.haveQty ?? null,
            };
          });
        });
        setEquipmentIds(
          data.equipmentIds ?? data.items.filter((item) => item.kind === "stock").map((item) => item.itemId),
        );
        setDirtyMedia(data.dirtyMedia ?? []);
        setDemo(data.demo);
      },
    );
  }

  useEnterRefresh(
    () =>
      loadList(false)
        .catch(() => setError("לא הצלחנו לטעון את רשימת ההעמסה"))
        .finally(() => setLoading(false)),
    [farmId],
    () => loadList(true).catch(() => setError("לא הצלחנו לטעון את רשימת ההעמסה")),
  );

  const markedCount = items.filter((item) => item.mark !== "unset").length;
  const containers = items.filter((item) => item.kind === "container");
  const stock = items.filter((item) => item.kind === "stock");
  const waHref = whatsAppUrl(loadWhatsAppText(FARM_SHEETS[farmId].name, user, items, note, byLoader, dirtyMedia));

  function cycle(id: string) {
    setWarn("");
    setSaved(false);
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

  async function reorderStock(ids: string[]) {
    const byId = new Map(items.map((item) => [item.itemId, item]));
    const nextStock = ids.map((id) => byId.get(id)).filter((item): item is LoadItem => Boolean(item));
    setItems([...containers, ...nextStock]);
    const merged = mergeSubsetOrder(equipmentIds.length ? equipmentIds : ids, ids);
    setEquipmentIds(merged);
    try {
      const data = await api<{ farm: Farm }>("/api/order", {
        method: "POST",
        body: JSON.stringify({ farmId, itemIds: merged }),
      });
      setEquipmentIds(data.farm.equipment.map((item) => item.id));
    } catch {
      setError("לא הצלחנו לשמור את הסדר");
    }
  }

  async function save() {
    const missing = items.filter((item) => item.mark === "unset");
    if (missing.length && !warn) {
      setWarn(`לא סומנו ${missing.length} פריטים. לשמור בכל זאת?`);
      return;
    }
    setSaving(true);
    setMessage("");
    setError("");
    setWarn("");
    try {
      await api("/api/load", {
        method: "POST",
        body: JSON.stringify({
          farmId,
          user,
          note,
          byLoader,
          items: items.map((item) => ({
            itemId: item.itemId,
            mark: item.mark,
            haveQty: item.haveQty ?? null,
          })),
        }),
      });
      setSaved(true);
      setMessage("ההעמסה נשמרה. אפשר לשלוח סיכום בוואטסאפ.");
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
      <div className="flex items-center justify-between gap-2 text-[12px] text-black/60">
        <span>
          {items.length ? `סומנו ${markedCount} מתוך ${items.length}` : "אין פריטים להעמסה"}
        </span>
        <ChipButton onClick={() => loadList(true).catch(() => setError("הרענון נכשל"))}>
          רענון מהגיליון
        </ChipButton>
      </div>
      <DirtyMediaGallery items={dirtyMedia} />
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-black/15 bg-white px-3 py-6 text-center">
          <p className="text-sm font-medium">אין מה להעמיס לחווה זו</p>
          <p className="mt-0.5 text-[12px] text-black/55">אין מיכלים ממתינים ואין חוסר במלאי.</p>
        </div>
      ) : (
        <>
          {containers.length > 0 && (
            <section>
              <h2 className="mb-0.5 text-[11px] font-semibold text-[#3d6b4a]">מיכלים משולטים</h2>
              <LoadRows items={containers} onCycle={cycle} onHaveQty={setHaveQty} />
            </section>
          )}
          {stock.length > 0 && (
            <section>
              <h2 className="mb-0.5 text-[11px] font-semibold text-[#3d6b4a]">ציוד להשלמה</h2>
              <LoadRows items={stock} onCycle={cycle} onHaveQty={setHaveQty} onReorder={reorderStock} />
            </section>
          )}
          <NoteField
            value={note}
            onChange={setNote}
            label="הערה"
            checkbox={{ label: "ע״י המעמיס", checked: byLoader, onChange: setByLoader }}
          />
          {warn && (
            <ConfirmBar text={warn} onCancel={() => setWarn("")} onConfirm={() => void save()} />
          )}
          <div className="sticky bottom-0 space-y-2 bg-[#f4efe4] pt-2 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
            <PrimaryButton onClick={() => void save()} disabled={saving}>
              {saving ? "שומר…" : "שמירת העמסה"}
            </PrimaryButton>
            <WhatsAppButton href={waHref} />
            {saved ? null : (
              <p className="text-center text-[11px] text-black/45">הסיכום כולל כמה היה צריך וכמה הועמס</p>
            )}
          </div>
        </>
      )}
    </Screen>
  );
}
