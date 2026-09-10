import { FARM_SHEETS, type FarmId } from "../../shared/types";
import { PrimaryButton, Screen, SecondaryButton } from "../ui";

const FARMS = Object.entries(FARM_SHEETS) as [FarmId, { name: string }][];

export function FarmPickScreen({
  user,
  onPick,
  onLogout,
}: {
  user: string;
  onPick: (farmId: FarmId) => void;
  onLogout: () => void;
}) {
  return (
    <Screen title={`שלום ${user}`} subtitle="לאיזו חווה נכנסים?">
      <div className="grid gap-2">
        {FARMS.map(([id, farm]) => (
          <PrimaryButton key={id} onClick={() => onPick(id)}>
            {farm.name}
          </PrimaryButton>
        ))}
      </div>
      <SecondaryButton onClick={onLogout}>החלפת עובד</SecondaryButton>
    </Screen>
  );
}
