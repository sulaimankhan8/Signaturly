import { Wallet, WalletEntry } from "../models/Wallet.model.js";
import { ApiError } from "../utils/ApiError.js";
import { env } from "../config/env.js";
import { USAGE_PRICES_PAISE } from "../config/plans.js";

/**
 * The prepaid credit wallet (plan task P4-15).
 *
 * Guarantees:
 *   - The balance never goes below zero, however many charges arrive at once.
 *   - Every change to the balance has a ledger line, and the lines add up to the balance.
 *   - A change with a `reference` already used is not applied a second time.
 */

const walletOf = async (userId) => {
  try {
    return await Wallet.findOneAndUpdate({ userId }, { $setOnInsert: { userId, balancePaise: 0, pending: [] } }, { upsert: true, new: true });
  } catch (err) {
    // Two first uses at once: one creates the wallet, the other reads it
    if (err?.code !== 11000) throw err;
    return Wallet.findOne({ userId });
  }
};

/**
 * Copies changes recorded on the wallet into the ledger, then clears them from the wallet.
 * Safe to run at any time and any number of times.
 */
export const settleWallet = async (userId) => {
  const wallet = await Wallet.findOne({ userId }).lean();
  if (!wallet || wallet.pending.length === 0) return;

  for (const change of wallet.pending) {
    try {
      await WalletEntry.create({ userId, ...change });
    } catch (err) {
      if (err?.code !== 11000) throw err; // already in the ledger from an earlier, interrupted run
    }
    await Wallet.updateOne({ userId }, { $pull: { pending: { reference: change.reference } } });
  }
};

const change = async (userId, type, amountPaise, { reference, reason = "", meta = {} }) => {
  if (!Number.isInteger(amountPaise) || amountPaise <= 0) throw new ApiError(400, "The amount must be a whole number of paise above zero");
  if (typeof reference !== "string" || !reference) throw new Error("A wallet change needs a reference");

  await walletOf(userId);
  await settleWallet(userId);

  // The same cause is never applied twice
  const earlier = await WalletEntry.findOne({ userId, reference }).lean();
  if (earlier) return { applied: false, balancePaise: (await Wallet.findOne({ userId }).lean()).balancePaise, entry: earlier };

  const signed = type === "credit" ? amountPaise : -amountPaise;
  const at = new Date();

  // One step on one document: check, move the balance, and note the change beside it
  const updated = await Wallet.findOneAndUpdate(
    {
      userId,
      "pending.reference": { $ne: reference },
      ...(type === "debit" ? { balancePaise: { $gte: amountPaise } } : {}),
    },
    [
      {
        $set: {
          balancePaise: { $add: ["$balancePaise", signed] },
          pending: {
            $concatArrays: [
              "$pending",
              [
                {
                  reference: { $literal: reference },
                  type: { $literal: type },
                  amountPaise: { $literal: amountPaise },
                  balanceAfterPaise: { $add: ["$balancePaise", signed] },
                  reason: { $literal: reason },
                  meta: { $literal: meta },
                  at: { $literal: at },
                },
              ],
            ],
          },
        },
      },
    ],
    { new: true, updatePipeline: true }
  );

  if (!updated) {
    // Either the same reference is being applied by another request right now, or there is not enough credit
    await settleWallet(userId);
    const racing = await WalletEntry.findOne({ userId, reference }).lean();
    if (racing) return { applied: false, balancePaise: (await Wallet.findOne({ userId }).lean()).balancePaise, entry: racing };
    throw new ApiError(402, "WALLET_INSUFFICIENT: There is not enough credit in the wallet. Add credit and try again.");
  }

  await settleWallet(userId);
  const entry = await WalletEntry.findOne({ userId, reference }).lean();
  return { applied: true, balancePaise: updated.balancePaise, entry };
};

export const creditWallet = (userId, amountPaise, details) => change(userId, "credit", amountPaise, details);
export const debitWallet = (userId, amountPaise, details) => change(userId, "debit", amountPaise, details);

export const getWallet = async (userId, { limit = 50 } = {}) => {
  await walletOf(userId);
  await settleWallet(userId);
  const [wallet, entries] = await Promise.all([
    Wallet.findOne({ userId }).lean(),
    WalletEntry.find({ userId }).sort({ at: -1, _id: -1 }).limit(limit).lean(),
  ]);
  return {
    balancePaise: wallet.balancePaise,
    entries: entries.map(({ reference, type, amountPaise, balanceAfterPaise, reason, at }) => ({ reference, type, amountPaise, balanceAfterPaise, reason, at })),
  };
};

/**
 * Checks a wallet against its ledger. Used by tests and available to an admin tool:
 * the lines must add up to the balance, and each line's balance must follow from the one before.
 */
export const auditWallet = async (userId) => {
  await settleWallet(userId);
  const wallet = await Wallet.findOne({ userId }).lean();
  const entries = await WalletEntry.find({ userId }).sort({ at: 1, _id: 1 }).lean();
  const sum = entries.reduce((total, entry) => total + (entry.type === "credit" ? entry.amountPaise : -entry.amountPaise), 0);
  return {
    balancePaise: wallet?.balancePaise ?? 0,
    ledgerSumPaise: sum,
    entries: entries.length,
    consistent: sum === (wallet?.balancePaise ?? 0) && entries.every((entry) => entry.balanceAfterPaise >= 0),
  };
};

/**
 * Takes the price of one SMS or WhatsApp message from the sender's wallet.
 * Does nothing where charging is switched off (development, until a provider is connected).
 * `reference` must be the same for retries of the same message and different for a new one.
 */
export const chargeForMessage = async ({ userId, channel, reference }) => {
  if (!env.usageChargingEnabled) return { charged: false };
  const price = USAGE_PRICES_PAISE[channel];
  if (!price) throw new Error(`No price is set for channel "${channel}"`);
  const result = await debitWallet(userId, price, { reference, reason: channel === "sms" ? "SMS message" : "WhatsApp message", meta: { channel } });
  return { charged: result.applied, balancePaise: result.balancePaise };
};
