import { parseLoadShare } from "../../shared/summary";
import { Screen } from "../ui";

function whenLabel(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("he-IL");
}

export function ShareLoadScreen() {
  const snapshot = parseLoadShare(window.location.hash);
  if (!snapshot) {
    return (
      <Screen title="העמסה">
        <p className="rounded-lg bg-white px-3 py-4 text-sm">הקישור לא תקין.</p>
      </Screen>
    );
  }
  const when = whenLabel(snapshot.at);
  return (
    <Screen title={`העמסה · ${snapshot.farmName}`} subtitle={[snapshot.user, when].filter(Boolean).join(" · ")}>
      {snapshot.note ? (
        <p className="rounded-lg bg-white px-3 py-2 text-[13px]">
          <span className="font-semibold text-[#3d6b4a]">הערה: </span>
          {snapshot.note}
        </p>
      ) : null}
      <div className="rounded-lg bg-white px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap">
        {snapshot.lines.join("\n")}
      </div>
      {snapshot.media.length > 0 && (
        <div className="grid gap-2">
          {snapshot.media.map((item) =>
            item.kind === "video" ? (
              <video
                key={item.url}
                src={item.url}
                controls
                playsInline
                preload="metadata"
                className="max-h-64 w-full rounded-lg bg-black"
              />
            ) : (
              <img key={item.url} src={item.url} alt={item.name || "תמונה"} className="max-h-64 w-full rounded-lg object-cover" />
            ),
          )}
        </div>
      )}
    </Screen>
  );
}
