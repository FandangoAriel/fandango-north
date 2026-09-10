import { useEffect, useState } from "react";
import { api, USER_KEY } from "../api";
import { PrimaryButton, Screen } from "../ui";

export function LoginScreen({ onPick }: { onPick: (name: string) => void }) {
  const [users, setUsers] = useState<string[]>([]);
  const [demo, setDemo] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ users: string[]; demo: boolean }>("/api/users")
      .then((data) => {
        setUsers(data.users);
        setDemo(data.demo);
        const saved = localStorage.getItem(USER_KEY);
        if (saved && data.users.includes(saved)) onPick(saved);
      })
      .catch(() => setError("לא הצלחנו לטעון את רשימת העובדים"))
      .finally(() => setLoading(false));
  }, [onPick]);

  if (loading) {
    return (
      <Screen title="כניסה">
        <p className="text-black/60">טוען עובדים…</p>
      </Screen>
    );
  }

  return (
    <Screen title="מי נכנס?" subtitle="בחרו את השם שלכם. עד 10 עובדים בצוות." demo={demo}>
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      {users.length === 0 && <p className="text-black/60">אין משתמשים ברשימה.</p>}
      <div className="grid gap-2">
        {users.map((name) => (
          <PrimaryButton
            key={name}
            onClick={() => {
              localStorage.setItem(USER_KEY, name);
              onPick(name);
            }}
          >
            {name}
          </PrimaryButton>
        ))}
      </div>
    </Screen>
  );
}
