import { FIELD_TYPES } from "../utils/constants";

export default function FieldPalette({ onAdd }) {
  return (
    <div className="space-y-2">
      {Object.values(FIELD_TYPES).map((type) => (
        <button
          key={type}
          onClick={() => onAdd(type)}
          className="border px-3 py-2 w-full"
        >
          Add {type}
        </button>
      ))}
    </div>
  );
}

