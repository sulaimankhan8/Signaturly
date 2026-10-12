import { useState } from "react";
import { adminApi, errorText } from "../api/admin.api.js";
import Dialog from "./ui/Dialog.jsx";
import { Button, Field, Input } from "./ui/basics.jsx";

const whole = (text) => Number.isInteger(Number(text)) && Number(text) >= 1;

/**
 * What is sent to change a pack of extra documents: only what is different now.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const addOnEditPayload = (form, pack) => {
  const values = { documents: Number(form.documents), priceInr: Number(form.priceInr), onSale: form.onSale };
  return Object.fromEntries(Object.entries(values).filter(([field, value]) => value !== pack[field]));
};

/**
 * Adds a pack of extra documents (a top-up), or changes one. A customer buys a pack with one
 * payment, at any time and on any plan, or adds it to a plan while buying the plan.
 */
export default function AddOnFormDialog({ open, pack, onClose, onSaved }) {
  const [form, setForm] = useState(() => (pack ? { id: pack.id, documents: String(pack.documents), priceInr: String(pack.priceInr), onSale: pack.onSale } : { id: "", documents: "", priceInr: "", onSale: true }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = (field) => (event) => setForm((old) => ({ ...old, [field]: event.target.type === "checkbox" ? event.target.checked : event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    if (!pack && !/^[a-z][a-z0-9_]{2,39}$/.test(form.id.trim())) return setError("The id is 3 to 40 lowercase letters, digits or underscores, starting with a letter.");
    if (!whole(form.documents)) return setError("Enter how many documents the pack adds.");
    if (!whole(form.priceInr)) return setError("The price is a whole number of rupees, 1 or more.");

    const payload = pack ? addOnEditPayload(form, pack) : { id: form.id.trim(), documents: Number(form.documents), priceInr: Number(form.priceInr), onSale: form.onSale };
    if (pack && Object.keys(payload).length === 0) return onClose();
    try {
      setBusy(true);
      setError("");
      const res = pack ? await adminApi.patch(`/admin/add-ons/${pack.id}`, payload) : await adminApi.post("/admin/add-ons", payload);
      onSaved(res.data.message);
    } catch (err) {
      setError(errorText(err, pack ? "The pack could not be changed." : "The pack could not be added."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      title={pack ? `Change the pack of ${pack.documents} documents` : "Add a top-up pack"}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="addon-form" busy={busy}>
            {busy ? "Saving…" : pack ? "Save changes" : "Add the pack"}
          </Button>
        </>
      }
    >
      <form id="addon-form" onSubmit={submit} className="space-y-4" noValidate>
        {error && (
          <p role="alert" className="notice notice-red">
            {error}
          </p>
        )}
        {!pack && (
          <Field label="Id" help="How payments name the pack, for example docs_25. It cannot be changed later.">
            <Input value={form.id} onChange={set("id")} maxLength={40} autoCapitalize="none" spellCheck={false} className="font-mono" data-autofocus />
          </Field>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Extra documents">
            <Input type="number" inputMode="numeric" min="1" step="1" value={form.documents} onChange={set("documents")} data-autofocus={pack ? true : undefined} />
          </Field>
          <Field label="Price in rupees" help="GST included. One payment.">
            <Input type="number" inputMode="numeric" min="1" step="1" value={form.priceInr} onChange={set("priceInr")} />
          </Field>
        </div>
        <label className="flex items-start gap-2 text-ink">
          <input type="checkbox" checked={form.onSale} onChange={set("onSale")} className="mt-0.5 h-4 w-4 shrink-0 accent-white" />
          <span>On sale: customers can buy it</span>
        </label>
        {pack && <p className="text-xs text-ink-faint">Documents already bought are not touched. A new size or price is what the next buyer gets.</p>}
      </form>
    </Dialog>
  );
}
