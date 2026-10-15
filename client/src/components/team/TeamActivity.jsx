import { useMemo, useState } from "react";
import { BTN, PANEL, INPUT, ICONS } from "../billing/theme";
import { Spinner } from "../billing/ui";
import { SectionHead } from "./parts";
import { EVENT_WORDS, ACTIVITY_KINDS, kindOf, dayHeading, timeOf, activityCsv } from "../../utils/team";

// Each kind of event's mark in the feed
const LOOK = {
  sent: ["bg-blue-600 text-white", "send"],
  signed: ["bg-emerald-500 text-black", "check"],
  completed: ["bg-purple-600 text-white", "check"],
  declined: ["bg-red-600 text-white", "close"],
  other: ["bg-[#1e2235] text-gray-200", "doc"],
};

export const ActivityRow = ({ entry, showDay = false, now }) => {
  const [chip, icon] = LOOK[kindOf(entry.event)];
  const Glyph = ICONS[icon];
  return (
    <li className="flex gap-3 py-3 border-t-2 border-white/[0.06] first:border-t-0">
      <span className={`w-7 h-7 shrink-0 grid place-items-center rounded-lg border-2 border-black ${chip}`} aria-hidden="true">
        <Glyph className="w-3.5 h-3.5" />
      </span>
      <span className="flex-1 min-w-0 text-sm text-gray-300">
        <strong className="text-white">{entry.actor || "Someone"}</strong> {EVENT_WORDS[entry.event] || entry.event} {entry.document && <strong className="text-white break-words">{entry.document}</strong>}
        <span className="block text-[11px] text-gray-400">
          {showDay ? `${dayHeading(entry.at, now)} · ` : ""}
          {timeOf(entry.at)}
        </span>
      </span>
    </li>
  );
};

const WHEN = [
  ["all", "Any time", Infinity],
  ["1", "Today", 1],
  ["7", "Last 7 days", 7],
  ["30", "Last 30 days", 30],
];

export default function TeamActivity({ team, activity, locked = false }) {
  const [now] = useState(() => Date.now());
  const [kind, setKind] = useState("all");
  const [who, setWho] = useState("");
  const [when, setWhen] = useState("all");

  const people = useMemo(() => [...new Set((activity || []).map((e) => e.actor).filter(Boolean))].sort(), [activity]);

  const shown = useMemo(() => {
    const days = WHEN.find(([id]) => id === when)?.[2] ?? Infinity;
    const startOfToday = new Date(new Date(now).toDateString()).getTime();
    const since = days === Infinity ? -Infinity : startOfToday - (days - 1) * 24 * 60 * 60 * 1000;
    return (activity || []).filter((e) => (kind === "all" || kindOf(e.event) === kind) && (!who || e.actor === who) && new Date(e.at).getTime() >= since);
  }, [activity, kind, who, when, now]);

  // The feed, a day at a time
  const days = useMemo(() => {
    const groups = [];
    for (const entry of shown) {
      const heading = dayHeading(entry.at, now);
      if (groups.at(-1)?.heading !== heading) groups.push({ heading, entries: [] });
      groups.at(-1).entries.push(entry);
    }
    return groups;
  }, [shown, now]);

  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([activityCsv(shown)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${team.name.replace(/[^\w-]+/g, "-")}-activity.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid gap-5" data-testid="team-activity">
      <SectionHead
        title="Activity"
        action={
          <button type="button" className={BTN.secondary} onClick={exportCsv} disabled={!shown.length}>
            <ICONS.download className="w-4 h-4" /> Export CSV
          </button>
        }
      >
        Who sent, signed or declined what in this team. The latest 50 events.
      </SectionHead>

      <div className={`${PANEL} p-4 flex flex-wrap items-center gap-3`}>
        <div role="group" aria-label="Show" className="flex flex-wrap gap-1.5">
          {ACTIVITY_KINDS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={kind === id}
              onClick={() => setKind(id)}
              className={`min-h-[36px] px-3 rounded-lg border-2 text-[11px] font-black uppercase tracking-wider ${kind === id ? "bg-yellow-400 text-black border-black" : "bg-[#0d0f16] text-gray-300 border-white/20 hover:border-white/40"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 ml-auto">
          <label className="sr-only" htmlFor="activity-who">
            Who
          </label>
          <select id="activity-who" className={`${INPUT} !w-auto !min-h-[36px] text-xs`} value={who} onChange={(e) => setWho(e.target.value)}>
            <option value="">Anyone</option>
            {people.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="activity-when">
            When
          </label>
          <select id="activity-when" className={`${INPUT} !w-auto !min-h-[36px] text-xs`} value={when} onChange={(e) => setWhen(e.target.value)}>
            {WHEN.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <section className={`${PANEL} p-5`}>
        {locked ? (
          <p className="text-sm text-gray-400">Set up two-step sign-in to see what has happened in this team.</p>
        ) : activity === null ? (
          <Spinner />
        ) : activity.length === 0 ? (
          <p className="text-sm text-gray-400">Nothing has happened in this team yet.</p>
        ) : days.length === 0 ? (
          <p className="text-sm text-gray-400">Nothing matches. Try another filter.</p>
        ) : (
          <div className="grid gap-5">
            {days.map((day) => (
              <div key={day.heading}>
                <h3 className="text-[11px] font-black uppercase tracking-wider text-yellow-400">{day.heading}</h3>
                <ul className="mt-1">
                  {day.entries.map((entry, i) => (
                    <ActivityRow key={`${entry.at}-${i}`} entry={entry} now={now} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
