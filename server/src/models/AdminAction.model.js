import mongoose from "mongoose";

/**
 * What the operator did in the admin app, one line per action (plan tasks P2-17, AD-11).
 * Lines are only ever added, so the record of who granted a plan or opened an account's
 * documents cannot be tidied up afterwards.
 */
const adminActionSchema = new mongoose.Schema(
  {
    // Missing for a sign-in that was refused: nobody was signed in
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    adminEmail: { type: String, default: "" },
    // For example "user.plan_granted"; the first part names what was acted on
    action: { type: String, required: true, index: true },
    targetType: { type: String, default: "" },
    targetId: { type: String, default: "" },
    // One plain sentence, shown as it is in the admin app
    summary: { type: String, default: "" },
    meta: { type: Object, default: {} },
    ipAddress: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    at: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

const refuseChange = function () {
  throw new Error("Admin action records cannot be changed or removed");
};
for (const hook of ["updateOne", "updateMany", "findOneAndUpdate", "deleteOne", "deleteMany", "findOneAndDelete", "replaceOne"]) {
  adminActionSchema.pre(hook, refuseChange);
}
adminActionSchema.pre("save", function () {
  if (!this.isNew) refuseChange();
});

export const AdminAction = mongoose.model("AdminAction", adminActionSchema);
