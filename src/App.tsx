import { useCallback, useState } from "react";
import type { FarmId } from "../shared/types";
import { USER_KEY } from "./api";
import { FarmPickScreen } from "./screens/FarmPickScreen";
import { LoadScreen } from "./screens/LoadScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { MenuScreen } from "./screens/MenuScreen";
import { ReportScreen } from "./screens/ReportScreen";

type Step = "login" | "farm" | "menu" | "report" | "load";

export function App() {
  const [step, setStep] = useState<Step>("login");
  const [user, setUser] = useState("");
  const [farmId, setFarmId] = useState<FarmId | null>(null);

  const pickUser = useCallback((name: string) => {
    setUser(name);
    setStep("farm");
  }, []);

  if (step === "login") return <LoginScreen onPick={pickUser} />;
  if (step === "farm") {
    return (
      <FarmPickScreen
        user={user}
        onPick={(id) => {
          setFarmId(id);
          setStep("menu");
        }}
        onLogout={() => {
          localStorage.removeItem(USER_KEY);
          setUser("");
          setFarmId(null);
          setStep("login");
        }}
      />
    );
  }
  if (!farmId) return null;
  if (step === "menu") {
    return (
      <MenuScreen
        farmId={farmId}
        user={user}
        onReport={() => setStep("report")}
        onLoad={() => setStep("load")}
        onBack={() => setStep("farm")}
      />
    );
  }
  if (step === "report") {
    return <ReportScreen farmId={farmId} user={user} onBack={() => setStep("menu")} />;
  }
  return <LoadScreen farmId={farmId} user={user} onBack={() => setStep("menu")} />;
}
