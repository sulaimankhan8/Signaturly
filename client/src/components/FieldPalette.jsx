import { FIELD_TYPES } from "../utils/constants";

const FIELD_CONFIGS = [
  {
    type: FIELD_TYPES.SIGNATURE,
    label: "Signature",
    desc: "Draw or place e-signature",
    icon: (
      <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    ),
  },
  {
    type: FIELD_TYPES.INITIALS,
    label: "Initials",
    desc: "Compact initials stamp",
    icon: (
      <svg className="w-4 h-4 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h10M7 12h7m-7 5h10" />
      </svg>
    ),
  },
  {
    type: FIELD_TYPES.TEXT,
    label: "Text Field",
    desc: "Single-line or free text",
    icon: (
      <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
      </svg>
    ),
  },
  {
    type: FIELD_TYPES.DATE,
    label: "Date Field",
    desc: "Auto-fill or calendar picker",
    icon: (
      <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    type: FIELD_TYPES.CHECKBOX,
    label: "Checkbox",
    desc: "Optional or mandatory toggle",
    icon: (
      <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    type: FIELD_TYPES.RADIO,
    label: "Radio Option",
    desc: "Single-select choice circle",
    icon: (
      <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

export default function FieldPalette({ onAdd, activeColor = null }) {
  return (
    <div className="grid grid-cols-1 gap-2">
      {FIELD_CONFIGS.map((field) => (
        <button
          key={field.type}
          onClick={() => onAdd(field.type)}
          type="button"
          className="group w-full p-2.5 bg-white/5 hover:bg-white/10 active:scale-[0.98] border border-white/10 hover:border-white/20 rounded-xl text-left transition-all flex items-center justify-between shadow-sm"
        >
          <div className="flex items-center space-x-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center border shadow-inner transition-colors"
              style={{
                backgroundColor: activeColor ? `${activeColor}20` : "rgba(255,255,255,0.05)",
                borderColor: activeColor ? `${activeColor}60` : "rgba(255,255,255,0.1)",
              }}
            >
              {field.icon}
            </div>
            <div>
              <p className="text-xs font-bold text-white group-hover:text-red-400 transition-colors">
                {field.label}
              </p>
              <p className="text-[10px] text-gray-400">{field.desc}</p>
            </div>
          </div>

          <span className="text-xs font-bold text-gray-500 group-hover:text-white transition-colors">
            +
          </span>
        </button>
      ))}
    </div>
  );
}
