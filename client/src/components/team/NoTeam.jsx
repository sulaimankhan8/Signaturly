import { useState } from "react";
import { Link } from "react-router-dom";
import { BTN, PANEL, INPUT, LABEL, FIGURE } from "../billing/theme";
import { Pill } from "../billing/ui";
import { rupees } from "../../utils/checkout";

/**
 * Starting a team: naming it, once the plan allows teams. Used on the no-team page and in the
 * "New team" window.
 */
export function CreateTeamForm({ busy, onCreate, autoFocus = false }) {
  const [name, setName] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onCreate(name.trim());
      }}
      className="grid gap-3"
    >
      <div>
        <label htmlFor="new-team-name" className={LABEL}>
          Name your team
        </label>
        <input id="new-team-name" className={INPUT} placeholder="Team name" maxLength={80} value={name} autoFocus={autoFocus} onChange={(e) => setName(e.target.value)} />
      </div>
      <button type="submit" className={`${BTN.violet} w-full`} disabled={busy === "create" || !name.trim()}>
        {busy === "create" ? "Creating…" : "Create team"}
      </button>
    </form>
  );
}

const WHY = [
  ["Shared documents", "Everyone sees what the team has sent, and templates are made once for all."],
  ["Roles", "Admins, members and viewers, each allowed exactly what they need."],
  ["Your brand", "Your name, logo and colour on every email and signing page."],
  ["Security rules", "Require two-step sign-in, decide how long documents are kept."],
  ["One allowance", "The whole team's documents come out of one monthly allowance."],
  ["Activity", "See who sent, signed or declined what, and export it."],
];

/**
 * The page for someone in no team: what a team gives, and either naming one (the plan
 * allows teams) or getting the plan that does.
 */
export default function NoTeam({ mayCreate, busy, onCreate, price, canBuy, onBuy }) {
  return (
    <div className="flex flex-wrap gap-7 items-start">
      <div className="flex-[999_1_520px] min-w-0" data-testid="team-list">
        <Pill tone="violet">Team workspaces</Pill>
        <h1 className="mt-4 text-4xl font-black uppercase leading-tight text-white tracking-tight">
          Bring your team to <span className="text-yellow-400">PactDoc</span>
        </h1>
        <p className="mt-3 max-w-xl text-gray-400">You are not in a team yet. A team is one place for everyone&apos;s documents and templates, one plan, and each person with their own sign-in.</p>
        <ul className="mt-7 grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))]">
          {WHY.map(([title, text]) => (
            <li key={title} className={`${PANEL} p-4`}>
              <p className="font-black uppercase text-white">{title}</p>
              <p className="mt-1 text-sm text-gray-400">{text}</p>
            </li>
          ))}
        </ul>
      </div>

      <aside className={`${PANEL} flex-[1_1_320px] min-w-0 p-6 !border-purple-500 !shadow-[6px_6px_0px_0px_#a855f7]`}>
        {mayCreate ? (
          <>
            <Pill tone="green">Your plan includes teams</Pill>
            <p className="mt-4 mb-4 text-sm text-gray-400">Name your team to start. You can invite people straight after.</p>
            <CreateTeamForm busy={busy} onCreate={onCreate} />
          </>
        ) : (
          <>
            <Pill tone="violet">Business plan</Pill>
            {price && (
              <>
                <p className={`${FIGURE} mt-4 text-5xl leading-none`}>
                  {rupees(price.perMonth)}
                  <span className="text-sm font-bold text-gray-400">/seat/mo</span>
                </p>
                <p className="mt-1.5 text-sm text-gray-400">{price.yearly ? `Billed yearly · or ${rupees(price.monthly)} a seat, monthly` : "Billed monthly"}</p>
              </>
            )}
            {canBuy ? (
              <button type="button" className={`${BTN.violet} w-full mt-5`} onClick={onBuy}>
                Start a team
              </button>
            ) : (
              <Link to="/billing/plans" className={`${BTN.secondary} w-full mt-5`}>
                See plans
              </Link>
            )}
            <p className="mt-2.5 text-xs text-center text-gray-400">Choose the number of seats at checkout. Your own documents stay yours.</p>
          </>
        )}
        <div className="mt-5 pt-4 border-t-2 border-dashed border-white/10">
          <p className="text-sm font-black text-white">Been invited to a team?</p>
          <p className="text-sm text-gray-400">Open the link in your invitation email. It needs no plan of your own.</p>
        </div>
      </aside>
    </div>
  );
}
