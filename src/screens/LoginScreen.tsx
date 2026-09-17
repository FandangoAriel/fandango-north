import { useEffect, useState, type FormEvent } from "react";
import { api, USER_KEY } from "../api";
import { PrimaryButton, Screen } from "../ui";

export function LoginScreen({ onPick }: { onPick: (name: string) => void }) {
  const [name, setName] = useState("");
  const [demo, setDemo] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(USER_KEY)?.trim();
    if (saved) {
      onPick(saved);
      api("/api/users", { method: "POST", body: JSON.stringify({ name: saved }) }).catch(() => undefined);
      return;
    }
    api<{ demo: boolean }>("/api/users")
      .then((data) => setDemo(data.demo))
      .catch(() => setDemo(true));
  }, [onPick]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next = name.trim();
    if (!next) {
      setError("כתבו שם כדי להיכנס");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api("/api/users", { method: "POST", body: JSON.stringify({ name: next }) });
    } catch {
      // still enter locally
    }
    localStorage.setItem(USER_KEY, next);
    onPick(next);
  }

  return (
    <Screen title="כניסה" subtitle="כתבו את השם שלכם. בפעם הבאה ניכנס אוטומטית." demo={demo} brand>
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      <form className="grid gap-2" onSubmit={(event) => void submit(event)}>
        <label className="grid gap-1">
          <span className="text-[11px] text-black/50">שם</span>
          <input
            autoFocus
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="למשל אריאל"
            className="min-h-11 w-full rounded-xl border border-black/15 bg-white px-3 text-[15px]"
          />
        </label>
        <PrimaryButton type="submit" disabled={saving}>
          {saving ? "נכנס…" : "כניסה"}
        </PrimaryButton>
      </form>
    </Screen>
  );
}
