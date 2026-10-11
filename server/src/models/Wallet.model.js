import mongoose from "mongoose";

/**
 * A sender's prepaid credit, in paise (plan task P4-15).
 *
 * The balance and the record of what changed it must never disagree, and the database used
 * here cannot change two documents in one step. So each change is written into this one
 * document together with the new balance (`pending`), and is then copied to the ledger
 * (WalletEntry) and removed from here. If the process stops in between, the change is still
 * here and is copied the next time the wallet is touched. See services/wallet.service.js.
 */
const walletSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    balancePaise: { type: Number, default: 0, min: 0 },
    pending: [
      {
        _id: false,
        reference: { type: String, required: true },
        type: { type: String, enum: ["credit", "debit"], required: true },
        amountPaise: { type: Number, required: true },
        balanceAfterPaise: { type: Number, required: true },
        reason: { type: String, default: "" },
        meta: { type: Object, default: {} },
        at: { type: Date, required: true },
      },
    ],
  },
  { timestamps: true }
);

export const Wallet = mongoose.model("Wallet", walletSchema);

/**
 * One line of a wallet's ledger. Lines are only ever added.
 * `reference` names the thing that caused the line (a payment, a message), so the same cause
 * can never be charged or credited twice.
 */
const walletEntrySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    reference: { type: String, required: true },
    type: { type: String, enum: ["credit", "debit"], required: true },
    amountPaise: { type: Number, required: true, min: 1 },
    balanceAfterPaise: { type: Number, required: true, min: 0 },
    reason: { type: String, default: "" },
    meta: { type: Object, default: {} },
    at: { type: Date, required: true },
  },
  { timestamps: true }
);

walletEntrySchema.index({ userId: 1, reference: 1 }, { unique: true });
walletEntrySchema.index({ userId: 1, at: -1 });

const refuseChange = function () {
  throw new Error("Wallet ledger lines cannot be changed or removed");
};
for (const hook of ["updateOne", "updateMany", "findOneAndUpdate", "deleteOne", "deleteMany", "findOneAndDelete", "replaceOne"]) {
  walletEntrySchema.pre(hook, refuseChange);
}

export const WalletEntry = mongoose.model("WalletEntry", walletEntrySchema);
