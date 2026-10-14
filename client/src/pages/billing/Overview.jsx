import { Link } from "react-router-dom";
import { useBilling } from "./useBilling";
import { rupees, rupeesFromPaise } from "../../utils/checkout";
import { day, shortDay, daysUntil } from "../../utils/billing";
import { periodSaid, pointsOf } from "../../utils/plans";
import { lookOf } from "../../utils/planLook";
import InvoiceTable from "../../components/billing/InvoiceTable";
import { Pill, SaveBadge, Note } from "../../components/billing/ui";
import { BTN, PANEL, TINTS, ICONS } from "../../components/billing/theme";

/**
 * Billing's first tab: how the plan stands and what happens next, this month's documents,
 * extra documents and the wallet, and the latest invoices. Every action leads to where it is
 * done: a plan to checkout, documents and credit to their tab.
 */
export default function Overview() {
  const { mine, account, wallet, invoices, held, busy, stopRenewing, simulateRenewal, goCheckout } = useBilling();
  const { renewal, forecast } = mine;

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {mine.paid ? <PlanHero mine={mine} account={account} held={held} busy={busy} stopRenewing={stopRenewing} simulateRenewal={simulateRenewal} goCheckout={goCheckout} /> : <FreeHero mine={mine} held={held} goCheckout={goCheckout} />}
        <NextPayment mine={mine} held={held} goCheckout={goCheckout} />
      </div>

      {!forecast.unlimited && forecast.level !== "ok" && <UsageNudge mine={mine} />}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <section aria-labelledby="tile-docs" className={`rounded-2xl p-[22px] ${TINTS.emerald.panel}`} data-testid="billing-usage">
          <div className="flex items-center justify-between gap-3">
            <h2 id="tile-docs" className="text-sm font-bold text-emerald-200">
              Documents this month
            </h2>
            <ICONS.doc className="w-5 h-5 text-emerald-300" />
          </div>
          <p className="mt-2.5 font-display text-[34px] font-bold text-white">
            {mine.usage.usedThisMonth}
            {mine.usage.monthlyQuota !== null && <span className="text-base font-medium text-gray-400"> of {mine.usage.monthlyQuota}</span>}
          </p>
          {!forecast.unlimited && (
            <div className="mt-3 h-2 rounded-full bg-white/[0.08] overflow-hidden" aria-hidden="true">
              <div
                className={`h-full rounded-full ${forecast.share >= 100 ? "bg-rose-500" : forecast.share >= 80 ? "bg-gradient-to-r from-amber-400 to-rose-500" : "bg-gradient-to-r from-emerald-400 to-amber-300"}`}
                style={{ width: `${Math.max(forecast.share, 2)}%` }}
              />
            </div>
          )}
          <p className="mt-2.5 text-[13px] text-gray-400">{forecast.unlimited ? "No monthly limit" : `${forecast.left} left · resets on ${shortDay(mine.usage.resetsOn)}`}</p>
        </section>

        <section aria-labelledby="tile-extra" className={`rounded-2xl p-[22px] ${TINTS.sky.panel}`} data-testid="billing-extra">
          <div className="flex items-center justify-between gap-3">
            <h2 id="tile-extra" className="text-sm font-bold text-sky-200">
              Extra documents
            </h2>
            <ICONS.plus className="w-5 h-5 text-sky-300" />
          </div>
          <p className="mt-2.5 font-display text-[34px] font-bold text-white">
            {mine.usage.extraDocuments} <span className="text-base font-medium text-gray-400">in hand</span>
          </p>
          <p className="mt-3 text-[13px] text-gray-400">Used after the monthly allowance. They never expire.</p>
          <Link to="/billing/add-ons" className="inline-block mt-2 text-sm font-bold text-sky-300 hover:text-sky-200">
            Buy extra documents →
          </Link>
        </section>

        <section aria-labelledby="tile-wallet" className={`rounded-2xl p-[22px] ${TINTS.violet.panel}`} data-testid="overview-wallet">
          <div className="flex items-center justify-between gap-3">
            <h2 id="tile-wallet" className="text-sm font-bold text-violet-200">
              Wallet balance
            </h2>
            <ICONS.wallet className="w-5 h-5 text-violet-300" />
          </div>
          <p className="mt-2.5 font-display text-[34px] font-bold text-white">{rupeesFromPaise(wallet?.balancePaise || 0)}</p>
          <p className="mt-3 text-[13px] text-gray-400">Only for signing links by SMS or WhatsApp. Email is always free.</p>
          <Link to="/billing/add-ons#wallet" className="inline-block mt-2 text-sm font-bold text-violet-300 hover:text-violet-200">
            Add credit →
          </Link>
        </section>
      </div>

      <section aria-labelledby="recent-heading" className={`${PANEL} overflow-hidden mt-3`} data-testid="recent-invoices">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5">
          <div>
            <h2 id="recent-heading" className="font-display text-xl font-bold text-white">
              Latest payments
            </h2>
            <p className="mt-0.5 text-[13px] text-gray-400">Every payment has a GST invoice or receipt.</p>
          </div>
          {invoices.length > 0 && (
            <Link to="/billing/invoices" className={`${BTN.small} bg-white/[0.06] hover:bg-white/[0.11] border border-white/[0.14] text-gray-100`}>
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

function PlanHero({ mine, held, busy, stopRenewing, goCheckout }) {
  const { renewal } = mine;
  const look = lookOf(mine.held);
  const points = mine.held ? pointsOf(mine.held).slice(0, 4) : [];
  const amount = renewal.amountInr ? rupees(renewal.amountInr) : null;

  return (
    <section aria-labelledby="plan-heading" className={`lg:col-span-2 min-w-0 rounded-[18px] p-6 sm:p-7 border ${look.summary}`} data-testid="billing-plan">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-[0.04em] ${look.chip}`}>Your plan</span>
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
          <h2 id="plan-heading" className="font-display text-[44px] leading-none font-bold tracking-tight text-white">
            {mine.planName}
            {periodSaid(mine.held) && <span className="ml-2 font-sans text-lg font-medium tracking-normal text-gray-400">· {periodSaid(mine.held)}</span>}
          </h2>
          {points.length > 0 && <p className="mt-3 text-sm text-gray-300">{points.join(" · ")}</p>}
        </div>
        {renewal.mode !== "none" && amount && (
          <div className="text-right">
            <p className="text-[13px] text-gray-400">
              {renewal.mode === "auto"
                ? mine.scheduled
                  ? `${mine.scheduled.name} from ${day(mine.scheduled.from)}`
                  : `Renews on ${day(renewal.nextChargeOn)}`
                : renewal.overdue
                  ? `Ended on ${day(renewal.endsOn)}`
                  : `Paid until ${day(renewal.endsOn)}`}
            </p>
            <p className="mt-0.5 font-display text-3xl font-bold text-white">
              {amount}
              <span className="font-sans text-sm font-medium text-gray-400"> / {renewal.interval}</span>
            </p>
          </div>
        )}
      </div>

      <p className={`mt-4 text-sm leading-relaxed ${renewal.overdue ? "text-rose-200" : "text-gray-300"}`} data-testid="billing-renewal">
        {mine.sentence}
        {mine.complimentary && " It was given to you by PactDoc."}
      </p>

      <div className="mt-5 flex flex-wrap gap-2.5">
        {mine.nextUp && (
          <button type="button" onClick={() => goCheckout(mine.nextUp.plan)} disabled={held} className={BTN.primary}>
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

function FreeHero({ mine, held, goCheckout }) {
  const pro = mine.nextUp?.plan;
  return (
    <section aria-labelledby="plan-heading" className="lg:col-span-2 min-w-0 rounded-[18px] p-6 sm:p-7 border bg-gradient-to-br from-rose-500/[0.10] via-[#12141c] to-[#12141c] border-rose-500/25" data-testid="billing-plan">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-[0.04em] bg-emerald-400/[0.12] text-emerald-300">Your plan</span>
        <Pill tone="gray" dot>
          Free
        </Pill>
      </div>
      <h2 id="plan-heading" className="mt-4 font-display text-[44px] leading-none font-bold tracking-tight text-white">
        Free
      </h2>
      <p className="mt-3 text-sm text-gray-300" data-testid="billing-renewal">
        {mine.sentence}
      </p>
      {pro && (
        <div className="mt-5 flex flex-wrap items-center gap-4 p-4 rounded-2xl bg-black/20 border border-white/[0.08]">
          <div className="flex-1 min-w-[220px]">
            <p className="font-bold text-white">
              {pro.name}: {pro.documentsPerMonth === null ? "no monthly limit" : `${pro.documentsPerMonth} documents a month`}
            </p>
            <p className="mt-0.5 text-sm text-gray-400">{pointsOf(pro).slice(1, 4).join(" · ")}</p>
          </div>
          <button type="button" onClick={() => goCheckout(pro)} disabled={held} className={BTN.primary}>
            Upgrade to {pro.name} · {rupees(pro.priceInr)}/{pro.interval}
          </button>
        </div>
      )}
      <Link to="/billing/plans" className="inline-block mt-4 text-sm font-bold text-gray-300 hover:text-white">
        Compare every plan →
      </Link>
    </section>
  );
}

function NextPayment({ mine, held, goCheckout }) {
  const { renewal } = mine;
  const title = renewal.mode === "auto" ? "Next payment" : renewal.mode === "once" ? "Plan ends" : "Payments";

  return (
    <section aria-labelledby="next-heading" className={`${PANEL} min-w-0 p-6 flex flex-col gap-4`}>
      <h2 id="next-heading" className="text-[13px] font-bold uppercase tracking-[0.06em] text-gray-400">
        {title}
      </h2>
      {renewal.mode === "auto" ? (
        <>
          <div>
            <p className="font-display text-3xl font-bold text-white">{rupees(renewal.amountInr)}</p>
            <p className="mt-0.5 text-sm text-gray-300">
              on {day(renewal.nextChargeOn)}
              {!renewal.overdue && `, in ${daysUntil(renewal.nextChargeOn)} days`}
            </p>
          </div>
          <div className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-[#0d0e14] border border-white/[0.07]">
            <span className="w-9 h-9 grid place-items-center rounded-[9px] bg-sky-400/[0.14] text-sky-300" aria-hidden="true">
              <ICONS.phone className="w-[18px] h-[18px]" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-100">Automatic payment</p>
              <p className="text-[13px] text-gray-400">Approved through Razorpay</p>
            </div>
          </div>
          <p className="text-[13px] text-gray-400 leading-relaxed">Turning auto-renew off keeps your plan until {shortDay(renewal.nextChargeOn)}. Nothing more is charged.</p>
        </>
      ) : renewal.mode === "once" ? (
        <>
          <div>
            <p className="font-display text-3xl font-bold text-white">{day(renewal.endsOn)}</p>
            <p className="mt-0.5 text-sm text-gray-300">{renewal.overdue ? "Your paid time has ended." : `in ${daysUntil(renewal.endsOn)} days. It will not renew by itself.`}</p>
          </div>
          {renewal.canStart && mine.currentPlan && (
            <Note tone="violet" icon="shield">
              Turn on auto-renew and never lose access. Nothing is charged until {shortDay(renewal.endsOn)}.
              <button type="button" onClick={() => goCheckout(mine.currentPlan, { renew: "auto" })} disabled={held} className="block mt-2 font-bold text-violet-200 hover:text-white underline underline-offset-2">
                Turn on auto-renew
              </button>
            </Note>
          )}
        </>
      ) : (
        <>
          <p className="font-display text-3xl font-bold text-white">None due</p>
          <p className="text-sm text-gray-400 leading-relaxed">{mine.paid ? "This plan has no end date and nothing is charged for it." : "You pay nothing on Free. Extra documents and wallet credit are one payment each, whenever you need them."}</p>
        </>
      )}
    </section>
  );
}

function UsageNudge({ mine }) {
  const { forecast } = mine;
  const out = forecast.left === 0;
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
    <div role="status" className={`flex flex-wrap items-center gap-4 px-5 py-4 rounded-[14px] border ${out && forecast.extra === 0 ? "bg-rose-500/[0.08] border-rose-500/30" : "bg-amber-400/[0.08] border-amber-400/30"}`} data-testid="usage-nudge">
      <span className={`w-[38px] h-[38px] shrink-0 grid place-items-center rounded-[10px] ${out && forecast.extra === 0 ? "bg-rose-500/15 text-rose-300" : "bg-amber-400/15 text-amber-300"}`} aria-hidden="true">
        <ICONS.trend className="w-5 h-5" />
      </span>
      <div className="flex-[1_1_320px] min-w-0">
        <p className={`font-bold ${out && forecast.extra === 0 ? "text-rose-100" : "text-amber-100"}`}>{title}</p>
        <p className="mt-0.5 text-sm text-gray-300">{detail}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link to="/billing/add-ons" className={BTN.secondary}>
          Add documents
        </Link>
        {mine.nextUp && (
          <Link to="/billing/plans" className={BTN.ghost}>
            See bigger plans
          </Link>
        )}
      </div>
    </div>
  );
}
