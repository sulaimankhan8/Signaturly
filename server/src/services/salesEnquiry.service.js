import { SalesEnquiry } from "../models/SalesEnquiry.model.js";
import { PLANS, isPlan } from "../config/plans.js";
import { enqueueJob } from "../jobs/queue.js";
import { ApiError } from "../utils/ApiError.js";

/**
 * Enquiries from the "Contact sales" form: kept here, shown in the admin app, and sent on by
 * email to whoever follows them up (SALES_EMAIL), so one is never lost in an email program
 * the visitor did not have.
 */

// An enquiry as the admin app is told about it
const viewOf = (enquiry) => ({
  id: enquiry._id,
  name: enquiry.name,
  email: enquiry.email,
  company: enquiry.company,
  teamSize: enquiry.teamSize,
  message: enquiry.message,
  plan: enquiry.plan,
  planName: isPlan(enquiry.plan) ? PLANS[enquiry.plan].name : enquiry.plan,
  status: enquiry.status,
  note: enquiry.note,
  createdAt: enquiry.createdAt,
  updatedAt: enquiry.updatedAt,
});

/**
 * Keeps an enquiry and queues the email about it. The email is sent apart from the request:
 * an enquiry is taken even while email cannot be sent.
 */
export const createEnquiry = async ({ name, email, company = "", teamSize = "", message = "", plan = "" }) => {
  const enquiry = await SalesEnquiry.create({ name, email, company, teamSize, message, plan: isPlan(plan) ? plan : "" });
  await enqueueJob("email.sales_enquiry", { enquiryId: enquiry._id.toString() }, { idempotencyKey: `email.sales_enquiry:${enquiry._id}` }).catch((err) =>
    console.error("[Sales] Could not queue the email about an enquiry:", err.message)
  );
  return { id: enquiry._id };
};

export const listEnquiries = async ({ status, page, pageSize }) => {
  const match = status ? { status } : {};
  const [items, total, waiting] = await Promise.all([
    SalesEnquiry.find(match)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    SalesEnquiry.countDocuments(match),
    SalesEnquiry.countDocuments({ status: "new" }),
  ]);
  return { items: items.map(viewOf), total, page, pageSize, waiting };
};

/**
 * Marks how far an enquiry has got, and what was noted about it. Only what is in `changes`
 * is changed.
 */
export const updateEnquiry = async (id, changes, admin) => {
  const enquiry = await SalesEnquiry.findById(id);
  if (!enquiry) throw new ApiError(404, "Enquiry not found");

  const before = { status: enquiry.status, note: enquiry.note };
  if (changes.status !== undefined) enquiry.status = changes.status;
  if (changes.note !== undefined) enquiry.note = changes.note;
  if (enquiry.status === before.status && enquiry.note === before.note) throw new ApiError(400, "Nothing to change");

  enquiry.handledBy = admin.id;
  await enquiry.save();
  return { enquiry: viewOf(enquiry), before };
};

// For the email job: the enquiry as it is now, or null when it is gone
export const enquiryForEmail = async (id) => {
  const enquiry = await SalesEnquiry.findById(id).lean();
  return enquiry ? viewOf(enquiry) : null;
};
