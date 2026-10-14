import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { useBilling } from "./useBilling";
import { rupees, rupeesFromPaise } from "../../utils/checkout";
import { day, perMessage } from "../../utils/billing";
import { Pill, Stepper } from "../../components/billing/ui";
import { BTN, PANEL, ICONS } from "../../components/billing/theme";

// The most packs of extra documents one payment can buy; the server holds to the same number
const MAX_PACKS = 20;

/**
 * Billing's Add-ons tab: the two things bought with one payment, apart from a plan.
 *   Extra documents  for a busy month, on any plan, kept until used
 *   Wallet           optional credit for signing links sent by SMS or WhatsApp
 * Neither is ever bought or topped up automatically.
 */
export default function AddOns() {
  const { catalogue, mine, wallet, held, busy, buy } = useBilling();
  const { hash } = useLocation();
  const topups = catalogue?.topups || [];

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [hash]);

  return (
    <div className="grid gap-14">
      <ExtraDocuments topups={topups} mine={mine} held={held} busy={busy} buy={buy} />
      <Wallet catalogue={catalogue} wallet={wallet} held={held} busy={busy} buy={buy} />
    </div>
  );
}

function ExtraDocuments({ topups, mine, held, busy, buy }) {
  // The middle pack to begin with: most people buy more than the smallest
  const [chosen, setChosen] = useState(topups[Math.min(1, topups.length - 1)]?.id || "");
  const [count, setCount] = useState(1);
  const pack = topups.find((option) => option.id === chosen) || topups[0];
  const each = (option) => option.priceInr / option.documents;
  const cheapest = topups.length > 1 ? Math.min(...topups.map(each)) : null;
  const left = mine.forecast.unlimited ? null : mine.forecast.left;

  return (
    <section id="topups" aria-labelledby="topups-heading" className="scroll-mt-24" data-testid="billing-topups">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="topups-heading" className="font-display text-2xl font-bold text-white">
            Extra documents
          </h2>
          <p className="mt-1 max-w-2xl text-gray-400 leading-relaxed">For a busy month. Used after your monthly allowance, on any plan, and they never expire. One payment: no subscription, no wallet needed.</p>
        </div>
        <Pill tone="blue">
          {mine.usage.extraDocuments} in hand{left !== null ? ` · ${left} left this month` : ""}
        </Pill>
      </div>

      {topups.length === 0 ? (
        <p className="mt-5 text-sm text-gray-400">No packs are on sale at the moment.</p>
      ) : (
        <div className="mt-5 flex flex-wrap gap-5 items-stretch">
          <div role="radiogroup" aria-label="Pack size" className="flex-[999_1_520px] min-w-0 grid gap-3">
            {topups.map((option) => {
              const on = option.id === pack.id;
              const best = cheapest !== null && each(option) === cheapest;
              return (
                <label
                  key={option.id}
                  data-testid={`topup-${option.id}`}
                  className={`flex items-center gap-4 px-5 py-[18px] rounded-[14px] border-[1.5px] cursor-pointer transition-colors ${on ? "border-sky-400 bg-sky-400/[0.09]" : "border-white/10 bg-[#12141c] hover:border-white/25"}`}
                >
                  <input type="radio" name="pack" checked={on} onChange={() => setChosen(option.id)} className="w-[18px] h-[18px] accent-sky-400" />
                  <span className="flex-1 min-w-0">
                    <span className="flex flex-wrap items-center gap-2 text-base font-bold text-white">
                      {option.documents} extra documents
                      {best && <span className="px-2 py-0.5 rounded-md bg-amber-400 text-[#1a1405] text-[11px] font-bold">Best value</span>}
                    </span>
                    <span className="block text-[13px] text-gray-400">₹{each(option).toFixed(2)} a document</span>
                  </span>
                  <span className="font-display text-[22px] font-bold text-white">{rupees(option.priceInr)}</span>
                </label>
              );
            })}
          </div>

          <div className="flex-[1_1_320px] min-w-0 flex flex-col gap-4 p-[22px] rounded-2xl bg-gradient-to-b from-sky-400/10 to-[#12141c] to-50% border border-sky-400/30">
            <div className="flex items-center justify-between gap-3">
              <span className="font-bold text-gray-200">How many packs</span>
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
            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-gray-400">Documents added</dt>
                <dd className="font-bold text-white">{(pack.documents * count).toLocaleString("en-IN")}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-400">In hand after</dt>
                <dd className="font-bold text-white">{(mine.usage.extraDocuments + pack.documents * count).toLocaleString("en-IN")} extra</dd>
              </div>
            </dl>
            <div className="pt-3.5 border-t border-dashed border-white/[0.16] flex justify-between items-baseline">
              <span className="font-bold text-white">Total</span>
              <span className="font-display text-[28px] font-bold text-white">{rupees(pack.priceInr * count)}</span>
            </div>
            <button type="button" onClick={() => buy("topup", pack.id, { quantity: count })} disabled={held} className={`${BTN.blue} w-full min-h-[48px] mt-auto`}>
              {busy === `topup:${pack.id}` ? "Opening payment…" : `Buy ${(pack.documents * count).toLocaleString("en-IN")} extra documents · ${rupees(pack.priceInr * count)}`}
            </button>
            <p className="text-center text-xs text-gray-400">GST included · Invoice emailed after payment</p>
          </div>
        </div>
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

  return (
    <section id="wallet" aria-labelledby="wallet-heading" className="scroll-mt-24" data-testid="billing-wallet">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="wallet-heading" className="font-display text-2xl font-bold text-white">
          Wallet
        </h2>
        <Pill tone="gray">Optional</Pill>
      </div>
      <p className="mt-1 max-w-2xl text-gray-400 leading-relaxed">Credit for signing links sent by SMS or WhatsApp. Email is always free. Plans and extra documents are never paid from it, and it never tops itself up.</p>

      <div className="mt-5 flex flex-wrap gap-5 items-stretch">
        <div className="flex-[1_1_320px] min-w-0 p-[22px] rounded-2xl bg-gradient-to-b from-violet-400/[0.11] to-[#12141c] to-55% border border-violet-400/30">
          <p className="text-[13px] font-bold text-violet-200">Balance</p>
          <p className="mt-0.5 font-display text-[38px] font-bold text-white" data-testid="wallet-balance">
            {rupeesFromPaise(wallet?.balancePaise || 0)}
          </p>
          <ul className="mt-4 text-sm">
            <li className="flex justify-between gap-3 py-2.5 border-t border-white/[0.07]">
              <span className="text-gray-300">Signing link by email</span>
              <span className="font-bold text-emerald-300">Free</span>
            </li>
            {prices && (
              <>
                <li className="flex justify-between gap-3 py-2.5 border-t border-white/[0.07]">
                  <span className="text-gray-300">
                    Signing link by SMS <Pill tone="yellow" className="ml-1 !px-2 !py-px !text-[11px]">Coming soon</Pill>
                  </span>
                  <span className="font-bold text-white">{perMessage(prices.sms)} each</span>
                </li>
                <li className="flex justify-between gap-3 py-2.5 border-t border-white/[0.07]">
                  <span className="text-gray-300">
                    Signing link by WhatsApp <Pill tone="yellow" className="ml-1 !px-2 !py-px !text-[11px]">Coming soon</Pill>
                  </span>
                  <span className="font-bold text-white">{perMessage(prices.whatsapp)} each</span>
                </li>
              </>
            )}
          </ul>
        </div>

        {range ? (
          <form onSubmit={submit} noValidate className={`${PANEL} flex-[1_1_360px] min-w-0 flex flex-col gap-3.5 p-[22px]`} data-testid="wallet-custom">
            <label htmlFor="wallet-amount" className="font-bold text-gray-200">
              Amount to add
            </label>
            <div className={`flex items-center gap-1.5 h-[54px] px-4 rounded-xl bg-[#0d0e14] border-[1.5px] focus-within:border-violet-400 ${wrong ? "border-rose-400" : "border-white/[0.14]"}`}>
              <span className="font-display text-[22px] font-bold text-gray-400" aria-hidden="true">
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
                className="flex-1 min-w-0 h-full bg-transparent text-white font-display text-[22px] font-bold placeholder-gray-600 focus:outline-none"
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
                  className="min-h-[40px] px-3.5 rounded-[9px] border border-violet-400/35 bg-violet-400/[0.08] hover:bg-violet-400/[0.16] text-violet-100 text-sm font-bold disabled:opacity-40"
                >
                  + {rupees(option.amountInr)}
                </button>
              ))}
              {typed !== "" && (
                <button type="button" onClick={() => setTyped("")} disabled={Boolean(busy)} className="min-h-[40px] px-3 rounded-[9px] text-sm font-bold text-gray-400 hover:text-white">
                  Clear
                </button>
              )}
            </div>
            <p id="wallet-amount-help" className={`text-[13px] ${wrong ? "text-rose-300" : "text-gray-400"}`}>
              {wrong ? `Enter a whole amount from ${rupees(range.minInr)} to ${rupees(range.maxInr)}.` : `Tap to add, or type any whole amount from ${rupees(range.minInr)} to ${rupees(range.maxInr)}.`}
            </p>
            <button type="submit" disabled={held || !fits} className={`${BTN.violet} w-full min-h-[48px] mt-auto`} data-testid="wallet-buy">
              {busy === "wallet:custom" ? "Opening payment…" : fits ? `Add ${rupees(chosen)} to wallet` : "Add credit"}
            </button>
          </form>
        ) : (
          // A server that sells only the set amounts: each is its own purchase
          <div className={`${PANEL} flex-[1_1_360px] min-w-0 p-[22px]`}>
            <p className="font-bold text-gray-200">Add credit</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {packs.map((option) => (
                <button key={option.id} type="button" onClick={() => buy("wallet", option.id)} disabled={held} className={BTN.secondary}>
                  Add {rupees(option.amountInr)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {wallet?.entries?.length > 0 && (
        <div className={`${PANEL} mt-5 px-[22px] py-5`}>
          <h3 className="text-[15px] font-bold text-white">Wallet activity</h3>
          <ul className="mt-2.5 max-h-64 overflow-y-auto text-sm">
            {wallet.entries.map((entry) => (
              <li key={entry.reference} className="flex flex-wrap justify-between gap-2 py-2.5 border-t border-white/[0.06]">
                <span className="text-gray-300">
                  <span className="text-gray-400">{day(entry.at)}</span> · {entry.reason}
                </span>
                <span className={`font-bold ${entry.type === "credit" ? "text-emerald-300" : "text-gray-100"}`}>
                  {entry.type === "credit" ? "+" : "−"}
                  {rupeesFromPaise(entry.amountPaise)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-3 flex items-center gap-2 text-[13px] text-gray-400">
        <ICONS.info className="w-4 h-4" /> SMS and WhatsApp delivery are being set up. Credit you add stays in your wallet until you use it.
      </p>
    </section>
  );
}
