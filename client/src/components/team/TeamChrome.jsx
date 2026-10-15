import { useState } from "react";
import { Link } from "react-router-dom";
import { BTN, PANEL, ICONS } from "../billing/theme";
import { Pill } from "../billing/ui";
import { TeamMark } from "./parts";
import { ROLE_LABELS } from "../../utils/workspace";
import { seatsOf, seatsSaid, dateOf } from "../../utils/team";

/**
 * What stays in place on every team page: the team itself at the top, with switching teams and
 * going to work in it, and the menu of its pages down the side.
 */

const youAre = (role) => (role === "owner" ? "You are the owner" : `You are ${role === "admin" ? "an" : "a"} ${role}`);

export function TeamHeader({ team, teams, onPick, mayCreate, onNewTeam, onWorkIn, planName }) {
  const [open, setOpen] = useState(false);
  const seats = seatsOf(team);
  const canSwitch = teams.length > 1 || mayCreate;

  return (
    <section className={`${PANEL} p-5 flex flex-wrap items-center gap-4`}>
      <TeamMark team={team} />
      <div className="flex-[1_1_320px] min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-black uppercase text-white tracking-tight break-words">{team.name}</h1>
          {team.status === "read_only" ? <Pill tone="yellow">Read-only</Pill> : <Pill tone="green">Active</Pill>}
          {planName && <Pill tone="violet">{planName}</Pill>}
        </div>
        <p className="mt-1 text-sm text-gray-400">
          {youAre(team.role)}
          {team.seats && ` · ${seatsSaid(seats)}`}
          {team.createdAt && ` · started ${dateOf(team.createdAt)}`}
        </p>
      </div>
      <div className="flex flex-wrap gap-2.5">
        {canSwitch && (
          <div className="relative">
            <button type="button" className={BTN.secondary} aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(!open)}>
              Switch team <span aria-hidden="true">▾</span>
            </button>
            {open && (
              <>
                {/* Anywhere outside the menu closes it */}
                <button type="button" className="fixed inset-0 z-30 cursor-default" aria-label="Close the list of teams" onClick={() => setOpen(false)} />
                <div className={`${PANEL} absolute right-0 z-40 mt-2 w-72 p-2`} onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
                  <p className="px-2 pt-1 pb-2 text-[11px] font-black uppercase tracking-wider text-gray-400">Your teams</p>
                  <ul className="grid gap-1">
                    {teams.map((t) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setOpen(false);
                            onPick(String(t.id));
                          }}
                          className={`w-full flex items-center gap-2.5 p-2 rounded-lg text-left ${String(t.id) === String(team.id) ? "bg-white/10" : "hover:bg-white/5"}`}
                        >
                          <TeamMark team={t} size="w-8 h-8 text-[10px] rounded-lg !shadow-none" />
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-black text-white truncate">{t.name}</span>
                            <span className="block text-[11px] text-gray-400">
                              {ROLE_LABELS[t.role] || t.role}
                              {t.status === "read_only" ? " · read-only" : ""}
                            </span>
                          </span>
                          {String(t.id) === String(team.id) && <ICONS.check className="w-4 h-4 text-emerald-400" />}
                        </button>
                      </li>
                    ))}
                  </ul>
                  {mayCreate && (
                    <button
                      type="button"
                      className={`${BTN.small} w-full mt-2`}
                      onClick={() => {
                        setOpen(false);
                        onNewTeam();
                      }}
                    >
                      <ICONS.plus className="w-4 h-4" /> New team
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
        <button type="button" className={BTN.primary} onClick={onWorkIn} data-testid="work-in-team">
          Work in this team <ICONS.arrow className="w-4 h-4" />
        </button>
      </div>
    </section>
  );
}

const PAGES = [
  ["overview", "Overview", "grid"],
  ["people", "People", "users"],
  ["branding", "Branding", "image"],
  ["security", "Security", "shield"],
  ["activity", "Activity", "clock"],
];

const GridIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

export function TeamNav({ tab, onTab, team, isOwner }) {
  const seats = seatsOf(team);
  const people = team.members.length;
  const badge = {
    people: `${people}${seats.invited ? ` · ${seats.invited} invited` : ""}`,
    security: team.policy?.requireTwoFactor ? null : "!",
  };
  const item = "flex items-center gap-3 min-h-[44px] px-3 rounded-xl border-2 text-sm font-black uppercase tracking-wide transition-colors whitespace-nowrap";

  return (
    <nav aria-label="Team settings" className={`${PANEL} relative p-2 flex lg:grid gap-1 overflow-x-auto`}>
      {PAGES.map(([id, label, icon]) => {
        const Icon = icon === "grid" ? GridIcon : ICONS[icon];
        const on = tab === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onTab(id)}
            aria-current={on ? "page" : undefined}
            className={`${item} ${on ? "bg-yellow-400 text-black border-black shadow-[2px_2px_0px_0px_#ef4444]" : "border-transparent text-gray-300 hover:bg-white/5 hover:text-white"}`}
          >
            <Icon className="w-[18px] h-[18px] shrink-0" />
            {label}
            {badge[id] && (
              <span className={`ml-auto pl-2 text-[11px] font-black ${on ? "text-black/70" : id === "security" ? "text-yellow-400" : "text-gray-400"}`}>
                {id === "security" ? (
                  <>
                    <span aria-hidden="true" title="Two-step sign-in is not required">
                      !
                    </span>
                    <span className="sr-only">(two-step sign-in is not required)</span>
                  </>
                ) : (
                  badge[id]
                )}
              </span>
            )}
          </button>
        );
      })}
      {isOwner && (
        <Link to="/billing" className={`${item} border-transparent text-gray-300 hover:bg-white/5 hover:text-white`}>
          <ICONS.card className="w-[18px] h-[18px] shrink-0" />
          Plan &amp; seats
          <span className="ml-auto pl-2 text-gray-400" aria-hidden="true">
            ↗
          </span>
        </Link>
      )}
    </nav>
  );
}
