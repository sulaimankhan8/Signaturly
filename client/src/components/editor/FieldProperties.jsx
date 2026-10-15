import { FIELD_TYPES, TEXT_FORMATS, isRequired, labelOf, typeOf } from "./fieldTypes";
import { FieldIcon, UI } from "./icons";
import { formatFieldDate, parseFieldDate, toDateInputValue } from "../../utils/fieldDate";

const LABEL = "block text-[11px] font-black uppercase tracking-wider text-gray-300 mb-1.5";
const INPUT =
  "w-full min-h-[40px] px-3 bg-[#090a0f] border-2 border-white/20 rounded-xl text-white text-sm font-bold placeholder-gray-500 focus:outline-none focus:border-yellow-400 transition-colors";
const SMALL_BUTTON =
  "inline-flex items-center justify-center gap-1.5 min-h-[36px] px-3 rounded-lg border-2 border-white/20 bg-[#1e2235] hover:bg-[#282d47] text-white text-[11px] font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#000] transition-all disabled:opacity-40 disabled:pointer-events-none";

function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer select-none">
      <input type="checkbox" className="sr-only peer" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span
        aria-hidden="true"
        className="mt-0.5 w-10 h-6 shrink-0 rounded-full border-2 border-black bg-[#2a2f45] peer-checked:bg-emerald-500 peer-focus-visible:ring-2 peer-focus-visible:ring-yellow-400 relative transition-colors after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4 after:rounded-full after:bg-white after:border after:border-black after:transition-transform peer-checked:after:translate-x-4"
      />
      <span className="min-w-0">
        <span className="block text-xs font-black text-white">{label}</span>
        {hint && <span className="block text-[11px] text-gray-400 mt-0.5">{hint}</span>}
      </span>
    </label>
  );
}

/**
 * The settings of the selected field (or fields): who it is for, whether it must be filled,
 * what the signer is told, and the choices or format where the type has them.
 *
 * onChange(ids, patch, key) changes the given fields; `key` makes a run of keystrokes one undo step.
 */
export default function FieldProperties({
  selection,
  allFields,
  mode,
  participants = [],
  pageSizes = [],
  onChange,
  onDuplicate,
  onRemove,
  onCopyToAllPages,
  onAddRadioOption,
  onAlign,
  onClose,
}) {
  if (selection.length === 0) return null;

  const ids = selection.map((f) => f.id);
  const self = mode === "self";
  const assignable = participants.filter((p) => p.role !== "viewer");
  const ownerKey = mode === "template" ? "roleId" : "recipientId";

  const assignTo = (participantId) => {
    const participant = participants.find((p) => p.id === participantId);
    if (!participant) return;
    // Every option of a radio group belongs to the same person
    const groups = new Set(selection.filter((f) => f.type === "radio").map((f) => f.groupId));
    const targets = allFields.filter((f) => ids.includes(f.id) || (f.type === "radio" && groups.has(f.groupId))).map((f) => f.id);
    onChange(targets, mode === "template"
      ? { roleId: participant.id, roleName: participant.name, roleColor: participant.color }
      : { recipientId: participant.id, recipientName: participant.name, recipientEmail: participant.email, recipientColor: participant.color });
  };

  const ownerPicker = !self && assignable.length > 0 && (
    <div>
      <label className={LABEL} htmlFor="field-owner">
        Who fills it in
      </label>
      <select
        id="field-owner"
        className={INPUT}
        value={selection.every((f) => f[ownerKey] === selection[0][ownerKey]) ? selection[0][ownerKey] || "" : ""}
        onChange={(event) => assignTo(event.target.value)}
      >
        {!selection.every((f) => f[ownerKey] === selection[0][ownerKey]) && <option value="">Several people</option>}
        {assignable.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name || "Unnamed"}
          </option>
        ))}
      </select>
    </div>
  );

  if (selection.length > 1) {
    const requirable = selection.filter((f) => !typeOf(f).auto);
    const alignments = [
      ["left", "Align left edges", UI.alignLeft],
      ["center", "Centre horizontally", UI.alignCenter],
      ["right", "Align right edges", UI.alignRight],
      ["top", "Align top edges", UI.alignTop],
      ["middle", "Centre vertically", UI.alignMiddle],
      ["bottom", "Align bottom edges", UI.alignBottom],
    ];
    return (
      <Panel title={`${selection.length} fields selected`} onClose={onClose}>
        {ownerPicker}
        {!self && requirable.length > 0 && (
          <Toggle
            label="Required"
            hint="The signer must fill these in"
            checked={requirable.every(isRequired)}
            onChange={(checked) => onChange(requirable.map((f) => f.id), { required: checked })}
          />
        )}
        <div>
          <span className={LABEL}>Line up</span>
          <div className="grid grid-cols-6 gap-1.5">
            {alignments.map(([kind, words, drawIcon]) => (
              <button key={kind} type="button" onClick={() => onAlign(kind)} aria-label={words} title={words} className={`${SMALL_BUTTON} px-0`}>
                {drawIcon({ className: "w-4 h-4" })}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-gray-500 mt-1.5">Lines up fields on the same page as the first one picked.</p>
        </div>
        <Actions onDuplicate={() => onDuplicate(ids)} onRemove={() => onRemove(ids)} />
      </Panel>
    );
  }

  const field = selection[0];
  const config = typeOf(field);
  const change = (patch, key) => onChange([field.id], patch, key ? `${key}:${field.id}` : null);
  const group = field.type === "radio" ? allFields.filter((f) => f.type === "radio" && f.groupId === field.groupId) : [];
  const pageHeight = pageSizes[field.page - 1]?.height || 792;
  const fontPoints = Math.round((field.fontSizePercent || field.heightPercent * 0.55) * pageHeight);

  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          <FieldIcon type={field.type} className="w-4 h-4 text-yellow-400" />
          {labelOf({ type: field.type })}
          <span className="text-gray-500 font-bold normal-case tracking-normal">page {field.page}</span>
        </span>
      }
      onClose={onClose}
    >
      {ownerPicker}

      {config.auto && !self && (
        <p className="text-xs text-gray-300 bg-[#090a0f] border-2 border-white/10 rounded-xl p-3">
          {field.type === "date"
            ? "Filled in with the date the signer signs, by our clock. The signer cannot change it."
            : `Filled in with the signer's ${field.type === "name" ? "name" : "email address"} as you entered it. The signer cannot change it.`}
        </p>
      )}

      {!self && !config.auto && (
        <Toggle
          label={field.type === "checkbox" ? "Must be ticked" : field.type === "radio" ? "An answer is required" : "Required"}
          hint={field.type === "checkbox" ? "Leave off for an optional box" : field.type === "radio" ? "Applies to the whole group" : "The signer must fill this in"}
          checked={isRequired(field)}
          onChange={(checked) => onChange(field.type === "radio" ? group.map((f) => f.id) : [field.id], { required: checked })}
        />
      )}

      {(!self || field.type !== "date") && (
        <div>
          <label className={LABEL} htmlFor="field-label">
            {field.type === "radio" ? "Option name" : field.type === "checkbox" ? "What ticking it means" : "Label"}
          </label>
          <input
            id="field-label"
            className={INPUT}
            maxLength={80}
            value={field.label || ""}
            placeholder={field.type === "radio" ? `Option ${group.indexOf(field) + 1}` : FIELD_TYPES[field.type].label}
            onChange={(event) => change({ label: event.target.value }, "label")}
          />
          {!self && <p className="text-[11px] text-gray-500 mt-1.5">Shown to the signer, and read out by screen readers.</p>}
        </div>
      )}

      {field.type === "text" && !self && (
        <>
          <div>
            <label className={LABEL} htmlFor="field-placeholder">
              Hint inside the empty field
            </label>
            <input
              id="field-placeholder"
              className={INPUT}
              maxLength={80}
              value={field.placeholder || ""}
              placeholder="e.g. PAN number"
              onChange={(event) => change({ placeholder: event.target.value }, "placeholder")}
            />
          </div>
          <div>
            <label className={LABEL} htmlFor="field-format">
              Accepts
            </label>
            <select id="field-format" className={INPUT} value={field.format || ""} onChange={(event) => change({ format: event.target.value })}>
              {TEXT_FORMATS.map((format) => (
                <option key={format.value} value={format.value}>
                  {format.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL} htmlFor="field-prefill">
              Filled in by you (optional)
            </label>
            <input
              id="field-prefill"
              className={INPUT}
              maxLength={500}
              value={field.value || ""}
              onChange={(event) => change({ value: event.target.value, readOnly: event.target.value ? field.readOnly : false }, "value")}
            />
          </div>
          {field.value && (
            <Toggle label="Signer cannot change it" checked={Boolean(field.readOnly)} onChange={(checked) => change({ readOnly: checked })} />
          )}
        </>
      )}

      {field.type === "text" && self && (
        <div>
          <label className={LABEL} htmlFor="field-value">
            Text
          </label>
          <input id="field-value" className={INPUT} maxLength={500} value={field.value || ""} onChange={(event) => change({ value: event.target.value }, "value")} />
        </div>
      )}

      {field.type === "date" && self && (
        <div>
          <label className={LABEL} htmlFor="field-date">
            Date
          </label>
          <input
            id="field-date"
            type="date"
            className={INPUT}
            value={toDateInputValue(parseFieldDate(field.value))}
            onChange={(event) => {
              if (!event.target.value) return;
              const [year, month, day] = event.target.value.split("-").map(Number);
              change({ value: formatFieldDate(new Date(year, month - 1, day)) });
            }}
          />
        </div>
      )}

      {field.type === "checkbox" && self && (
        <Toggle label="Ticked" checked={Boolean(field.checked)} onChange={(checked) => change({ checked, value: checked })} />
      )}

      {field.type === "dropdown" && (
        <div>
          <span className={LABEL}>Choices</span>
          <div className="space-y-1.5">
            {(field.options || []).map((option, index) => (
              <div key={index} className="flex gap-1.5">
                <input
                  className={INPUT}
                  aria-label={`Choice ${index + 1}`}
                  maxLength={100}
                  value={option}
                  onChange={(event) => {
                    const options = [...field.options];
                    options[index] = event.target.value;
                    change({ options }, `option${index}`);
                  }}
                />
                <button
                  type="button"
                  className={`${SMALL_BUTTON} px-2`}
                  disabled={field.options.length <= 1}
                  aria-label={`Remove choice ${index + 1}`}
                  onClick={() => change({ options: field.options.filter((_, i) => i !== index) })}
                >
                  <UI.close className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className={`${SMALL_BUTTON} mt-2 w-full`}
            disabled={(field.options || []).length >= 50}
            onClick={() => change({ options: [...(field.options || []), `Option ${(field.options || []).length + 1}`] })}
          >
            <UI.plus className="w-3.5 h-3.5" /> Add a choice
          </button>
        </div>
      )}

      {field.type === "radio" && (
        <div>
          <span className={LABEL}>This question</span>
          <p className="text-xs text-gray-300">
            {group.length} option{group.length === 1 ? "" : "s"}. The signer picks one.
          </p>
          <button type="button" className={`${SMALL_BUTTON} mt-2 w-full`} disabled={group.length >= 20} onClick={() => onAddRadioOption(field)}>
            <UI.plus className="w-3.5 h-3.5" /> Add an option
          </button>
        </div>
      )}

      {config.text && (
        <div>
          <span className={LABEL}>Text size</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`${SMALL_BUTTON} w-10 px-0`}
              aria-label="Smaller text"
              onClick={() => change({ fontSizePercent: Math.max(6, fontPoints - 1) / pageHeight }, "font")}
            >
              −
            </button>
            <span className="w-14 text-center text-sm font-black text-white tabular-nums">{fontPoints} pt</span>
            <button
              type="button"
              className={`${SMALL_BUTTON} w-10 px-0`}
              aria-label="Larger text"
              onClick={() => change({ fontSizePercent: Math.min(48, fontPoints + 1) / pageHeight }, "font")}
            >
              +
            </button>
          </div>
        </div>
      )}

      <Actions
        onDuplicate={() => onDuplicate([field.id])}
        onCopyToAllPages={pageSizes.length > 1 && field.type !== "radio" ? () => onCopyToAllPages(field) : null}
        onRemove={() => onRemove([field.id])}
        pages={pageSizes.length}
      />
    </Panel>
  );
}

function Panel({ title, onClose, children }) {
  return (
    <section aria-label="Field settings" className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-black uppercase tracking-wider text-white">{title}</h3>
        <button type="button" onClick={onClose} aria-label="Close field settings" className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white">
          <UI.close className="w-4 h-4" />
        </button>
      </div>
      {children}
    </section>
  );
}

function Actions({ onDuplicate, onCopyToAllPages, onRemove, pages }) {
  return (
    <div className="pt-3 border-t-2 border-white/10 grid gap-2">
      <button type="button" className={SMALL_BUTTON} onClick={onDuplicate}>
        <UI.copy className="w-3.5 h-3.5" /> Duplicate
      </button>
      {onCopyToAllPages && (
        <button type="button" className={SMALL_BUTTON} onClick={onCopyToAllPages}>
          <UI.layers className="w-3.5 h-3.5" /> Copy to all {pages} pages
        </button>
      )}
      <button type="button" className={`${SMALL_BUTTON} hover:bg-red-600 hover:border-black`} onClick={onRemove}>
        <UI.trash className="w-3.5 h-3.5" /> Delete
      </button>
    </div>
  );
}
