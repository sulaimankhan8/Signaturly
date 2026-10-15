import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { useBilling } from "./useBilling";
import { rupees, rupeesFromPaise } from "../../utils/checkout";
import { day, shortDay, perMessage } from "../../utils/billing";
import { Pill, Stepper, Assurances } from "../../components/billing/ui";
import { BTN, PANEL, EYEBROW, ICONS } from "../../components/billing/theme";

// The most packs of extra documents one payment can buy; the server holds to the same number
const MAX_PACKS = 20;

/**
 * Billing's Add-ons tab: the two things bought with one payment, apart from a plan.
 *   Extra documents  for a busy month, on any plan, kept until used
 *   Wallet           optional credit for signing links sent by SMS or WhatsApp
 * Neither is ever bought or topped up automatically.
 *
 * Each buy button sits straight under what is being chosen, so it is in view without scrolling:
 * the packs side by side with the bar that totals the order and pays right beneath them, and
 * the wallet beside them with its amount and button before its prices and activity.
 */
export default function AddOns() {
  const { catalogue, mine, wallet, held, busy, buy } = useBilling();
  const { hash } = useLocation();
  const topups = catalogue?.topups || [];

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [hash]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] items-start">
      <ExtraDocuments topups={topups} mine={mine} held={held} busy={busy} buy={buy} />
      <Wallet catalogue={catalogue} wallet={wallet} held={held} busy={busy} buy={buy} />
    </div>
  );
}

// A count the customer already has, in a small box beside the heading
const Stock = ({ label, value, tone = "text-white" }) => (
  <div className="px-3 py-1.5 rounded-lg border-2 border-white/15 bg-[#090a0f] text-right">
    <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">{label}</p>
    <p className={`text-lg leading-tight font-black tabular-nums ${tone}`}>{value}</p>
  </div>
);

const Chip = ({ className, children }) => (
  <span className={`w-11 h-11 shrink-0 grid place-items-center rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_#000] ${className}`} aria-hidden="true">
    {children}
  </span>
);

function ExtraDocuments({ topups, mine, held, busy, buy }) {
  // The middle pack to begin with: most people buy more than the smallest
  const [chosen, setChosen] = useState(topups[Math.min(1, topups.length - 1)]?.id || "");
  const [count, setCount] = useState(1);
  const pack = topups.find((option) => option.id === chosen) || topups[0];
  const each = (option) => option.priceInr / option.documents;
  const cheapest = topups.length > 1 ? Math.min(...topups.map(each)) : null;
  // What a pack saves on each document against the smallest pack's price
  const dearest = topups.length > 1 ? Math.max(...topups.map(each)) : null;
  const saves = (option) => (dearest ? Math.round((1 - each(option) / dearest) * 100) : 0);
  const left = mine.forecast.unlimited ? null : mine.forecast.left;
  const added = pack ? pack.documents * count : 0;

  return (
    <section id="topups" aria-labelledby="topups-heading" className={`${PANEL} shadow-[5px_5px_0px_0px_#3b82f6] p-5 sm:p-6 scroll-mt-24`} data-testid="billing-topups">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0 flex-[1_1_340px]">
          <Chip className="bg-blue-600 text-white">
            <ICONS.doc className="w-5 h-5" />
          </Chip>
          <div className="min-w-0">
            <h2 id="topups-heading" className="text-xl font-black uppercase tracking-tight text-white">
              Extra documents
            </h2>
            <p className="mt-0.5 text-sm text-gray-400 leading-relaxed">
              For a busy month. Used after your monthly allowance, on any plan, and they never expire. One payment: no subscription, no wallet needed.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {left !== null && <Stock label="Left this month" value={left} tone={left === 0 ? "text-red-400" : "text-white"} />}
          <Stock label="Extra in hand" value={mine.usage.extraDocuments.toLocaleString("en-IN")} tone="text-blue-400" />
        </div>
      </div>

      {topups.length === 0 ? (
        <p className="mt-5 text-sm text-gray-400">No packs are on sale at the moment.</p>
      ) : (
        <>
          <div role="radiogroup" aria-label="Pack size" className="mt-6 grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
            {topups.map((option) => {
              const on = option.id === pack.id;
              const best = cheapest !== null && each(option) === cheapest;
              const saving = saves(option);
              return (
                <label
                  key={option.id}
                  data-testid={`topup-${option.id}`}
                  className={`relative flex flex-col p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    on
                      ? "border-yellow-400 bg-yellow-400/[0.07] shadow-[4px_4px_0px_0px_#facc15] -translate-x-0.5 -translate-y-0.5"
                      : "border-white/15 bg-[#0f1118] shadow-[3px_3px_0px_0px_#000] hover:border-white/40"
                  }`}
                >
                  {best && (
                    <span className="absolute -top-3 left-3 -rotate-2 px-2 py-0.5 rounded-md border-2 border-black bg-yellow-400 text-black text-[10px] font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#000]">
                      Best value
                    </span>
                  )}
                  <input type="radio" name="pack" checked={on} onChange={() => setChosen(option.id)} className="absolute top-3.5 right-3.5 w-[18px] h-[18px] accent-yellow-400" />
                  <span className="text-[32px] leading-none font-black text-white tabular-nums">{option.documents}</span>{" "}
                  <span className="mt-1 text-[11px] font-black uppercase tracking-wider text-gray-400">extra documents</span>
                  <span className="mt-3 pt-3 border-t-2 border-dashed border-white/10 flex items-baseline justify-between gap-2">
                    <span className="text-xl font-black text-white tabular-nums">{rupees(option.priceInr)}</span>
                    {saving > 0 && <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400">Save {saving}%</span>}
                  </span>
                  <span className="text-xs text-gray-400">₹{each(option).toFixed(2)} a document</span>
                </label>
              );
            })}
          </div>

          {/* The order: how many packs, what that adds, the total, and the one button that pays,
              straight under the packs */}
          <div className="mt-6">
            <div className="grid gap-4 p-4 sm:px-5 rounded-xl border-2 border-dashed border-white/20 bg-[#090a0f] md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
              <div className="flex items-center gap-3">
                <span className={EYEBROW}>Packs</span>
                <Stepper
                  value={count}
                  onLess={() => setCount((value) => Math.max(1, value - 1))}
                  onMore={() => setCount((value) => Math.min(MAX_PACKS, value + 1))}
                  lessDisabled={count <= 1 || held}
                  moreDisabled={count >= MAX_PACKS || held}
                  lessLabel="One pack fewer"
                  moreLabel="One pack more"
                />
              </div>
              <dl className="flex flex-wrap gap-x-7 gap-y-2 md:justify-center">
                <div>
                  <dt className="text-[10px] font-black uppercase tracking-wider text-gray-400">Documents added</dt>
                  <dd className="text-lg font-black text-white tabular-nums">+{added.toLocaleString("en-IN")}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-black uppercase tracking-wider text-gray-400">In hand after</dt>
                  <dd className="text-lg font-black text-blue-400 tabular-nums">{(mine.usage.extraDocuments + added).toLocaleString("en-IN")} extra</dd>
                </div>
              </dl>
              <div className="md:text-right">
                <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Total · GST included</p>
                <p className="text-3xl leading-tight font-black text-white tabular-nums">{rupees(pack.priceInr * count)}</p>
              </div>
            </div>

            <button type="button" onClick={() => buy("topup", pack.id, { quantity: count })} disabled={held} className={`${BTN.primary} w-full min-h-[52px] mt-5 text-sm`}>
              {busy === `topup:${pack.id}` ? null : <ICONS.lock className="w-4 h-4" />}
              {busy === `topup:${pack.id}` ? "Opening payment…" : `Buy ${added.toLocaleString("en-IN")} extra documents · ${rupees(pack.priceInr * count)}`}
            </button>
            <Assurances items={["One payment, no subscription", "Never expire", "GST invoice emailed", "UPI, cards or netbanking"]} className="mt-4 justify-center" />
          </div>

          {/* The order they are used in, so it is plain what is being bought */}
          <ol aria-label="How extra documents are used" className="mt-6 pt-6 border-t-2 border-dashed border-white/10 grid sm:grid-cols-3 gap-3">
            {[
              ["Your plan's documents first", mine.usage.monthlyQuota === null ? "Your plan has no monthly limit" : `${mine.usage.monthlyQuota} a month, fresh on ${shortDay(mine.usage.resetsOn)}`],
              ["Then your extra documents", "Only once the month's allowance runs out"],
              ["What is left stays", "They never expire, whatever plan you are on"],
            ].map(([title, detail], index) => (
              <li key={title} className="flex items-start gap-2.5 p-3 rounded-xl border-2 border-white/10 bg-[#0f1118]">
                <span className="w-6 h-6 shrink-0 grid place-items-center rounded-md border-2 border-black bg-blue-600 text-white text-xs font-black" aria-hidden="true">
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-black text-white">{title}</span>
                  <span className="block text-xs text-gray-400">{detail}</span>
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}

function Wallet({ catalogue, wallet, held, busy, buy }) {
  const [typed, setTyped] = useState("");
  const range = catalogue?.walletCustom || null;
  const packs = catalogue?.walletPacks || [];
  const prices = catalogue?.usagePricesPaise || null;

  const chosen = Number(typed);
  const fits = Boolean(range) && typed !== "" && Number.isInteger(chosen) && chosen >= range.minInr && chosen <= range.maxInr;
  const atMost = Boolean(range) && chosen >= range.maxInr;
  const wrong = typed !== "" && !fits;
  const addTo = (amountInr) => setTyped((old) => String(Math.min(range.maxInr, Math.max(0, Math.floor(Number(old)) || 0) + amountInr)));

  const submit = (event) => {
    event.preventDefault();
    if (!fits) {
      toast.error(`Enter a whole amount from ${rupees(range.minInr)} to ${rupees(range.maxInr)}.`);
      return;
    }
    buy("wallet", "custom", { amountInr: chosen });
  };

  const rate = "flex items-center justify-between gap-3 py-1.5 border-t border-white/[0.07] first:border-0";
  const soon = (
    <Pill tone="yellow" className="ml-1.5 !px-1.5 !py-0 !text-[9px] !shadow-none">
      Soon
    </Pill>
  );

  return (
    <section id="wallet" aria-labelledby="wallet-heading" className={`${PANEL} shadow-[5px_5px_0px_0px_#a855f7] p-5 sm:p-6 scroll-mt-24`} data-testid="billing-wallet">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Chip className="bg-purple-600 text-white">
            <ICONS.wallet className="w-5 h-5" />
          </Chip>
          <h2 id="wallet-heading" className="text-xl font-black uppercase tracking-tight text-white">
            Wallet
          </h2>
        </div>
        <Pill tone="gray">Optional</Pill>
      </div>
      <p className="mt-2.5 text-[13px] text-gray-400 leading-relaxed">
        Credit for signing links sent by SMS or WhatsApp; email is always free. It never pays for plans or documents, and never tops itself up.
      </p>

      <div className="mt-4 flex items-baseline justify-between gap-3 px-3.5 py-3 rounded-xl border-2 border-white/15 bg-[#090a0f]">
        <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Balance</p>
        <p className="text-2xl leading-tight font-black text-white tabular-nums" data-testid="wallet-balance">
          {rupeesFromPaise(wallet?.balancePaise || 0)}
        </p>
      </div>

      {range ? (
        <form onSubmit={submit} noValidate className="mt-4 grid gap-2.5" data-testid="wallet-custom">
          <label htmlFor="wallet-amount" className={EYEBROW}>
            Amount to add
          </label>
          <div
            className={`flex items-center gap-1.5 h-[50px] px-3.5 rounded-xl bg-[#090a0f] border-2 focus-within:border-yellow-400 transition-colors ${wrong ? "border-red-500" : "border-white/20"}`}
          >
            <span className="text-xl font-black text-gray-500" aria-hidden="true">
              ₹
            </span>
            <input
              id="wallet-amount"
              type="number"
              inputMode="numeric"
              min={range.minInr}
              max={range.maxInr}
              step="1"
              placeholder="0"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              aria-describedby="wallet-amount-help"
              aria-invalid={wrong}
              className="flex-1 min-w-0 h-full bg-transparent text-white text-xl font-black tabular-nums placeholder-gray-600 focus:outline-none"
            />
          </div>
          {/* Each of these adds to the amount above; nothing is paid until the button below */}
          <div className="flex flex-wrap gap-2" data-testid="wallet-quick">
            {packs.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => addTo(option.amountInr)}
                disabled={held || atMost}
                aria-label={`Add ${rupees(option.amountInr)} to the amount`}
                className="min-h-[34px] px-3 rounded-lg border-2 border-purple-500/50 bg-purple-500/10 hover:bg-purple-500/20 hover:border-purple-400 text-purple-100 text-xs font-black transition-colors disabled:opacity-40"
              >
                + {rupees(option.amountInr)}
              </button>
            ))}
            {typed !== "" && (
              <button type="button" onClick={() => setTyped("")} disabled={Boolean(busy)} className="min-h-[34px] px-2 text-xs font-black uppercase tracking-wider text-gray-400 hover:text-white">
                Clear
              </button>
            )}
          </div>
          <p id="wallet-amount-help" className={`text-xs ${wrong ? "text-red-400 font-bold" : "text-gray-400"}`}>
            {wrong ? `Enter a whole amount from ${rupees(range.minInr)} to ${rupees(range.maxInr)}.` : `Tap to add, or type any whole amount from ${rupees(range.minInr)} to ${rupees(range.maxInr)}.`}
          </p>
          <button type="submit" disabled={held || !fits} className={`${BTN.violet} w-full min-h-[48px]`} data-testid="wallet-buy">
            {busy === "wallet:custom" ? "Opening payment…" : fits ? `Add ${rupees(chosen)} to wallet` : "Add credit"}
          </button>
        </form>
      ) : (
        // A server that sells only the set amounts: each is its own purchase
        <div className="mt-4">
          <p className={EYEBROW}>Add credit</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {packs.map((option) => (
              <button key={option.id} type="button" onClick={() => buy("wallet", option.id)} disabled={held} className={BTN.small}>
                Add {rupees(option.amountInr)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* What the credit pays for, beneath the button that adds it */}
      <div className="mt-5">
        <h3 className={EYEBROW}>What it pays for</h3>
        <ul className="mt-1.5 text-xs">
          <li className={rate}>
            <span className="text-gray-300">Signing link by email</span>
            <span className="font-black text-emerald-400">Free</span>
          </li>
          {prices && (
            <>
              <li className={rate}>
                <span className="text-gray-300">Signing link by SMS {soon}</span>
                <span className="font-black text-white">{perMessage(prices.sms)} each</span>
              </li>
              <li className={rate}>
                <span className="text-gray-300">Signing link by WhatsApp {soon}</span>
                <span className="font-black text-white">{perMessage(prices.whatsapp)} each</span>
              </li>
            </>
          )}
        </ul>
      </div>

      <p className="mt-3 flex items-start gap-2 text-xs text-gray-400">
        <ICONS.info className="w-3.5 h-3.5 shrink-0 mt-px" /> SMS and WhatsApp delivery are being set up. Credit you add stays in your wallet until you use it.
      </p>

      {wallet?.entries?.length > 0 && (
        <div className="mt-4 pt-4 border-t-2 border-dashed border-white/10">
          <h3 className={EYEBROW}>Wallet activity</h3>
          <ul className="mt-2 max-h-40 overflow-y-auto text-xs pr-1">
            {wallet.entries.map((entry) => (
              <li key={entry.reference} className="flex justify-between gap-2 py-2 border-t border-white/[0.06] first:border-0">
                <span className="min-w-0 text-gray-300">
                  <span className="block text-gray-500 font-mono text-[11px]">{day(entry.at)}</span>
                  {entry.reason}
                </span>
                <span className={`shrink-0 font-black tabular-nums ${entry.type === "credit" ? "text-emerald-400" : "text-gray-100"}`}>
                  {entry.type === "credit" ? "+" : "−"}
                  {rupeesFromPaise(entry.amountPaise)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
