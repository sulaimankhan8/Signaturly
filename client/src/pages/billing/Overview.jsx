import { Link } from "react-router-dom";
import { useBilling } from "./useBilling";
import { rupees, rupeesFromPaise } from "../../utils/checkout";
import { day, shortDay, daysUntil } from "../../utils/billing";
import { periodSaid, pointsOf } from "../../utils/plans";
import { lookOf } from "../../utils/planLook";
import InvoiceTable from "../../components/billing/InvoiceTable";
import { Pill, SaveBadge, Note } from "../../components/billing/ui";
import { BTN, PANEL, ACCENTS, EYEBROW, ICONS } from "../../components/billing/theme";

/**
 * Billing's first tab: how the plan stands and what happens next, this month's documents,
 * extra documents and the wallet, and the latest invoices. Every action leads to where it is
 * done: a plan to checkout, documents and credit to their tab.
 */
export default function Overview() {
  const { mine, account, wallet, invoices, held, busy, stopRenewing, simulateRenewal, goCheckout } = useBilling();
  const { renewal, forecast } = mine;

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {mine.paid ? (
          <PlanHero mine={mine} account={account} held={held} busy={busy} stopRenewing={stopRenewing} simulateRenewal={simulateRenewal} goCheckout={goCheckout} />
        ) : (
          <FreeHero mine={mine} held={held} goCheckout={goCheckout} />
        )}
        <NextPayment mine={mine} held={held} goCheckout={goCheckout} />
      </div>

      {!forecast.unlimited && forecast.level !== "ok" && <UsageNudge mine={mine} />}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Tile
          id="tile-docs"
          title="Documents this month"
          accent="green"
          icon={ICONS.doc}
          testId="billing-usage"
          figure={
            <>
              {mine.usage.usedThisMonth}
              {mine.usage.monthlyQuota !== null && <span className="text-sm font-bold text-gray-400"> of {mine.usage.monthlyQuota}</span>}
            </>
          }
        >
          {!forecast.unlimited && (
            <div className="mb-2 h-3 rounded-md border-2 border-white/15 bg-[#090a0f] overflow-hidden" aria-hidden="true">
              <div className={`h-full ${forecast.share >= 100 ? "bg-red-500" : forecast.share >= 80 ? "bg-yellow-400" : "bg-emerald-500"}`} style={{ width: `${Math.max(forecast.share, 2)}%` }} />
            </div>
          )}
          {forecast.unlimited ? "No monthly limit" : `${forecast.left} left · resets on ${shortDay(mine.usage.resetsOn)}`}
        </Tile>

        <Tile
          id="tile-extra"
          title="Extra documents"
          accent="blue"
          icon={ICONS.plus}
          testId="billing-extra"
          figure={
            <>
              {mine.usage.extraDocuments} <span className="text-sm font-bold text-gray-400">in hand</span>
            </>
          }
        >
          Used after the monthly allowance. They never expire.
          <TileLink to="/billing/add-ons" accent="blue">
            Buy extra documents
          </TileLink>
        </Tile>

        <Tile id="tile-wallet" title="Wallet balance" accent="purple" icon={ICONS.wallet} testId="overview-wallet" figure={rupeesFromPaise(wallet?.balancePaise || 0)}>
          Only for signing links by SMS or WhatsApp. Email is always free.
          <TileLink to="/billing/add-ons#wallet" accent="purple">
            Add credit
          </TileLink>
        </Tile>
      </div>

      <section aria-labelledby="recent-heading" className={`${PANEL} overflow-hidden`} data-testid="recent-invoices">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div>
            <h2 id="recent-heading" className="text-lg font-black uppercase tracking-tight text-white">
              Latest payments
            </h2>
            <p className="text-xs text-gray-400">Every payment has a GST invoice or receipt.</p>
          </div>
          {invoices.length > 0 && (
            <Link to="/billing/invoices" className={BTN.small}>
              All invoices and details
            </Link>
          )}
        </div>
        <InvoiceTable invoices={invoices} limit={5} />
      </section>

      {renewal.mode === "auto" && account.devSimulation && (
        <button type="button" onClick={simulateRenewal} disabled={Boolean(busy)} className="justify-self-start text-xs text-gray-500 underline hover:text-gray-300">
          Simulate the next charge (development)
        </button>
      )}
    </div>
  );
}

// One figure, as the dashboard's stat cards show theirs: a solid icon chip and a hard shadow in
// its colour. What it means, and where to act on it, is beneath.
const Tile = ({ id, title, accent, icon, testId, figure, children }) => {
  const Glyph = icon;
  return (
    <section aria-labelledby={id} className={`bg-[#13151f] border-2 border-white/20 rounded-2xl p-5 flex flex-col ${ACCENTS[accent].shadow}`} data-testid={testId}>
      <div className="flex items-center gap-4">
        <span className={`w-12 h-12 shrink-0 grid place-items-center rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_#000] ${ACCENTS[accent].chip}`} aria-hidden="true">
          <Glyph className="w-6 h-6" />
        </span>
        <div className="min-w-0">
          <h2 id={id} className={EYEBROW}>
            {title}
          </h2>
          <p className="text-[28px] leading-tight font-black text-white tabular-nums">{figure}</p>
        </div>
      </div>
      <div className="mt-4 pt-3 border-t-2 border-dashed border-white/10 text-xs text-gray-400 leading-relaxed flex-1 flex flex-col">{children}</div>
    </section>
  );
};

const TileLink = ({ to, accent, children }) => (
  <Link to={to} className={`mt-2 inline-flex items-center gap-1.5 self-start text-xs font-black uppercase tracking-wider ${ACCENTS[accent].link}`}>
    {children}
    <ICONS.arrow className="w-3.5 h-3.5" />
  </Link>
);

// A short list of what the plan includes, ticked in the plan's colour
const Points = ({ points, colour }) =>
  points.length > 0 ? (
    <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm font-medium text-gray-200">
      {points.map((point) => (
        <li key={point} className="inline-flex items-center gap-1.5">
          <ICONS.check className={`w-3.5 h-3.5 ${colour}`} />
          {point}
        </li>
      ))}
    </ul>
  ) : null;

function PlanHero({ mine, held, busy, stopRenewing, goCheckout }) {
  const { renewal } = mine;
  const look = lookOf(mine.held);
  const points = mine.held ? pointsOf(mine.held).slice(0, 4) : [];
  const amount = renewal.amountInr ? rupees(renewal.amountInr) : null;

  return (
    <section aria-labelledby="plan-heading" className={`lg:col-span-2 min-w-0 rounded-2xl p-6 sm:p-7 border-2 ${look.summary}`} data-testid="billing-plan">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`px-2 py-0.5 rounded-md border-2 text-[10px] font-black uppercase tracking-wider ${look.chip}`}>Your plan</span>
        <Pill tone={mine.tone} dot>
          {mine.label}
        </Pill>
        {mine.seats && (
          <Pill tone="gray">
            {mine.seats} seat{mine.seats === 1 ? "" : "s"}
          </Pill>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-5">
        <div className="min-w-0">
          <h2 id="plan-heading" className="text-4xl sm:text-5xl leading-none font-black uppercase tracking-tight text-white">
            {mine.planName}
            {periodSaid(mine.held) && <span className="ml-2 text-base font-bold normal-case tracking-normal text-gray-400">· {periodSaid(mine.held)}</span>}
          </h2>
        </div>
        {renewal.mode !== "none" && amount && (
          <div className="sm:text-right">
            <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">
              {renewal.mode === "auto"
                ? mine.scheduled
                  ? `${mine.scheduled.name} from ${day(mine.scheduled.from)}`
                  : `Renews on ${day(renewal.nextChargeOn)}`
                : renewal.overdue
                  ? `Ended on ${day(renewal.endsOn)}`
                  : `Paid until ${day(renewal.endsOn)}`}
            </p>
            <p className="mt-0.5 text-3xl font-black text-white tabular-nums">
              {amount}
              <span className="text-sm font-bold text-gray-400"> / {renewal.interval}</span>
            </p>
          </div>
        )}
      </div>

      <Points points={points} colour={look.heading} />

      <p className={`mt-4 text-sm leading-relaxed ${renewal.overdue ? "text-red-300 font-bold" : "text-gray-300"}`} data-testid="billing-renewal">
        {mine.sentence}
        {mine.complimentary && " It was given to you by PactDoc."}
      </p>

      {renewal.mode === "auto" && renewal.overdue && mine.currentPlan && <PayAgain mine={mine} held={held} goCheckout={goCheckout} />}

      <div className="mt-5 flex flex-wrap gap-3">
        {mine.nextUp && (
          <button type="button" onClick={() => goCheckout(mine.nextUp.plan)} disabled={held} className={BTN.primary}>
            <ICONS.bolt className="w-4 h-4" />
            Upgrade to {mine.nextUp.plan.name}
          </button>
        )}
        {renewal.mode === "once" && mine.currentPlan && renewal.canStart && (
          <button type="button" onClick={() => goCheckout(mine.currentPlan, { renew: "auto" })} disabled={held} className={mine.nextUp ? BTN.secondary : BTN.primary}>
            Turn on auto-renew
          </button>
        )}
        {renewal.mode === "once" && mine.currentPlan && renewal.canAddPeriod && (
          <button type="button" onClick={() => goCheckout(mine.currentPlan, { renew: "once" })} disabled={held} className={BTN.secondary}>
            {renewal.overdue ? `Pay for another ${mine.period}` : `Add another ${mine.period}`} · {rupees(renewal.amountInr)}
          </button>
        )}
        {mine.canSwitchPeriod && (
          <button type="button" onClick={() => goCheckout(mine.otherPrice)} disabled={held} className={BTN.secondary}>
            Switch to {periodSaid(mine.otherPrice).toLowerCase()}
            {mine.switchSaves && <SaveBadge>{mine.switchSaves}</SaveBadge>}
          </button>
        )}
        {renewal.mode === "auto" && (
          <button type="button" onClick={stopRenewing} disabled={Boolean(busy)} className={BTN.ghost}>
            Turn off auto-renew
          </button>
        )}
        {renewal.mode !== "auto" && (
          <Link to="/billing/plans" className={BTN.ghost}>
            Change plan
          </Link>
        )}
      </div>
    </section>
  );
}

// An automatic payment that failed: pay it again now, by a new approval or for one period. Either
// takes the place of the failed one, so nothing is charged twice. Until then the plan carries on
// through its grace (the account's `gracePeriodEnd`), and then moves to Free.
function PayAgain({ mine, held, goCheckout }) {
  const { renewal } = mine;
  return (
    <div className="mt-5 p-4 rounded-xl border-2 border-red-500 bg-red-600/10 shadow-[4px_4px_0px_0px_#ef4444]" role="alert" data-testid="billing-pay-again">
      <p className="font-black text-white">Your automatic payment did not go through</p>
      <p className="mt-1 text-sm text-gray-300 leading-relaxed">
        Razorpay will try it again, but you can pay now to keep {mine.planName} without a break. Paying now takes the place of the failed payment, so you are never charged twice.
      </p>
      <div className="mt-3.5 flex flex-wrap gap-3">
        <button type="button" onClick={() => goCheckout(mine.currentPlan, { renew: "auto" })} disabled={held} className={BTN.primary}>
          <ICONS.lock className="w-4 h-4" />
          Pay {rupees(renewal.amountInr)} now
        </button>
        <button type="button" onClick={() => goCheckout(mine.currentPlan, { renew: "once" })} disabled={held} className={BTN.secondary}>
          Pay for one {renewal.interval} instead
        </button>
      </div>
    </div>
  );
}

function FreeHero({ mine, held, goCheckout }) {
  const pro = mine.nextUp?.plan;
  return (
    <section aria-labelledby="plan-heading" className="lg:col-span-2 min-w-0 rounded-2xl p-6 sm:p-7 bg-[#13151f] border-2 border-white/20 shadow-[6px_6px_0px_0px_#ef4444]" data-testid="billing-plan">
      <div className="flex flex-wrap items-center gap-2">
        <span className="px-2 py-0.5 rounded-md border-2 border-black bg-emerald-500 text-black text-[10px] font-black uppercase tracking-wider">Your plan</span>
        <Pill tone="gray" dot>
          Free
        </Pill>
      </div>
      <h2 id="plan-heading" className="mt-4 text-4xl sm:text-5xl leading-none font-black uppercase tracking-tight text-white">
        Free
      </h2>
      <p className="mt-3 text-sm text-gray-300" data-testid="billing-renewal">
        {mine.sentence}
      </p>
      {pro && (
        <div className="mt-5 flex flex-wrap items-center gap-4 p-4 rounded-xl border-2 border-yellow-400 bg-yellow-400/[0.06]">
          <div className="flex-1 min-w-[220px]">
            <p className="font-black text-white">
              <span className="uppercase">{pro.name}</span>: {pro.documentsPerMonth === null ? "no monthly limit" : `${pro.documentsPerMonth} documents a month`}
            </p>
            <p className="mt-0.5 text-sm text-gray-400">{pointsOf(pro).slice(1, 4).join(" · ")}</p>
          </div>
          <button type="button" onClick={() => goCheckout(pro)} disabled={held} className={BTN.yellow}>
            <ICONS.bolt className="w-4 h-4" />
            Upgrade to {pro.name} · {rupees(pro.priceInr)}/{pro.interval}
          </button>
        </div>
      )}
      <Link to="/billing/plans" className="mt-4 inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-gray-300 hover:text-white">
        Compare every plan
        <ICONS.arrow className="w-3.5 h-3.5" />
      </Link>
    </section>
  );
}

function NextPayment({ mine, held, goCheckout }) {
  const { renewal } = mine;
  const title = renewal.mode === "auto" ? "Next payment" : renewal.mode === "once" ? "Plan ends" : "Payments";

  return (
    <section aria-labelledby="next-heading" className={`${PANEL} min-w-0 p-6 flex flex-col gap-4`}>
      <h2 id="next-heading" className={EYEBROW}>
        {title}
      </h2>
      {renewal.mode === "auto" ? (
        <>
          <div>
            <p className="text-3xl font-black text-white tabular-nums">{rupees(renewal.amountInr)}</p>
            <p className="mt-0.5 text-sm text-gray-300">
              on {day(renewal.nextChargeOn)}
              {!renewal.overdue && `, in ${daysUntil(renewal.nextChargeOn)} days`}
            </p>
          </div>
          <div className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-[#090a0f] border-2 border-white/15">
            <span className="w-9 h-9 grid place-items-center rounded-lg border-2 border-black bg-blue-600 text-white" aria-hidden="true">
              <ICONS.phone className="w-[18px] h-[18px]" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-black text-gray-100">Automatic payment</p>
              <p className="text-xs text-gray-400">Approved through Razorpay</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">Turning auto-renew off keeps your plan until {shortDay(renewal.nextChargeOn)}. Nothing more is charged.</p>
        </>
      ) : renewal.mode === "once" ? (
        <>
          <div>
            <p className="text-3xl font-black text-white">{day(renewal.endsOn)}</p>
            <p className="mt-0.5 text-sm text-gray-300">{renewal.overdue ? "Your paid time has ended." : `in ${daysUntil(renewal.endsOn)} days. It will not renew by itself.`}</p>
          </div>
          {renewal.canStart && mine.currentPlan && (
            <Note tone="violet" icon="shield">
              Turn on auto-renew and never lose access. Nothing is charged until {shortDay(renewal.endsOn)}.
              <button
                type="button"
                onClick={() => goCheckout(mine.currentPlan, { renew: "auto" })}
                disabled={held}
                className="block mt-1.5 text-xs font-black uppercase tracking-wider text-purple-300 hover:text-white underline underline-offset-2"
              >
                Turn on auto-renew
              </button>
            </Note>
          )}
        </>
      ) : (
        <>
          <p className="text-3xl font-black uppercase text-white">None due</p>
          <p className="text-sm text-gray-400 leading-relaxed">
            {mine.paid ? "This plan has no end date and nothing is charged for it." : "You pay nothing on Free. Extra documents and wallet credit are one payment each, whenever you need them."}
          </p>
        </>
      )}
    </section>
  );
}

function UsageNudge({ mine }) {
  const { forecast } = mine;
  const out = forecast.left === 0;
  const red = out && forecast.extra === 0;
  const title = out
    ? forecast.extra > 0
      ? `This month's ${forecast.quota} documents are used. Your ${forecast.extra} extra documents are being used now.`
      : `You have used all ${forecast.quota} documents for this month`
    : `You have used ${forecast.share}% of this month's documents, with ${forecast.daysToReset} days to go`;
  const detail = out
    ? `Your allowance comes round again on ${shortDay(forecast.resets)}. Add documents with one payment, or move to a bigger plan.`
    : forecast.runsOutOn
      ? `At this pace you will reach ${forecast.quota} around ${shortDay(forecast.runsOutOn)}.${forecast.extra > 0 ? ` Your ${forecast.extra} extra documents will be used after that.` : ""}`
      : `${forecast.left} left until ${shortDay(forecast.resets)}.`;

  return (
    <div
      role="status"
      className={`flex flex-wrap items-center gap-4 px-5 py-4 rounded-2xl border-2 ${red ? "bg-red-950/40 border-red-500/80 shadow-[4px_4px_0px_0px_#ef4444]" : "bg-amber-950/40 border-amber-500/80 shadow-[4px_4px_0px_0px_#f59e0b]"}`}
      data-testid="usage-nudge"
    >
      <span className={`w-10 h-10 shrink-0 grid place-items-center rounded-xl border-2 border-black ${red ? "bg-red-600 text-white" : "bg-yellow-400 text-black"}`} aria-hidden="true">
        <ICONS.trend className="w-5 h-5" />
      </span>
      <div className="flex-[1_1_320px] min-w-0">
        <p className={`font-black ${red ? "text-red-200" : "text-amber-200"}`}>{title}</p>
        <p className="mt-0.5 text-sm text-gray-300">{detail}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link to="/billing/add-ons" className={red ? BTN.primary : BTN.yellow}>
          Add documents
        </Link>
        {mine.nextUp && (
          <Link to="/billing/plans" className={BTN.secondary}>
            See bigger plans
          </Link>
        )}
      </div>
    </div>
  );
}
