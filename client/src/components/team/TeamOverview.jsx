import { useState } from "react";
import { BTN, PANEL, EYEBROW, FIGURE, ACCENTS, ICONS } from "../billing/theme";
import { Pill, Spinner } from "../billing/ui";
import { Avatar, RoleTag, Bar } from "./parts";
import { ActivityRow } from "./TeamActivity";
import { seatsOf, invitationTimes } from "../../utils/team";

/**
 * A team at a glance: four figures, what is left to set up, what happened lately, and who is in it.
 */

const BORDER = { purple: "border-purple-500", green: "border-emerald-500", yellow: "border-yellow-400", blue: "border-blue-500" };

const Tile = ({ accent, label, figure, of, children }) => (
  <section className={`bg-[#13151f] border-2 rounded-2xl p-5 ${BORDER[accent]} ${ACCENTS[accent].shadow}`}>
    <p className={EYEBROW}>{label}</p>
    <p className={`${FIGURE} mt-1.5 text-3xl leading-none`}>
      {figure} {of && <span className="text-base text-gray-400">{of}</span>}
    </p>
    <div className="mt-3 text-xs text-gray-400">{children}</div>
  </section>
);

const More = ({ onClick, children }) => (
  <button type="button" onClick={onClick} className="mt-1 text-xs font-black uppercase tracking-wider text-red-400 hover:text-red-300">
    {children} →
  </button>
);

export default function TeamOverview({ team, usage, activity, locked = false, canManage, isOwner, enterprise, onTab, onInvite, onTalkToSales }) {
  const [now] = useState(() => Date.now());
  const seats = seatsOf(team);
  const withTwoStep = team.members.filter((m) => m.twoFactor).length;
  const soonest = team.invitations.map((i) => invitationTimes(i, now)).sort((a, b) => a.daysLeft - b.daysLeft)[0];

  // What is left to set up, in the order it is worth doing. Single sign-on is the owner's alone.
  const steps = [
    { id: "invite", done: team.members.length > 1, title: "Invite your team", doneSaid: `${team.members.length - 1} ${team.members.length === 2 ? "person" : "people"} joined`, action: ["Invite", onInvite] },
    {
      id: "brand",
      done: Boolean(team.branding?.logoUrl && team.branding?.companyName),
      title: "Add your name and logo for signers",
      help: "Signers see them on emails and signing pages, in place of PactDoc's.",
      action: ["Add", () => onTab("branding")],
    },
    {
      id: "two-step",
      done: Boolean(team.policy?.requireTwoFactor),
      title: "Require two-step sign-in",
      help: `Protects every document in the team. ${team.members.length - withTwoStep} of ${team.members.length} ${team.members.length === 1 ? "person has" : "people have"} not set it up yet.`,
      action: ["Turn on", () => onTab("security")],
    },
    isOwner && {
      id: "sso",
      done: Boolean(team.sso?.enabled),
      title: "Single sign-on with your company login",
      enterprise: !enterprise,
      help: "Your people sign in with your company login, such as Google Workspace, Microsoft Entra or Okta.",
      action: enterprise ? ["Set up", () => onTab("security")] : ["Talk to sales", onTalkToSales],
    },
  ].filter(Boolean);
  const done = steps.filter((s) => s.done).length;
  const current = steps.find((s) => !s.done);

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))]">
        <Tile accent="purple" label="Seats" figure={seats.used} of={seats.allowed === null ? "no limit" : `of ${seats.allowed}`}>
          {seats.allowed !== null && <Bar parts={[[seats.used / seats.allowed, "#a855f7"]]} />}
          <p className="mt-2">
            {seats.allowed === null ? "" : `${seats.free} free · `}
            {seats.invited} held by invitations
          </p>
        </Tile>

        {isOwner && usage && (
          <Tile accent="green" label="Documents this month" figure={usage.usedThisMonth} of={usage.monthlyQuota === null ? "no limit" : `of ${usage.monthlyQuota.toLocaleString("en-IN")}`}>
            {usage.monthlyQuota !== null && <Bar parts={[[usage.usedThisMonth / Math.max(1, usage.monthlyQuota), "#22c55e"]]} />}
            <p className="mt-2">Shared by the whole team{usage.resetsOn ? ` · resets ${new Date(usage.resetsOn).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}</p>
          </Tile>
        )}

        <Tile accent="yellow" label="Waiting to join" figure={seats.invited}>
          <p>{!soonest ? "Nobody is waiting to join." : soonest.daysLeft <= 1 ? "An invitation expires today." : `The next invitation expires in ${soonest.daysLeft} days.`}</p>
          {canManage && soonest && <More onClick={() => onTab("people")}>Resend or withdraw</More>}
        </Tile>

        <Tile accent="blue" label="Two-step sign-in" figure={team.policy?.requireTwoFactor ? "Required" : "Optional"}>
          <p>
            {withTwoStep} of {team.members.length} {team.members.length === 1 ? "person has" : "people have"} it on
          </p>
          <More onClick={() => onTab("security")}>Review</More>
        </Tile>
      </div>

      {canManage && current && (
        <section className={`${PANEL} p-5`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black uppercase text-white">Finish setting up your team</h2>
              <p className="text-sm text-gray-400">
                {done} of {steps.length} done. Each step takes a minute or two.
              </p>
            </div>
            <div className="w-full sm:w-52">
              <Bar parts={[[done / steps.length, "#facc15"]]} />
            </div>
          </div>
          <ol className="mt-4 grid gap-2">
            {steps.map((step, index) => {
              const isCurrent = step === current;
              return (
                <li key={step.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl border-2 ${isCurrent ? "border-yellow-400 bg-yellow-400/[0.06]" : "border-white/10 bg-[#0f1118]"}`}>
                  <span
                    className={`w-7 h-7 shrink-0 grid place-items-center rounded-lg border-2 font-black text-xs ${step.done ? "bg-emerald-500 border-black text-black" : isCurrent ? "border-yellow-400 text-yellow-400" : "border-white/25 text-gray-400"}`}
                    aria-hidden="true"
                  >
                    {step.done ? <ICONS.check className="w-4 h-4" /> : index + 1}
                  </span>
                  <span className="flex-[1_1_240px] min-w-0">
                    <span className={step.done ? "text-gray-400 line-through" : "font-black text-white"}>{step.title}</span>
                    {step.done && <span className="sr-only"> (done)</span>}
                    {step.enterprise && !step.done && <Pill tone="blue" className="ml-2 align-middle">Enterprise</Pill>}
                    {!step.done && step.help && <span className="block text-xs text-gray-400">{step.help}</span>}
                  </span>
                  {step.done ? (
                    <span className="text-xs text-gray-400">{step.doneSaid || "Done"}</span>
                  ) : (
                    <button type="button" className={isCurrent ? `${BTN.primary} !min-h-[36px] !px-3 !text-[11px]` : BTN.small} onClick={step.action[1]}>
                      {step.action[0]}
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <div className="grid gap-6 grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] items-start">
        <section className={`${PANEL} p-5`}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-black uppercase text-white">Latest activity</h2>
            <More onClick={() => onTab("activity")}>All</More>
          </div>
          {locked ? (
            <p className="mt-3 text-sm text-gray-400">Set up two-step sign-in to see what has happened in this team.</p>
          ) : activity === null ? (
            <Spinner className="w-5 h-5 mt-3" />
          ) : activity.length === 0 ? (
            <p className="mt-3 text-sm text-gray-400">Nothing has happened in this team yet. Documents sent while working in it show up here.</p>
          ) : (
            <ul className="mt-2">
              {activity.slice(0, 4).map((entry, i) => (
                <ActivityRow key={`${entry.at}-${i}`} entry={entry} showDay now={now} />
              ))}
            </ul>
          )}
        </section>

        <section className={`${PANEL} p-5`}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-black uppercase text-white">People</h2>
            <More onClick={() => onTab("people")}>{canManage ? "Manage" : "See all"}</More>
          </div>
          <ul className="mt-3 grid gap-2.5">
            {team.members.slice(0, 5).map((m) => (
              <li key={m.userId} className="flex items-center gap-2.5 min-w-0">
                <Avatar name={m.name} email={m.email} size="w-8 h-8 text-[11px]" />
                <span className="flex-1 min-w-0 truncate text-sm font-bold text-white">{m.name || m.email}</span>
                <RoleTag role={m.role} />
              </li>
            ))}
          </ul>
          {team.members.length > 5 && <p className="mt-2 text-xs text-gray-400">and {team.members.length - 5} more</p>}
          {canManage && (
            <button type="button" className={`${BTN.primary} w-full mt-4`} onClick={onInvite}>
              <ICONS.plus className="w-4 h-4" /> Invite people
            </button>
          )}
        </section>
      </div>
    </div>
  );
}
