import { useState } from "react";
import type { DirtyMedia, Farm, FarmId, LoadItem } from "../../shared/types";
import { FARM_SHEETS, mergeSubsetOrder, nextLoadMark } from "../../shared/types";
import { loadShareMessage, showLoadSaveOnly, whatsAppUrl } from "../../shared/summary";
import { api } from "../api";
import { blobToBase64, compressImage, kindFromMime, MAX_MEDIA_BYTES, MAX_VIDEO_BYTES } from "../dirtyMedia";
import {
  ChipButton,
  CompactQty,
  DirtyMediaField,
  DirtyMediaGallery,
  NoteField,
  PrimaryButton,
  SaveWarning,
  Screen,
  TriMark,
  WhatsAppButton,
} from "../ui";
import { SortableList, SortableRow } from "../sortable";
import { useEnterRefresh } from "../useEnterRefresh";

type ShareDraft = {
  id: string;
  kind: "image" | "video";
  name: string;
  mime: string;
  previewUrl: string;
  file: File;
  url?: string;
  uploading?: boolean;
};

function itemTitle(item: LoadItem) {
  if (item.kind === "note") {
    return (
      <span className="block min-w-0">
        <span className="block whitespace-normal">{item.name}</span>
        {item.detail ? <span className="block text-[11px] font-normal text-black/45">{item.detail}</span> : null}
      </span>
    );
  }
  if (item.kind === "container" && item.detail && item.detail !== item.name) {
    return (
      <span className="block min-w-0">
        <span className="block truncate">{item.name}</span>
        <span className="block truncate text-[12px] font-normal text-black/55">{item.detail}</span>
      </span>
    );
  }
  return <span className="block truncate">{item.name}</span>;
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
          <span className="min-w-0 flex-1 text-[13px] leading-tight">{itemTitle(item)}</span>
          {cluster}
        </div>
      );
    }
    return (
      <SortableRow key={item.itemId} id={item.itemId}>
        {({ grip }) => (
          <div className="flex items-center gap-1.5 border-b border-black/8 px-2 py-0.5 last:border-b-0">
            {grip}
            <span className="min-w-0 flex-1 text-[13px] leading-tight">{itemTitle(item)}</span>
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
  const [shareMedia, setShareMedia] = useState<ShareDraft[]>([]);
  const [shareAfter, setShareAfter] = useState(false);
  const [savingShare, setSavingShare] = useState(false);

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
  const notes = items.filter((item) => item.kind === "note");
  const containers = items.filter((item) => item.kind === "container");
  const stock = items.filter((item) => item.kind === "stock");
  const mediaBusy = shareMedia.some((item) => item.uploading);
  const mediaReady = shareMedia.every((item) => item.url);
  const saveOnly = showLoadSaveOnly(note, shareMedia.length);

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
    const notes = items.filter((item) => item.kind === "note");
    setItems([...notes, ...containers, ...nextStock]);
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

  function dropShare(id: string) {
    setShareMedia((current) => {
      const item = current.find((row) => row.id === id);
      if (item?.previewUrl.startsWith("blob:")) URL.revokeObjectURL(item.previewUrl);
      return current.filter((row) => row.id !== id);
    });
  }

  async function addShareFiles(files: File[]) {
    const added: ShareDraft[] = [];
    for (const file of files) {
      if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
        setError("אפשר לצרף רק תמונה או סרטון");
        continue;
      }
      if (file.type.startsWith("video/") && file.size > MAX_VIDEO_BYTES) {
        setError("הסרטון גדול מדי. הקליטו סרטון קצר יותר או צרפו תמונה.");
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
        uploading: true,
      });
    }
    if (!added.length) return;
    const room = Math.max(0, 4 - shareMedia.length);
    const accepted = added.slice(0, room);
    for (const item of added.slice(room)) URL.revokeObjectURL(item.previewUrl);
    if (!accepted.length) {
      setError("אפשר לצרף עד 4 קבצים");
      return;
    }
    setError(added.length > room ? "אפשר לצרף עד 4 קבצים" : "");
    setShareMedia((current) => [...current, ...accepted]);
    try {
      const payload = [];
      for (const item of accepted) {
        const blob: Blob = item.kind === "image" ? await compressImage(item.file).catch(() => item.file) : item.file;
        const limit = item.kind === "video" ? MAX_VIDEO_BYTES : MAX_MEDIA_BYTES;
        if (blob.size > limit) {
          throw new Error(item.kind === "video" ? "הסרטון גדול מדי. הקליטו סרטון קצר יותר או צרפו תמונה." : "התמונה גדולה מדי");
        }
        payload.push({
          id: item.id,
          kind: item.kind,
          name: item.name,
          mime: item.kind === "image" ? "image/jpeg" : item.mime,
          data: await blobToBase64(blob),
        });
      }
      const data = await api<{ items: DirtyMedia[] }>("/api/upload-media", {
        method: "POST",
        body: JSON.stringify({ items: payload }),
      });
      const byId = new Map(data.items.map((item) => [item.id, item.url]));
      setShareMedia((current) =>
        current.flatMap((item) => {
          if (!accepted.some((row) => row.id === item.id)) return [item];
          const url = byId.get(item.id);
          if (!url) return [];
          return [{ ...item, url, uploading: false }];
        }),
      );
      for (const item of accepted) {
        if (!byId.get(item.id) && item.previewUrl.startsWith("blob:")) URL.revokeObjectURL(item.previewUrl);
      }
      if (accepted.some((item) => !byId.get(item.id))) {
        setError("לא הצלחנו לשמור את הקובץ. נסו סרטון קצר יותר או תמונה.");
      }
    } catch (error) {
      const failed = new Set(accepted.map((item) => item.id));
      setShareMedia((current) => current.filter((item) => !failed.has(item.id)));
      for (const item of accepted) {
        if (item.previewUrl.startsWith("blob:")) URL.revokeObjectURL(item.previewUrl);
      }
      const message = error instanceof Error ? error.message : "";
      setError(message && message !== "request_failed" ? message : "ההעלאה נכשלה");
    }
  }

  function openWhatsApp(text: string, files: File[]) {
    if (files.length > 0 && typeof navigator.share === "function" && navigator.canShare?.({ files })) {
      void navigator.share({ text, files }).catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        window.open(whatsAppUrl(text), "_blank", "noopener,noreferrer");
      });
      return;
    }
    window.open(whatsAppUrl(text), "_blank", "noopener,noreferrer");
  }

  async function commit(share: boolean) {
    setSaving(true);
    setSavingShare(share);
    setMessage("");
    setError("");
    setWarn("");
    const attached = shareMedia.filter((item) => item.url);
    const message = loadShareMessage({
      farmName: FARM_SHEETS[farmId].name,
      user,
      items,
      note,
      byLoader,
      dirtyMedia,
      shareMedia: attached.map((item) => ({
        kind: item.kind,
        name: item.name,
        url: item.url || "",
      })),
      origin: window.location.origin,
    });
    if (share) openWhatsApp(message.text, attached.map((item) => item.file));
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
      setMessage(share ? "ההעמסה נשמרה ונפתחה השליחה בוואטסאפ." : "ההעמסה נשמרה.");
    } catch {
      setError("השמירה נכשלה");
    } finally {
      setSaving(false);
      setSavingShare(false);
    }
  }

  function requestSave(share: boolean) {
    if (share && (mediaBusy || !mediaReady)) return;
    const missing = items.filter((item) => item.mark === "unset");
    if (missing.length && !warn) {
      setShareAfter(share);
      setWarn(`לא סומנו ${missing.length} פריטים. לשמור בכל זאת?`);
      return;
    }
    void commit(share);
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
          {notes.length > 0 && (
            <section>
              <h2 className="mb-0.5 text-[11px] font-semibold text-[#3d6b4a]">הערה מהדיווח</h2>
              <p className="mb-1 text-[11px] text-black/45">לסמן אחרי הטיפול. הפריט מופיע פעם אחת.</p>
              <LoadRows items={notes} onCycle={cycle} onHaveQty={setHaveQty} />
            </section>
          )}
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
          <DirtyMediaField
            title="תמונה או סרטון"
            hint="המעמיס מצלם או בוחר מהגלריה. זה נשלח בוואטסאפ יחד עם הרשימה וההערה."
            items={shareMedia}
            onAdd={(files) => void addShareFiles(files)}
            onRemove={dropShare}
          />
          {mediaBusy && <p className="text-[12px] text-black/55">מעלה את התמונה או הסרטון…</p>}
          <NoteField
            value={note}
            onChange={setNote}
            label="הערה"
            checkbox={{ label: "ע״י המעמיס", checked: byLoader, onChange: setByLoader }}
          />
          {warn && (
            <SaveWarning
              text={warn}
              confirmLabel={shareAfter ? "לשמור ולשלוח בכל זאת" : "לשמור בכל זאת"}
              onCancel={() => {
                setWarn("");
                setShareAfter(false);
              }}
              onConfirm={() => void commit(shareAfter)}
            />
          )}
          <div className="sticky bottom-0 z-20 space-y-2 bg-[#f4efe4] pt-2 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
            {saveOnly && (
              <PrimaryButton onClick={() => requestSave(false)} disabled={saving || mediaBusy}>
                {saving && !savingShare ? "שומר…" : "שמירה"}
              </PrimaryButton>
            )}
            <WhatsAppButton
              label={saving && savingShare ? "שומר…" : mediaBusy ? "מעלה…" : "שמירה ושליחה בוואטסאפ"}
              disabled={saving || mediaBusy || !mediaReady}
              onClick={() => requestSave(true)}
            />
            {saved ? null : (
              <p className="text-center text-[11px] text-black/45">
                השליחה כוללת את הרשימה המלאה, ההערה, וקישור לתמונה או לסרטון
              </p>
            )}
          </div>
        </>
      )}
    </Screen>
  );
}
