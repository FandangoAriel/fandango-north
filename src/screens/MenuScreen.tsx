import { FARM_SHEETS, type FarmId } from "../../shared/types";
import { PrimaryButton, Screen, SecondaryButton } from "../ui";

export function MenuScreen({
  farmId,
  user,
  onReport,
  onLoad,
  onBack,
}: {
  farmId: FarmId;
  user: string;
  onReport: () => void;
  onLoad: () => void;
  onBack: () => void;
}) {
  return (
    <Screen
      title={FARM_SHEETS[farmId].name}
      subtitle={`${user} · מה עושים עכשיו?`}
      onBack={onBack}
    >
      <PrimaryButton onClick={onReport}>דיווח מלאי קיים</PrimaryButton>
      <SecondaryButton onClick={onLoad}>העמסה מהמחסן המרכזי</SecondaryButton>
    </Screen>
  );
}
