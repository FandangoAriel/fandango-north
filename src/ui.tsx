import type { ReactNode } from "react";
import type { LoadMark } from "../shared/types";

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
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col overflow-x-hidden overscroll-y-contain px-3 pb-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <header className="mb-2">
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
      <main className="flex flex-1 flex-col gap-2">{children}</main>
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
