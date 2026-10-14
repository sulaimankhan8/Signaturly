import { cloneElement, useId } from "react";
import { Link } from "react-router-dom";

/**
 * The small pieces every screen is built from. Each is written once, here.
 *
 * Colour has one meaning throughout: red is a failure or a destructive action, amber wants
 * attention, green is finished or healthy, blue is under way, grey is neutral.
 *
 * The shapes are soft: hairline edges, rounded corners, a faint light from the top, bold
 * small capitals for labels. The one main action on a screen is the red accent; a
 * destructive one is red too, but outlined, so the two are never mistaken.
 */

const cx = (...parts) => parts.filter(Boolean).join(" ");

const BUTTON = {
  primary: "bg-gradient-to-b from-accent-hover to-accent text-white border-accent-deep/60 shadow-accent hover:brightness-110",
  secondary: "bg-surface-raised text-ink border-edge shadow-soft-sm hover:bg-[#1f2431] hover:border-white/20",
  danger: "bg-red-500/10 text-red-200 border-red-500/50 hover:bg-red-500/20 hover:text-white",
  quiet: "text-ink-muted border-transparent hover:text-ink hover:bg-white/5",
};
const PRESS = "transition active:scale-[0.98] motion-reduce:transform-none";
const BUTTON_SIZE = { md: "h-9 px-3.5 text-sm", sm: "h-8 px-3 text-xs" };
const buttonClass = (variant, size, className) =>
  cx("inline-flex items-center justify-center gap-2 rounded-lg border font-bold whitespace-nowrap disabled:opacity-50 disabled:pointer-events-none", PRESS, BUTTON[variant], BUTTON_SIZE[size], className);

export function Button({ variant = "secondary", size = "md", busy = false, disabled = false, className, children, type = "button", ...rest }) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} disabled={busy || disabled} aria-busy={busy || undefined} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({ variant = "secondary", size = "md", className, children, ...rest }) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}

const TONE = {
  neutral: "bg-white/5 text-ink-muted border-white/10",
  green: "bg-emerald-400/10 text-emerald-300 border-emerald-400/30",
  amber: "bg-amber-400/10 text-amber-300 border-amber-400/30",
  red: "bg-red-500/10 text-red-300 border-red-500/30",
  blue: "bg-sky-400/10 text-sky-300 border-sky-400/30",
};
const DOT = { neutral: "bg-ink-faint", green: "bg-emerald-400", amber: "bg-amber-400", red: "bg-red-400", blue: "bg-sky-400" };

export function Badge({ tone = "neutral", children }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide whitespace-nowrap", TONE[tone])}>
      <span className={cx("w-1.5 h-1.5 rounded-full", DOT[tone])} aria-hidden="true" />
      {children}
    </span>
  );
}

// An outline icon from a Heroicons path
export function Icon({ d, className = "w-5 h-5" }) {
  return (
    <svg className={cx("shrink-0", className)} fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

const PEN = "M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10";

// The mark, as it stands at the top of the frame and of the sign-in screen
export function Brand() {
  return (
    <div className="flex items-center gap-3">
      <span className="grid place-items-center w-10 h-10 rounded-xl bg-gradient-to-br from-accent-hover to-accent-deep text-white shadow-accent ring-1 ring-white/10" aria-hidden="true">
        <Icon d={PEN} className="w-5 h-5" />
      </span>
      <span className="leading-tight">
        <span className="block font-display text-lg font-bold tracking-tight text-ink">
          Pact<span className="text-accent">Doc</span>
        </span>
        <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-ink-faint">Admin panel</span>
      </span>
    </div>
  );
}

export function Card({ title, note, actions, children, className, flush = false }) {
  return (
    <section className={cx("panel", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 px-5 sm:px-6 pt-5 pb-4 border-b border-line">
          <div>
            <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
            {note && <p className="text-sm text-ink-muted mt-0.5">{note}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={flush ? "" : "p-5 sm:p-6"}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, note, back, actions, children }) {
  return (
    <div className="space-y-3">
      {back && (
        <Link to={back.to} className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-ink-muted hover:text-ink">
          <span aria-hidden="true">←</span> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink break-words">{title}</h1>
          {note && <div className="text-sm text-ink-muted mt-1">{note}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

// Each tile's colour: a wash from its top corner, its icon chip, and a rule along its foot
const STAT_TONE = {
  red: { wash: "from-rose-500/[0.13]", chip: "bg-rose-500", rule: "via-rose-500/60" },
  blue: { wash: "from-blue-500/[0.13]", chip: "bg-blue-500", rule: "via-blue-500/60" },
  green: { wash: "from-emerald-500/[0.13]", chip: "bg-emerald-500", rule: "via-emerald-500/60" },
  amber: { wash: "from-amber-500/[0.13]", chip: "bg-amber-500", rule: "via-amber-500/60" },
  violet: { wash: "from-violet-500/[0.13]", chip: "bg-violet-500", rule: "via-violet-500/60" },
  sky: { wash: "from-sky-500/[0.13]", chip: "bg-sky-500", rule: "via-sky-500/60" },
};

/**
 * The change against the period before, as a pill. Green when it moved the way that is
 * good, red when it did not; the arrow says which way it went, so colour is never alone.
 */
export function Delta({ value, upIsGood = true }) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const flat = Math.abs(value) < 0.05;
  const good = flat ? null : value > 0 === upIsGood;
  const tone = good === null ? "bg-white/5 text-ink-muted border-white/10" : good ? "bg-emerald-400/10 text-emerald-300 border-emerald-400/25" : "bg-rose-400/10 text-rose-300 border-rose-400/25";
  const arrow = flat ? "→" : value > 0 ? "↗" : "↘";
  const shown = Math.abs(value) >= 1000 ? `${Math.round(Math.abs(value)).toLocaleString("en-IN")}%` : `${Math.abs(value).toFixed(Math.abs(value) >= 100 ? 0 : 1)}%`;
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold tabular-nums", tone)}>
      <span aria-hidden="true">{arrow}</span>
      <span className="sr-only">{flat ? "No change" : value > 0 ? "Up" : "Down"}</span>
      {shown}
    </span>
  );
}

/**
 * One figure with what it is and, underneath, how it moved or what it is measured against.
 * `tone` and `icon` give it a colour and a mark; `delta` is a percentage against the period
 * before, and `deltaNote` names that period.
 */
export function StatCard({ label, value, note, to, tone, icon, delta, upIsGood = true, deltaNote }) {
  const look = STAT_TONE[tone];
  const body = (
    <>
      {look && <span className={cx("absolute inset-0 bg-gradient-to-br to-transparent to-60% pointer-events-none", look.wash)} aria-hidden="true" />}
      {look && <span className={cx("absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent to-transparent", look.rule)} aria-hidden="true" />}
      <div className="relative flex items-start justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted">{label}</p>
        {look && icon && (
          <span className={cx("grid place-items-center w-8 h-8 rounded-lg text-white shadow-soft-sm shrink-0 -mt-1", look.chip)}>
            <Icon d={icon} className="w-4 h-4" />
          </span>
        )}
      </div>
      <p className="relative font-display text-[28px] leading-none font-bold tracking-tight text-ink mt-2">{value}</p>
      <div className="relative flex flex-wrap items-center gap-2 mt-3 min-h-[22px]">
        <Delta value={delta} upIsGood={upIsGood} />
        {(note || (deltaNote && Number.isFinite(delta))) && <span className="text-xs text-ink-faint">{Number.isFinite(delta) && deltaNote ? deltaNote : note}</span>}
      </div>
    </>
  );
  const className = "panel relative overflow-hidden block p-5 xl:p-4 2xl:p-5";
  return to ? (
    <Link to={to} className={cx(className, "transition hover:-translate-y-0.5 hover:border-white/20 motion-reduce:transform-none")}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

/**
 * A row of choices where one is on: periods, views. Each is a button that says whether it is
 * pressed. `options` is [[value, label, title?]].
 */
export function Segmented({ options, value, onChange, label, size = "md" }) {
  return (
    <div role="group" aria-label={label} className="inline-flex items-center gap-0.5 rounded-xl border border-edge bg-surface-panel p-1">
      {options.map(([id, text, title]) => (
        <button
          key={id}
          type="button"
          title={title}
          aria-pressed={value === id}
          onClick={() => onChange(id)}
          className={cx(
            "rounded-lg font-bold transition",
            size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-xs",
            value === id ? "bg-white/10 text-ink shadow-soft-sm ring-1 ring-white/10" : "text-ink-faint hover:text-ink"
          )}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

export function Skeleton({ className = "h-4 w-24" }) {
  return <span className={cx("skeleton inline-block rounded bg-white/10 align-middle", className)} aria-hidden="true" />;
}

export function EmptyState({ children }) {
  return <p className="text-sm text-ink-muted text-center py-10 px-4">{children}</p>;
}

// Something could not be loaded. Says what, and offers to try again.
export function ErrorNote({ children, onRetry }) {
  return (
    <div role="alert" className="notice notice-red flex flex-wrap items-center justify-between gap-3">
      <span>{children}</span>
      {onRetry && (
        <Button size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

// Label and value pairs, for the detail pages
export function Details({ rows }) {
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-[minmax(0,11rem)_1fr] gap-x-6 gap-y-2.5 text-sm">
      {rows
        .filter((row) => row && row[1] !== undefined && row[1] !== null && row[1] !== "")
        .map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-ink-muted">{label}</dt>
            <dd className="text-ink min-w-0 break-words">{value}</dd>
          </div>
        ))}
    </dl>
  );
}

// Ids, hashes and addresses: the only text set in the monospace face
export function Mono({ children, title }) {
  return (
    <span className="font-mono text-xs text-ink-muted break-all" title={title}>
      {children}
    </span>
  );
}

const fieldClass = "h-9 rounded-lg bg-surface-panel border border-edge px-3 text-sm text-ink placeholder:text-ink-faint transition focus:border-accent/70 focus:ring-2 focus:ring-accent/20 focus:outline-none disabled:opacity-60";

// Full width, unless the caller names a width of its own
const widthOf = (className) => (/(^|\s)w-/.test(className || "") ? "" : "w-full");

export function Input({ className, ...rest }) {
  return <input className={cx(fieldClass, widthOf(className), className)} {...rest} />;
}

export function Select({ className, children, ...rest }) {
  return (
    <select className={cx(fieldClass, widthOf(className), "pr-8", className)} {...rest}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...rest }) {
  return <textarea className={cx(fieldClass, widthOf(className), "h-auto py-2 leading-relaxed", className)} {...rest} />;
}

/**
 * A labelled control, with a line of help or of error underneath. It takes one control as its
 * child. The label names the control and nothing else; the help and the error describe it.
 */
export function Field({ label, help, error, children, className }) {
  const id = useId();
  const noteId = `${id}-note`;
  const hasNote = Boolean(error || help);
  return (
    <div className={cx("text-sm", className)}>
      <label htmlFor={id} className="block text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-1.5">
        {label}
      </label>
      {cloneElement(children, { id, "aria-describedby": hasNote ? noteId : undefined, "aria-invalid": error ? true : undefined })}
      {error ? (
        <p id={noteId} className="text-xs text-red-300 mt-1.5" role="alert">
          {error}
        </p>
      ) : (
        help && (
          <p id={noteId} className="text-xs text-ink-faint mt-1.5">
            {help}
          </p>
        )
      )}
    </div>
  );
}

// A row of filters above a table
export function Filters({ children }) {
  return <div className="flex flex-wrap items-end gap-3">{children}</div>;
}

// A filter that came from a link ("documents of this account"), with a way to drop it
export function FilterChip({ children, onClear }) {
  return (
    <span className="inline-flex items-center gap-2 h-9 rounded-full border border-edge bg-white/5 pl-3.5 pr-1 text-sm text-ink">
      {children}
      <button type="button" onClick={onClear} className="h-7 w-7 rounded-full text-ink-muted hover:text-ink hover:bg-white/10" aria-label="Remove this filter">
        <span aria-hidden="true">×</span>
      </button>
    </span>
  );
}
