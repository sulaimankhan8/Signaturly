import { memo } from "react";
import { isFilled, isRequired, isTicked, labelOf, problemWithValue, typeOf } from "./fieldTypes";
import { FieldIcon } from "./icons";
import { formatFieldDate, parseFieldDate, toDateInputValue } from "../../utils/fieldDate";

/**
 * A field as the person signing sees it: filled in right on the page.
 *
 * Every field is a real form control (a text box, a list, a checkbox or radio button, or a
 * button for a signature), named for screen readers and reachable with Tab in reading order.
 * Fields still needed are yellow, filled ones turn quiet, and the one "Next" points at is
 * marked. In `preview` the sender sees the same thing without being able to fill it in.
 *
 * words: the signer's wording { sign, initial, stamp, required, choose, dateSigned }
 */
function SignerField({ field, pageWidth, pageHeight, image, autoValue, current, preview = false, words, onActivate, onChange }) {
  const config = typeOf(field);
  // The signer's language names the field where the sender did not
  const nameOf = words.labelOf || labelOf;
  const left = field.xPercent * pageWidth;
  const top = field.yPercent * pageHeight;
  const width = Math.max(14, field.widthPercent * pageWidth);
  const height = Math.max(14, field.heightPercent * pageHeight);
  const fontSize = Math.max(9, field.fontSizePercent ? field.fontSizePercent * pageHeight : height * 0.55);

  const required = isRequired(field);
  const filled = config.image ? Boolean(image) : isFilled(field);
  const problem = problemWithValue(field);
  const name = `${nameOf(field)}${required ? `, ${words.required}` : ""}`;

  const frame = `absolute flex items-center justify-center rounded-[3px] transition-shadow ${
    current ? "ring-4 ring-red-500 ring-offset-2 ring-offset-white z-20" : "z-10"
  }`;
  const tone = filled
    ? "bg-white/60 border border-emerald-600"
    : required
      ? "bg-yellow-200/90 border-2 border-dashed border-black"
      : "bg-sky-100/80 border-2 border-dashed border-sky-700";

  const box = { left, top, width, height };
  const common = {
    id: `field-${field.id}`,
    "data-testid": `field-${field.type}`,
    "data-field": field.id,
  };

  const marker = required && !filled && !preview && (
    <span aria-hidden="true" className="absolute -top-2 -left-2 w-4 h-4 rounded-full bg-red-600 border-2 border-black text-white text-[10px] leading-[12px] font-black text-center">
      *
    </span>
  );

  if (config.image) {
    const prompt = field.type === "initials" ? words.initial : field.type === "stamp" ? words.stamp : words.sign;
    return (
      <div {...common} className={`${frame} ${filled ? "bg-transparent" : tone}`} style={box}>
        <button
          type="button"
          disabled={preview}
          onClick={() => onActivate?.(field)}
          aria-label={filled ? `${name}: ${words.change}` : `${prompt}: ${name}`}
          className="w-full h-full flex items-center justify-center overflow-hidden focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400 rounded-[3px]"
        >
          {image ? (
            <img src={image} alt="" draggable={false} className="w-full h-full object-contain pointer-events-none select-none" />
          ) : (
            <span className="flex items-center gap-1 px-1 font-black uppercase tracking-wider text-black truncate" style={{ fontSize: Math.min(13, Math.max(9, height * 0.3)) }}>
              <FieldIcon type={field.type} className="w-4 h-4 shrink-0" />
              <span className="truncate">{prompt}</span>
            </span>
          )}
        </button>
        {marker}
      </div>
    );
  }

  if (field.type === "checkbox" || field.type === "radio") {
    const ticked = isTicked(field);
    const round = field.type === "radio";
    return (
      <div {...common} className={frame} style={box}>
        <button
          type="button"
          role={round ? "radio" : "checkbox"}
          aria-checked={ticked}
          aria-label={name}
          disabled={preview}
          onClick={() => onChange?.(field, { checked: round ? true : !ticked, value: round ? true : !ticked })}
          onKeyDown={(event) => {
            if (event.key === " " || event.key === "Enter") {
              event.preventDefault();
              onChange?.(field, { checked: round ? true : !ticked, value: round ? true : !ticked });
            }
          }}
          className={`w-full h-full border-2 flex items-center justify-center focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400 ${round ? "rounded-full" : "rounded-[3px]"} ${
            ticked ? "border-black" : required ? "border-black bg-yellow-200" : "border-sky-800 bg-white"
          }`}
          style={{ background: ticked ? (round ? "#fff" : "#111") : undefined }}
        >
          {ticked &&
            (round ? (
              <span className="w-1/2 h-1/2 rounded-full bg-black" />
            ) : (
              <svg viewBox="0 0 24 24" className="w-3/4 h-3/4 text-white" fill="none" stroke="currentColor" strokeWidth={4} aria-hidden="true">
                <path d="M5 13l4 4L19 7" />
              </svg>
            ))}
        </button>
        {marker}
      </div>
    );
  }

  if (config.auto) {
    const shown = field.type === "date" ? autoValue || formatFieldDate() : autoValue || nameOf(field);
    return (
      <div {...common} className={`${frame} bg-white/60 border border-gray-400 justify-start px-1`} style={box} role="note" aria-label={`${nameOf(field)}: ${shown}`} title={field.type === "date" ? words.dateSigned : undefined}>
        <span className="truncate text-gray-900 font-medium" style={{ fontSize }}>
          {shown}
        </span>
      </div>
    );
  }

  if (field.type === "dropdown") {
    return (
      <div {...common} className={`${frame} ${tone}`} style={box}>
        <select
          aria-label={name}
          aria-required={required}
          disabled={preview}
          value={field.value || ""}
          onChange={(event) => onChange?.(field, { value: event.target.value })}
          className="w-full h-full bg-transparent text-gray-900 font-medium px-1 outline-none focus-visible:ring-4 focus-visible:ring-yellow-400 cursor-pointer"
          style={{ fontSize }}
        >
          <option value="">{field.label || words.choose}</option>
          {(field.options || []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        {marker}
      </div>
    );
  }

  // Text, in the format the sender asked for
  const dateInput = field.format === "date";
  return (
    <div {...common} className={`${frame} ${field.readOnly ? "bg-white/60 border border-gray-400" : tone}`} style={box}>
      <input
        type={dateInput ? "date" : field.format === "email" ? "email" : "text"}
        inputMode={field.format === "number" ? "decimal" : undefined}
        aria-label={name}
        aria-required={required}
        aria-invalid={Boolean(problem)}
        title={problem || field.label || undefined}
        readOnly={field.readOnly || preview}
        maxLength={500}
        placeholder={dateInput ? undefined : field.placeholder || field.label || words.enterText}
        value={dateInput ? toDateInputValue(parseFieldDate(field.value)) : field.value || ""}
        onChange={(event) => {
          if (dateInput) {
            if (!event.target.value) return onChange?.(field, { value: "" });
            const [year, month, day] = event.target.value.split("-").map(Number);
            onChange?.(field, { value: formatFieldDate(new Date(year, month - 1, day)) });
          } else onChange?.(field, { value: event.target.value });
        }}
        className={`w-full h-full bg-transparent text-gray-900 font-medium px-1 outline-none focus-visible:ring-4 focus-visible:ring-yellow-400 placeholder:text-gray-600 ${problem ? "text-red-700" : ""}`}
        style={{ fontSize }}
      />
      {marker}
    </div>
  );
}

export default memo(SignerField);
