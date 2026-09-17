import { useState, type ReactNode } from "react";
import { Camera, Video, X } from "lucide-react";
import type { LoadMark, DirtyMedia } from "../shared/types";
import { mediaPreviewUrl } from "../shared/types";

export function Screen({
  title,
  subtitle,
  onBack,
  children,
  demo,
  brand,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  children: ReactNode;
  demo?: boolean;
  brand?: boolean;
}) {
  return (
    <div className="mx-auto flex h-full w-full max-w-md flex-col overflow-hidden px-3 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <header className="mb-2 shrink-0">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="mb-1 min-h-8 text-xs font-medium text-[#3d6b4a]"
          >
            חזרה
          </button>
        )}
        {brand && (
          <img
            src="/icon-192.png"
            alt="פאנדנגו"
            width={72}
            height={72}
            className="mb-2 h-[72px] w-[72px] rounded-[1.15rem] shadow-sm"
          />
        )}
        <h1 className="text-lg font-bold leading-tight">{title}</h1>
        {subtitle && <p className="text-[12px] leading-snug text-black/60">{subtitle}</p>}
        {demo && (
          <p className="mt-1 rounded-md bg-[#efe4c8] px-2 py-1 text-[11px] text-[#7a5b12]">
            מצב דמו — נשמר כאן, לא בגיליון החי
          </p>
        )}
      </header>
      <main className="flex min-h-0 flex-1 flex-col gap-2 overflow-x-hidden overflow-y-auto overscroll-y-contain pb-4 touch-pan-y [&>*]:shrink-0 [-webkit-overflow-scrolling:touch]">
        {children}
      </main>
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="min-h-11 w-full rounded-xl bg-[#3d6b4a] px-4 text-[15px] font-semibold text-white disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function ChipButton({
  children,
  onClick,
  active,
}: {
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-8 rounded-lg border px-2.5 text-[12px] font-medium ${
        active
          ? "border-[#3d6b4a] bg-[#3d6b4a] text-white"
          : "border-[#3d6b4a] bg-white text-[#3d6b4a]"
      }`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-11 w-full rounded-xl border border-black/10 bg-white px-4 text-[15px] font-semibold"
    >
      {children}
    </button>
  );
}

export function CompactQty({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  label: string;
  placeholder?: string;
}) {
  return (
    <input
      aria-label={label}
      inputMode="numeric"
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value.replace(/[^\d]/g, ""))}
      className="h-7 w-11 shrink-0 rounded-md border border-black/15 bg-white text-center text-[13px] tabular-nums"
    />
  );
}

export function CompactName({
  value,
  onChange,
  label,
  autoFocus,
}: {
  value: string;
  onChange: (next: string) => void;
  label: string;
  autoFocus?: boolean;
}) {
  return (
    <input
      aria-label={label}
      value={value}
      autoFocus={autoFocus}
      placeholder="שם הפריט"
      onChange={(event) => onChange(event.target.value)}
      className="h-7 min-w-0 w-full rounded-md border border-black/15 bg-white px-1.5 text-[13px] leading-tight"
    />
  );
}

export function ConfirmBar({
  text,
  onCancel,
  onConfirm,
  confirmLabel = "לשמור בכל זאת",
}: {
  text: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
}) {
  return (
    <div className="rounded-lg border border-[#b45309]/30 bg-[#fff7ed] px-2 py-2 text-[12px] text-[#9a3412]">
      <p>{text}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-9 rounded-lg border border-black/10 bg-white text-[13px] font-medium"
        >
          חזרה למילוי
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="min-h-9 rounded-lg bg-[#b45309] text-[13px] font-medium text-white"
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}

export function WhatsAppButton({ href, disabled }: { href: string; disabled?: boolean }) {
  return (
    <a
      href={disabled ? undefined : href}
      target="_blank"
      rel="noreferrer"
      aria-disabled={disabled}
      className={`flex min-h-11 w-full items-center justify-center rounded-xl border border-[#1f6b4a] bg-white px-4 text-[15px] font-semibold text-[#1f6b4a] ${disabled ? "pointer-events-none opacity-50" : ""}`}
    >
      שליחה בוואטסאפ
    </a>
  );
}
export function NoteField({
  value,
  onChange,
  label,
  checkbox,
}: {
  value: string;
  onChange: (next: string) => void;
  label: string;
  checkbox?: { label: string; checked: boolean; onChange: (next: boolean) => void };
}) {
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between gap-2">
        <span className="text-[11px] text-black/50">{label}</span>
        {checkbox && (
          <label className="flex items-center gap-1.5 text-[12px] font-medium text-[#243328]">
            <input
              type="checkbox"
              checked={checkbox.checked}
              onChange={(event) => checkbox.onChange(event.target.checked)}
              className="size-4 accent-[#3d6b4a]"
            />
            {checkbox.label}
          </label>
        )}
      </div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={2}
        className="w-full resize-y rounded-lg border border-black/15 bg-white px-2 py-1.5 text-[13px] leading-snug"
      />
    </div>
  );
}

export type DirtyMediaDraft = {
  id: string;
  kind: "image" | "video";
  name: string;
  previewUrl: string;
};

export function DirtyMediaField({
  items,
  onAdd,
  onRemove,
}: {
  items: DirtyMediaDraft[];
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
}) {
  function pick(kind: "image" | "video", files: FileList | null) {
    if (!files?.length) return;
    onAdd([...files]);
    const input = document.getElementById(kind === "image" ? "dirty-photo" : "dirty-video") as HTMLInputElement | null;
    if (input) input.value = "";
  }

  return (
    <div>
      <span className="text-[11px] text-black/50">ציוד מלוכלך</span>
      <p className="mb-1 text-[11px] text-black/45">צלמו או צרפו תמונה או סרטון אחרי ההערה.</p>
      <div className="flex flex-wrap gap-2">
        <label className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-lg border border-[#3d6b4a] bg-white px-2.5 text-[12px] font-medium text-[#3d6b4a]">
          <Camera size={14} strokeWidth={2.2} />
          תמונה
          <input
            id="dirty-photo"
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => pick("image", event.target.files)}
          />
        </label>
        <label className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-lg border border-[#3d6b4a] bg-white px-2.5 text-[12px] font-medium text-[#3d6b4a]">
          <Video size={14} strokeWidth={2.2} />
          סרטון
          <input
            id="dirty-video"
            type="file"
            accept="video/*"
            className="sr-only"
            onChange={(event) => pick("video", event.target.files)}
          />
        </label>
      </div>
      {items.length > 0 && (
        <div className="mt-2 grid gap-2">
          {items.map((item) => (
            <div key={item.id} className="relative overflow-hidden rounded-lg bg-white">
              {item.kind === "video" ? (
                <video src={item.previewUrl} controls className="max-h-48 w-full bg-black" />
              ) : (
                <img src={item.previewUrl} alt={item.name} className="max-h-48 w-full object-cover" />
              )}
              <button
                type="button"
                aria-label={`הסרת ${item.name}`}
                onClick={() => onRemove(item.id)}
                className="absolute start-1 top-1 flex size-7 items-center justify-center rounded-md bg-black/55 text-white"
              >
                <X size={14} strokeWidth={2.4} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatMediaWhen(iso?: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DirtyMediaGallery({ items }: { items: DirtyMedia[] }) {
  if (!items.length) return null;
  return (
    <section>
      <h2 className="mb-0.5 text-[11px] font-semibold text-[#3d6b4a]">ציוד מלוכלך מהדיווח</h2>
      <p className="mb-1 text-[11px] text-black/45">מה שצילם המדווח — כדי שהמעמיס יראה לפני היציאה.</p>
      <div className="grid gap-2">
        {items.map((item) => (
          <DirtyMediaFigure key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}

function DirtyMediaFigure({ item }: { item: DirtyMedia }) {
  const [broken, setBroken] = useState(false);
  const src = mediaPreviewUrl(item);
  const openUrl = item.url.startsWith("http") ? item.url : src;
  const caption = [item.user, formatMediaWhen(item.at)].filter(Boolean).join(" · ");
  return (
    <figure className="overflow-hidden rounded-lg bg-white">
      {broken ? (
        <a
          href={openUrl}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-24 items-center justify-center px-3 py-6 text-center text-[13px] font-medium text-[#3d6b4a]"
        >
          פתיחת {item.kind === "video" ? "הסרטון" : "התמונה"}
        </a>
      ) : item.kind === "video" ? (
        <video src={src} controls className="max-h-48 w-full bg-black" onError={() => setBroken(true)} />
      ) : (
        <a href={openUrl} target="_blank" rel="noreferrer">
          <img src={src} alt={item.name} className="max-h-48 w-full object-cover" onError={() => setBroken(true)} />
        </a>
      )}
      <figcaption className="flex items-center justify-between gap-2 px-2 py-1 text-[11px] text-black/55">
        <span>{caption}</span>
        <a href={openUrl} target="_blank" rel="noreferrer" className="shrink-0 text-[#3d6b4a]">
          פתיחה
        </a>
      </figcaption>
    </figure>
  );
}

const MARK_LABEL: Record<LoadMark, string> = {
  unset: "לא סומן",
  full: "הועמס במלואו",
  partial: "כמות חלקית",
  none: "אין",
};

export function TriMark({
  mark,
  onCycle,
  label,
}: {
  mark: LoadMark;
  onCycle: () => void;
  label: string;
}) {
  const look =
    mark === "full"
      ? "border-[#3d6b4a] bg-[#3d6b4a] text-white"
      : mark === "partial"
        ? "border-[#b45309] bg-[#b45309] text-white"
        : mark === "none"
          ? "border-[#9f1239] bg-[#9f1239] text-white"
          : "border-black/35 bg-white text-black/0";
  const glyph = mark === "full" ? "V" : mark === "partial" ? "/" : mark === "none" ? "X" : "";
  return (
    <button
      type="button"
      aria-label={`${label}: ${MARK_LABEL[mark]}`}
      onClick={onCycle}
      className={`flex size-6 shrink-0 items-center justify-center rounded-[5px] border text-[12px] font-bold leading-none ${look}`}
    >
      {glyph}
    </button>
  );
}
