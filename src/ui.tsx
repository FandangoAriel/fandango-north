import type { ReactNode } from "react";

export function Screen({
  title,
  subtitle,
  onBack,
  children,
  demo,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  children: ReactNode;
  demo?: boolean;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="mb-5">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="mb-3 min-h-11 text-sm font-medium text-[#3d6b4a]"
          >
            חזרה
          </button>
        )}
        <p className="text-xs font-medium tracking-wide text-[#3d6b4a]">פאנדנגו צפון</p>
        <h1 className="mt-1 text-2xl font-bold leading-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-black/60">{subtitle}</p>}
        {demo && (
          <p className="mt-3 rounded-xl bg-[#efe4c8] px-3 py-2 text-sm text-[#7a5b12]">
            מצב דמו — השינויים נשמרים כאן, לא בגיליון החי
          </p>
        )}
      </header>
      <main className="flex flex-1 flex-col gap-3">{children}</main>
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
      className="min-h-12 w-full rounded-2xl bg-[#3d6b4a] px-4 text-base font-semibold text-white disabled:opacity-50"
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
      className="min-h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-base font-semibold"
    >
      {children}
    </button>
  );
}

export function Qty({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (next: number) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2" dir="ltr">
      <button
        type="button"
        aria-label={`הפחת ${label}`}
        onClick={() => onChange(Math.max(0, value - 1))}
        className="flex size-11 items-center justify-center rounded-xl border border-black/10 bg-white text-xl"
      >
        −
      </button>
      <input
        aria-label={label}
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))}
        className="h-11 w-16 rounded-xl border border-black/10 bg-white text-center text-lg tabular-nums"
      />
      <button
        type="button"
        aria-label={`הוסף ${label}`}
        onClick={() => onChange(value + 1)}
        className="flex size-11 items-center justify-center rounded-xl border border-black/10 bg-white text-xl"
      >
        +
      </button>
    </div>
  );
}
