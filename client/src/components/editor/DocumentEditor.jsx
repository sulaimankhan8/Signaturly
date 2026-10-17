import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DocumentCanvas from "./DocumentCanvas";
import EditorField from "./EditorField";
import FieldPalette from "./FieldPalette";
import FieldProperties from "./FieldProperties";
import { FIELD_TYPES, PALETTE, clamp, clampToPage, labelOf, makeField, newFieldId, isRequired, sortForReading, typeOf } from "./fieldTypes";
import { FieldIcon, UI } from "./icons";
import { saveStatusText } from "./useAutosave";
import EditorHeader from "./EditorHeader";
import EditorSidebar from "./EditorSidebar";
import EditorGhost from "./EditorGhost";

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2];
// How close (in screen pixels) an edge has to come to another before it snaps to it
const SNAP_PX = 5;
// A press that moves less than this is a click, not a drag
const DRAG_START_PX = 4;
const SELF_COLOR = "#ef4444";

const isTypingTarget = (target) =>
  target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/**
 * The document editor used for signing your own document ("self"), placing fields for the
 * people a document is sent to ("send"), and laying out a template's roles ("template").
 *
 * The page that uses it owns the fields (with useFieldHistory) and saves them; the editor
 * handles everything about placing, moving, sizing and setting them up.
 *
 * Mouse: drag a field type onto a page, or click it and click on the page. Drag fields to move
 * them (onto another page too), drag a corner to resize, Shift-click to pick several.
 * Keyboard: Tab between fields, arrows nudge (Shift for bigger steps), Delete removes,
 * Ctrl+Z / Ctrl+Shift+Z undo and redo, Ctrl+C / Ctrl+V copy, Ctrl+D duplicates, Ctrl+A picks
 * every field on the page, Escape lets go.
 */
export default function DocumentEditor({
  mode,
  fileUrl,
  title,
  subtitle,
  steps = null,
  participants = [],
  history,
  saveStatus = null,
  autoValues = {},
  signatureImages = {},
  onRequestSignature,
  sidebarTop = null,
  primaryAction,
  secondaryAction = null,
  onBack,
  backLabel = "Back",
  notice = null,
  announce: externalAnnounce,
}) {
  const { fields, setFields, undo, redo, canUndo, canRedo } = history;
  const ownerKey = mode === "template" ? "roleId" : "recipientId";
  const assignable = useMemo(() => participants.filter((p) => p.role !== "viewer"), [participants]);

  const [activeId, setActiveId] = useState(assignable[0]?.id || null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [armedType, setArmedType] = useState(null);
  const [zoom, setZoom] = useState("fit");
  const [scale, setScale] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSizes, setPageSizes] = useState([]);
  const [preview, setPreview] = useState(null);
  const [guides, setGuides] = useState([]);
  const [ghost, setGhost] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [thumbnails, setThumbnails] = useState(true);
  const [message, setMessage] = useState("");

  const canvasRef = useRef(null);
  const editorRef = useRef(null);
  const sessionRef = useRef(null);
  // The press in progress on a field: whether it has turned into a drag, and whether the field
  // was already the one picked when it began (only then does a click fill it in)
  const draggedRef = useRef({ moved: false, wasPicked: false });
  const pointerFocusRef = useRef(false);
  const clipboardRef = useRef([]);
  const frameRef = useRef(0);
  const previewRef = useRef(null);

  // The latest of everything, for handlers that stay the same between renders
  const live = useRef({});
  live.current = { fields, selectedIds, armedType, pageSizes, currentPage, activeId, mode, scale, participants };

  const announce = useCallback(
    (words) => {
      setMessage(words);
      externalAnnounce?.(words);
    },
    [externalAnnounce]
  );

  // Keep a real person active as recipients change
  useEffect(() => {
    if (mode === "self") return;
    if (!assignable.some((p) => p.id === activeId)) setActiveId(assignable[0]?.id || null);
  }, [assignable, activeId, mode]);

  const participantOf = useCallback((field) => participants.find((p) => p.id === field[ownerKey]) || null, [participants, ownerKey]);

  const colorOf = useCallback(
    (field) => {
      if (mode === "self") return SELF_COLOR;
      return participantOf(field)?.color || field.recipientColor || field.roleColor || "#3b82f6";
    },
    [mode, participantOf]
  );

  const ownerFields = (participant) =>
    mode === "template"
      ? { roleId: participant.id, roleName: participant.name, roleColor: participant.color }
      : { recipientId: participant.id, recipientName: participant.name, recipientEmail: participant.email || "", recipientColor: participant.color };

  // ---- placing ----

  const placeField = useCallback(
    (type, point) => {
      const { pageSizes: sizes, activeId: active, participants: people, mode: currentMode } = live.current;
      const participant = people.find((p) => p.id === active);
      if (currentMode !== "self" && !participant) {
        announce("Add a signer before placing fields");
        return;
      }
      const owner = currentMode === "self" ? {} : ownerFields(participant);
      const pageSize = sizes[point.page - 1];
      const first = makeField(type, { ...point, pageSize, owner, mode: currentMode });
      const created = [first];

      // A radio group starts with two options, one under the other
      if (type === "radio") {
        first.label = "Option 1";
        const gap = first.heightPercent * 1.9;
        const second = { ...first, id: newFieldId(), label: "Option 2", yPercent: clamp(first.yPercent + gap, 0, 1 - first.heightPercent) };
        created.push(second);
      }

      setFields((previous) => [...previous, ...created]);
      setSelectedIds([first.id]);
      announce(`${FIELD_TYPES[type].label} added on page ${point.page}`);
      // Focus the new field so the keyboard carries on from it
      requestAnimationFrame(() => document.getElementById(`field-${first.id}`)?.focus({ preventScroll: true }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setFields, announce, mode]
  );

  const placeAtCentre = useCallback(
    (type) => {
      const point = canvasRef.current?.visibleCentre();
      if (point) placeField(type, point);
      setDrawerOpen(false);
    },
    [placeField]
  );

  // ---- changing ----

  const changeFields = useCallback(
    (ids, patch, key = null) => {
      setFields(
        (previous) => previous.map((field) => (ids.includes(field.id) ? clampToPage({ ...field, ...(typeof patch === "function" ? patch(field) : patch) }) : field)),
        key
      );
    },
    [setFields]
  );

  const removeFields = useCallback(
    (ids) => {
      setFields((previous) => previous.filter((field) => !ids.includes(field.id)));
      setSelectedIds((previous) => previous.filter((id) => !ids.includes(id)));
      announce(ids.length === 1 ? "Field deleted" : `${ids.length} fields deleted`);
    },
    [setFields, announce]
  );

  // Copies with new ids; copied radio options stay together as a new group of their own
  const cloneAll = (list, change) => {
    const groups = new Map();
    return list.map((field) => {
      const copy = { ...field, id: newFieldId(), ...change(field) };
      if (field.type === "radio") {
        if (!groups.has(field.groupId)) groups.set(field.groupId, newFieldId());
        copy.groupId = groups.get(field.groupId);
      }
      return clampToPage(copy);
    });
  };

  const duplicateFields = useCallback(
    (ids) => {
      const originals = live.current.fields.filter((f) => ids.includes(f.id));
      const copies = cloneAll(originals, (f) => ({ xPercent: f.xPercent + 0.02, yPercent: f.yPercent + 0.02 }));
      setFields((previous) => [...previous, ...copies]);
      setSelectedIds(copies.map((f) => f.id));
      announce(copies.length === 1 ? "Field duplicated" : `${copies.length} fields duplicated`);
    },
    [setFields, announce]
  );

  const copyToAllPages = useCallback(
    (field) => {
      const count = live.current.pageSizes.length;
      const copies = [];
      for (let page = 1; page <= count; page++) {
        if (page !== field.page) copies.push(clampToPage({ ...field, id: newFieldId(), page }));
      }
      setFields((previous) => [...previous, ...copies]);
      announce(`Copied to ${copies.length} more page${copies.length === 1 ? "" : "s"}`);
    },
    [setFields, announce]
  );

  const addRadioOption = useCallback(
    (field) => {
      const group = live.current.fields.filter((f) => f.type === "radio" && f.groupId === field.groupId);
      const last = group.reduce((lowest, f) => (f.yPercent > lowest.yPercent ? f : lowest), field);
      const gap = last.heightPercent * 1.9;
      const below = last.yPercent + gap <= 1 - last.heightPercent;
      const option = clampToPage({
        ...last,
        id: newFieldId(),
        label: `Option ${group.length + 1}`,
        checked: false,
        xPercent: below ? last.xPercent : last.xPercent + last.widthPercent * 2,
        yPercent: below ? last.yPercent + gap : last.yPercent,
      });
      setFields((previous) => [...previous, option]);
      setSelectedIds([option.id]);
      announce(`Option ${group.length + 1} added`);
    },
    [setFields, announce]
  );

  const alignFields = useCallback(
    (kind) => {
      const { fields: all, selectedIds: ids } = live.current;
      const picked = ids.map((id) => all.find((f) => f.id === id)).filter(Boolean);
      const anchor = picked[0];
      if (!anchor) return;
      const samePage = picked.filter((f) => f.page === anchor.page).map((f) => f.id);
      changeFields(samePage, (f) => {
        switch (kind) {
          case "left":
            return { xPercent: anchor.xPercent };
          case "right":
            return { xPercent: anchor.xPercent + anchor.widthPercent - f.widthPercent };
          case "center":
            return { xPercent: anchor.xPercent + anchor.widthPercent / 2 - f.widthPercent / 2 };
          case "top":
            return { yPercent: anchor.yPercent };
          case "bottom":
            return { yPercent: anchor.yPercent + anchor.heightPercent - f.heightPercent };
          default:
            return { yPercent: anchor.yPercent + anchor.heightPercent / 2 - f.heightPercent / 2 };
        }
      });
    },
    [changeFields]
  );

  const duplicateOne = useCallback((field) => duplicateFields([field.id]), [duplicateFields]);
  const removeOne = useCallback((field) => removeFields([field.id]), [removeFields]);

  const changeValue = useCallback((field, patch) => changeFields([field.id], patch, `value:${field.id}`), [changeFields]);

  // In the self editor a click on a field fills it in
  const activateField = useCallback(
    (field) => {
      if (live.current.mode !== "self") return;
      if (typeOf(field).image) onRequestSignature?.(field.type);
      else if (field.type === "checkbox") changeFields([field.id], { checked: !field.checked, value: !field.checked });
    },
    [onRequestSignature, changeFields]
  );

  // ---- pointer: moving and resizing fields ----

  const onFieldPointerDown = useCallback(
    (event, field, handle) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      pointerFocusRef.current = true;
      setTimeout(() => (pointerFocusRef.current = false), 0);

      const { selectedIds: ids, fields: all, mode: currentMode } = live.current;
      const additive = event.shiftKey || event.metaKey || event.ctrlKey;
      let selection;
      if (additive) {
        selection = ids.includes(field.id) ? ids.filter((id) => id !== field.id) : [...ids, field.id];
      } else if (ids.includes(field.id)) {
        selection = [...ids.filter((id) => id !== field.id), field.id];
      } else {
        selection = [field.id];
      }
      const wasPicked = ids.length === 1 && ids[0] === field.id;
      setSelectedIds(selection);
      if (!selection.includes(field.id)) return;
      if (currentMode !== "self" && field[ownerKey]) setActiveId(field[ownerKey]);

      const rect = canvasRef.current?.pageRect(field.page);
      if (!rect) return;
      const moving = handle === "move" ? all.filter((f) => selection.includes(f.id) && f.page === field.page) : [field];

      sessionRef.current = {
        kind: handle === "move" ? "move" : "resize",
        handle,
        startX: event.clientX,
        startY: event.clientY,
        rect,
        primary: field,
        origin: new Map(moving.map((f) => [f.id, f])),
        grabX: event.clientX - (rect.left + field.xPercent * rect.width),
        grabY: event.clientY - (rect.top + field.yPercent * rect.height),
        moved: false,
        // A plain press inside a group that does not drag picks just this field, when it is let go
        narrowTo: !additive && ids.length > 1 && ids.includes(field.id) ? field.id : null,
      };
      draggedRef.current = { moved: false, wasPicked };
    },
    [ownerKey]
  );

  // Snaps the moving field's edges and middle to other fields on the page and to the page's middle
  const snap = (box, page, rect, ignore, enabled) => {
    if (!enabled) return { box, lines: [] };
    const others = live.current.fields.filter((f) => f.page === page && !ignore.has(f.id));
    const xs = [0.5];
    const ys = [0.5];
    for (const f of others) {
      xs.push(f.xPercent, f.xPercent + f.widthPercent / 2, f.xPercent + f.widthPercent);
      ys.push(f.yPercent, f.yPercent + f.heightPercent / 2, f.yPercent + f.heightPercent);
    }
    const lines = [];
    const best = (edges, targets, size) => {
      let found = null;
      for (const [offset, edge] of edges) {
        for (const target of targets) {
          const distance = Math.abs(edge - target) * size;
          if (distance <= SNAP_PX && (!found || distance < found.distance)) found = { distance, shift: target - edge, at: target, offset };
        }
      }
      return found;
    };
    const next = { ...box };
    const x = best(
      [[0, box.xPercent], [0.5, box.xPercent + box.widthPercent / 2], [1, box.xPercent + box.widthPercent]],
      xs,
      rect.width
    );
    if (x) {
      next.xPercent += x.shift;
      lines.push({ page, vertical: true, at: x.at });
    }
    const y = best(
      [[0, box.yPercent], [0.5, box.yPercent + box.heightPercent / 2], [1, box.yPercent + box.heightPercent]],
      ys,
      rect.height
    );
    if (y) {
      next.yPercent += y.shift;
      lines.push({ page, vertical: false, at: y.at });
    }
    return { box: next, lines };
  };

  useEffect(() => {
    const onMove = (event) => {
      const session = sessionRef.current;

      // A field type following the pointer after its palette button was clicked
      if (!session) return;

      // The page may have scrolled since the press; movement is measured against where it is now
      const rectNow = session.kind === "palette" ? null : canvasRef.current?.pageRect(session.primary.page) || session.rect;
      const dx = event.clientX - session.startX - (rectNow ? rectNow.left - session.rect.left : 0);
      const dy = event.clientY - session.startY - (rectNow ? rectNow.top - session.rect.top : 0);
      if (!session.moved) {
        if (Math.hypot(dx, dy) < DRAG_START_PX) return;
        if (session.kind === "palette" && session.pointerType === "touch") return;
        session.moved = true;
        draggedRef.current = { ...draggedRef.current, moved: true };
      }

      if (session.kind === "palette") {
        if (!session.ghostShown) {
          session.ghostShown = true;
          setGhost({ type: session.type, x: event.clientX, y: event.clientY });
        }
        return;
      }

      // Near the top or bottom of the document while dragging, it scrolls
      const scroller = editorRef.current?.querySelector("[data-document-scroller]");
      if (scroller) {
        const box = scroller.getBoundingClientRect();
        if (event.clientY < box.top + 40) scroller.scrollTop -= 14;
        else if (event.clientY > box.bottom - 40) scroller.scrollTop += 14;
      }

      cancelAnimationFrame(frameRef.current);
      const { clientX, clientY, altKey } = event;
      const rect = rectNow;
      frameRef.current = requestAnimationFrame(() => {
        const next = new Map();
        let lines = [];

        if (session.kind === "move") {
          const single = session.origin.size === 1;
          const over = single ? canvasRef.current?.pagePoint(clientX, clientY) : null;

          if (single && over && over.page !== session.primary.page) {
            // Carried onto another page
            const f = session.primary;
            const box = clampToPage({
              ...f,
              page: over.page,
              xPercent: (clientX - session.grabX - over.rect.left) / over.rect.width,
              yPercent: (clientY - session.grabY - over.rect.top) / over.rect.height,
            });
            const snapped = snap(box, over.page, over.rect, new Set([f.id]), !altKey);
            next.set(f.id, clampToPage(snapped.box));
            lines = snapped.lines;
          } else {
            let ddx = dx / rect.width;
            let ddy = dy / rect.height;
            // The whole group stays on the page
            for (const f of session.origin.values()) {
              ddx = clamp(ddx, -f.xPercent, 1 - f.xPercent - f.widthPercent);
              ddy = clamp(ddy, -f.yPercent, 1 - f.yPercent - f.heightPercent);
            }
            const primary = session.origin.get(session.primary.id);
            const moved = { ...primary, xPercent: primary.xPercent + ddx, yPercent: primary.yPercent + ddy };
            const snapped = snap(moved, primary.page, rect, new Set(session.origin.keys()), !altKey);
            const sdx = snapped.box.xPercent - primary.xPercent;
            const sdy = snapped.box.yPercent - primary.yPercent;
            for (const f of session.origin.values()) {
              next.set(f.id, clampToPage({ ...f, xPercent: f.xPercent + sdx, yPercent: f.yPercent + sdy }));
            }
            lines = snapped.lines;
          }
        } else {
          const f = session.primary;
          const { handle } = session;
          const ddx = dx / rect.width;
          const ddy = dy / rect.height;
          const minW = 12 / rect.width;
          const minH = 12 / rect.height;
          let { xPercent: x, yPercent: y, widthPercent: w, heightPercent: h } = f;
          if (handle.includes("e")) w = clamp(f.widthPercent + ddx, minW, 1 - f.xPercent);
          if (handle.includes("s")) h = clamp(f.heightPercent + ddy, minH, 1 - f.yPercent);
          if (handle.includes("w")) {
            const right = f.xPercent + f.widthPercent;
            x = clamp(f.xPercent + ddx, 0, right - minW);
            w = right - x;
          }
          if (handle.includes("n")) {
            const bottom = f.yPercent + f.heightPercent;
            y = clamp(f.yPercent + ddy, 0, bottom - minH);
            h = bottom - y;
          }
          // Ticks and radio buttons stay square on screen
          if (typeOf(f).square) {
            const side = Math.max(w * rect.width, h * rect.height);
            w = Math.min(side / rect.width, 1 - x);
            h = Math.min(side / rect.height, 1 - y);
          }
          next.set(f.id, { ...f, xPercent: x, yPercent: y, widthPercent: w, heightPercent: h });
        }

        previewRef.current = next;
        setPreview(next);
        setGuides(lines);
      });
    };

    const onUp = (event) => {
      const session = sessionRef.current;
      sessionRef.current = null;
      cancelAnimationFrame(frameRef.current);
      if (!session) return;

      if (session.kind === "palette") {
        setGhost(null);
        if (session.moved) {
          const point = canvasRef.current?.pagePoint(event.clientX, event.clientY);
          if (point) placeField(session.type, point);
        } else {
          const next = live.current.armedType === session.type ? null : session.type;
          setArmedType(next);
          setGhost(next && session.pointerType !== "touch" ? { type: next, x: event.clientX, y: event.clientY } : null);
          if (session.pointerType === "touch") setDrawerOpen(false);
        }
      } else if (!session.moved && session.narrowTo) {
        setSelectedIds([session.narrowTo]);
      } else if (session.moved) {
        const moved = previewRef.current;
        previewRef.current = null;
        setPreview(null);
        setGuides([]);
        if (moved && moved.size > 0) {
          setFields((previous) => previous.map((f) => (moved.has(f.id) ? clampToPage({ ...f, ...moved.get(f.id) }) : f)));
        }
      }
      setTimeout(() => (draggedRef.current = { moved: false, wasPicked: false }), 0);
    };

    const onCancel = () => {
      sessionRef.current = null;
      previewRef.current = null;
      setPreview(null);
      setGuides([]);
      setGhost(null);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
  }, [placeField, setFields]);

  const onPalettePointerDown = useCallback((event, type) => {
    if (event.button !== 0) return;
    sessionRef.current = { kind: "palette", type, startX: event.clientX, startY: event.clientY, moved: false, pointerType: event.pointerType };
  }, []);

  const onPagePointerDown = useCallback(
    (event, point) => {
      if (event.target instanceof Element && event.target.closest("[data-field]")) return;
      const armed = live.current.armedType;
      if (armed && point) {
        event.preventDefault();
        placeField(armed, point);
        setArmedType(null);
        setGhost(null);
        return;
      }
      if (!event.shiftKey) setSelectedIds([]);
    },
    [placeField]
  );

  const onFocusField = useCallback((field) => {
    if (pointerFocusRef.current) return;
    setSelectedIds((ids) => (ids.includes(field.id) ? ids : [field.id]));
  }, []);

  // ---- keyboard ----

  useEffect(() => {
    const onKey = (event) => {
      if (isTypingTarget(event.target)) return;
      // Only keys pressed in the editor itself (not in a dialog over it)
      if (event.target !== document.body && !editorRef.current?.contains(event.target)) return;

      const { selectedIds: ids, fields: all, pageSizes: sizes, currentPage: page } = live.current;
      const command = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (command && key === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        announce(event.shiftKey ? "Redone" : "Undone");
        return;
      }
      if (command && key === "y") {
        event.preventDefault();
        redo();
        announce("Redone");
        return;
      }
      if (command && (key === "=" || key === "+" || key === "-")) {
        event.preventDefault();
        stepZoom(key === "-" ? -1 : 1);
        return;
      }
      if (command && key === "a") {
        event.preventDefault();
        const onPage = all.filter((f) => f.page === page).map((f) => f.id);
        setSelectedIds(onPage);
        announce(`${onPage.length} fields picked on page ${page}`);
        return;
      }
      if (event.key === "Escape") {
        if (live.current.armedType) {
          setArmedType(null);
          setGhost(null);
        } else setSelectedIds([]);
        return;
      }

      if (ids.length === 0) {
        if (command && key === "v" && clipboardRef.current.length) {
          event.preventDefault();
          pasteFields(page);
        }
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        removeFields(ids);
        return;
      }
      if (command && key === "d") {
        event.preventDefault();
        duplicateFields(ids);
        return;
      }
      if (command && key === "c") {
        event.preventDefault();
        clipboardRef.current = all.filter((f) => ids.includes(f.id));
        announce(ids.length === 1 ? "Field copied" : `${ids.length} fields copied`);
        return;
      }
      if (command && key === "v" && clipboardRef.current.length) {
        event.preventDefault();
        pasteFields(page);
        return;
      }

      const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (arrows[event.key]) {
        event.preventDefault();
        const [ax, ay] = arrows[event.key];
        const step = event.shiftKey ? 10 : 1;
        changeFields(
          ids,
          (f) => {
            const size = sizes[f.page - 1] || { width: 612, height: 792 };
            return { xPercent: f.xPercent + (ax * step) / size.width, yPercent: f.yPercent + (ay * step) / size.height };
          },
          "nudge"
        );
      }
    };

    const pasteFields = (page) => {
      const copies = cloneAll(clipboardRef.current, (f) => {
        const samePage = f.page === page;
        return { page, xPercent: f.xPercent + (samePage ? 0.02 : 0), yPercent: f.yPercent + (samePage ? 0.02 : 0) };
      });
      setFields((previous) => [...previous, ...copies]);
      setSelectedIds(copies.map((f) => f.id));
      announce(copies.length === 1 ? "Field pasted" : `${copies.length} fields pasted`);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, removeFields, duplicateFields, changeFields, setFields, announce]);

  // ---- zoom ----

  const stepZoom = (direction) => {
    setZoom((current) => {
      const now = current === "fit" ? live.current.scale : current;
      if (direction > 0) return ZOOM_STEPS.find((step) => step > now + 0.01) || ZOOM_STEPS[ZOOM_STEPS.length - 1];
      return [...ZOOM_STEPS].reverse().find((step) => step < now - 0.01) || ZOOM_STEPS[0];
    });
  };

  // ---- drawing ----

  const shown = useMemo(() => {
    if (!preview) return fields;
    return fields.map((f) => (preview.has(f.id) ? { ...f, ...preview.get(f.id) } : f));
  }, [fields, preview]);

  const byPage = useMemo(() => {
    const map = new Map();
    for (const field of sortForReading(shown)) {
      if (!map.has(field.page)) map.set(field.page, []);
      map.get(field.page).push(field);
    }
    return map;
  }, [shown]);

  const selection = useMemo(() => selectedIds.map((id) => fields.find((f) => f.id === id)).filter(Boolean), [selectedIds, fields]);
  const primaryId = selectedIds[selectedIds.length - 1] || null;
  const selectedGroup = selection.length === 1 && selection[0].type === "radio" ? selection[0].groupId : null;

  const imageFor = (field) => field.signatureUrl || (mode === "self" ? signatureImages[field.type] : null) || null;

  const renderOverlay = (page, size) => (
    <>
      {(byPage.get(page) || []).map((field) => (
        <EditorField
          key={field.id}
          field={field}
          pageWidth={size.width}
          pageHeight={size.height}
          mode={mode}
          color={colorOf(field)}
          ownerName={participantOf(field)?.name || field.recipientName || field.roleName || ""}
          selected={selectedIds.includes(field.id)}
          primary={field.id === primaryId && selectedIds.length === 1}
          inGroup={Boolean(selectedGroup) && field.groupId === selectedGroup}
          image={imageFor(field)}
          autoValues={autoValues}
          onPointerDown={onFieldPointerDown}
          onFocusField={onFocusField}
          onActivate={activateField}
          onChangeValue={changeValue}
          onDuplicate={duplicateOne}
          onRemove={removeOne}
          dragged={draggedRef}
        />
      ))}
      {guides
        .filter((line) => line.page === page)
        .map((line, index) => (
          <span
            key={index}
            aria-hidden="true"
            className="absolute bg-fuchsia-500 pointer-events-none z-40"
            style={line.vertical ? { left: `${line.at * 100}%`, top: 0, bottom: 0, width: 1 } : { top: `${line.at * 100}%`, left: 0, right: 0, height: 1 }}
          />
        ))}
      {armedType && <div className="absolute inset-0 z-[35] cursor-crosshair" aria-hidden="true" />}
    </>
  );

  const fieldCount = (page) => (byPage.get(page) || []).length;
  const activeParticipant = assignable.find((p) => p.id === activeId) || null;
  const paletteColor = mode === "self" ? SELF_COLOR : activeParticipant?.color || "#facc15";

  const sidebar = (
    <EditorSidebar
      sidebarTop={sidebarTop}
      mode={mode}
      assignable={assignable}
      fields={fields}
      ownerKey={ownerKey}
      activeId={activeId}
      setActiveId={setActiveId}
      armedType={armedType}
      paletteColor={paletteColor}
      activeParticipant={activeParticipant}
      onPalettePointerDown={onPalettePointerDown}
      placeAtCentre={placeAtCentre}
      selectedIds={selectedIds}
      setSelectedIds={setSelectedIds}
      canvasRef={canvasRef}
      setDrawerOpen={setDrawerOpen}
      colorOf={colorOf}
    />
  );

  const properties = selection.length > 0 && (
    <FieldProperties
      selection={selection}
      allFields={fields}
      mode={mode}
      participants={participants}
      pageSizes={pageSizes}
      onChange={changeFields}
      onDuplicate={duplicateFields}
      onRemove={removeFields}
      onCopyToAllPages={copyToAllPages}
      onAddRadioOption={addRadioOption}
      onAlign={alignFields}
      onClose={() => setSelectedIds([])}
    />
  );

  const zoomLabel = zoom === "fit" ? "Fit" : `${Math.round(zoom * 100)}%`;
  const iconButton =
    "w-10 h-10 shrink-0 rounded-xl border-2 border-white/15 bg-[#1e2235] hover:bg-[#282d47] text-white flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none";

  return (
    <div ref={editorRef} className="h-[100dvh] flex flex-col bg-[#08090d] text-gray-100 font-sans overflow-hidden">
      {/* Header */}
      <EditorHeader
        title={title}
        subtitle={subtitle}
        saveStatus={saveStatus}
        steps={steps}
        undo={undo}
        redo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        zoomLabel={zoomLabel}
        stepZoom={stepZoom}
        setZoom={setZoom}
        thumbnails={thumbnails}
        setThumbnails={setThumbnails}
        primaryAction={primaryAction}
        secondaryAction={secondaryAction}
        onBack={onBack}
        backLabel={backLabel}
        notice={notice}
      />

      <div className="flex-1 min-h-0 flex relative">
        {/* Left: who, what to add, what is there */}
        <aside
          className={`bg-[#0d0f16] border-r-2 border-white/15 overflow-y-auto overscroll-contain z-40 w-[300px] max-w-[88vw] shrink-0 lg:static lg:translate-x-0 fixed inset-y-0 left-0 transition-transform ${
            drawerOpen ? "translate-x-0 shadow-[8px_0_0_0_rgba(0,0,0,0.5)]" : "-translate-x-full"
          }`}
          aria-label="Fields"
        >
          <div className="lg:hidden flex justify-end p-2">
            <button type="button" className={iconButton} onClick={() => setDrawerOpen(false)} aria-label="Close">
              <UI.close />
            </button>
          </div>
          {sidebar}
        </aside>
        {drawerOpen && <div className="lg:hidden fixed inset-0 bg-black/60 z-30" onClick={() => setDrawerOpen(false)} aria-hidden="true" />}

        {/* The document */}
        <main className="flex-1 min-w-0 flex flex-col bg-[#11131b]" aria-label="Document">
          <DocumentCanvas
            ref={canvasRef}
            fileUrl={fileUrl}
            zoom={zoom}
            maxFitWidth={1000}
            scrollMode="self"
            showThumbnails={thumbnails}
            thumbnailBadge={fieldCount}
            renderOverlay={renderOverlay}
            onLoad={({ pages }) => setPageSizes(pages)}
            onScaleChange={setScale}
            onCurrentPageChange={setCurrentPage}
            onPagePointerDown={onPagePointerDown}
            pageClassName="border-2 border-black shadow-[6px_6px_0px_0px_#000]"
            className="flex-1"
          />

          {/* Page and zoom, and on a phone the way into the field list */}
          <div className="shrink-0 border-t-2 border-white/15 bg-[#0d0f16] px-3 py-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-wider">
            <button type="button" className={`${iconButton} lg:hidden w-auto px-3 gap-1.5`} onClick={() => setDrawerOpen(true)}>
              <UI.plus className="w-4 h-4" /> Add field
            </button>
            <span className="text-gray-400 tabular-nums" aria-live="polite">
              Page {currentPage} / {pageSizes.length || "…"}
            </span>
            <span className="ml-auto md:hidden flex items-center gap-1.5">
              <button type="button" className={iconButton} onClick={undo} disabled={!canUndo} aria-label="Undo">
                <UI.undo />
              </button>
              <button type="button" className={iconButton} onClick={redo} disabled={!canRedo} aria-label="Redo">
                <UI.redo />
              </button>
            </span>
          </div>
        </main>

        {/* Right: the selected field's settings (a sheet from the bottom on a phone) */}
        {properties && (
          <aside
            className="z-40 bg-[#0d0f16] overflow-y-auto overscroll-contain p-4 lg:static lg:w-[300px] lg:shrink-0 lg:border-l-2 lg:border-white/15 fixed inset-x-0 bottom-0 max-h-[60dvh] lg:max-h-none border-t-2 border-white/20 lg:border-t-0 shadow-[0_-6px_0_0_rgba(0,0,0,0.5)] lg:shadow-none"
            aria-label="Field settings"
          >
            {properties}
          </aside>
        )}
      </div>

      {/* The field type following the pointer while it is dragged or about to be placed */}
      {ghost && <EditorGhost key={ghost.type} start={ghost} color={paletteColor} scale={scale} />}

      <p className="sr-only" role="status" aria-live="polite">
        {message}
      </p>
    </div>
  );
}
