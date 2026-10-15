import { useState } from "react";
import toast from "react-hot-toast";
import { BTN, PANEL, INPUT, LABEL, EYEBROW, ICONS } from "../billing/theme";
import { SectionHead, ReadOnlyNote } from "./parts";
import { BRAND_COLOURS, isHex } from "../../utils/team";

/**
 * How a team's documents look to the people who sign them: its name, logo and colour, and a
 * line under its emails. The previews follow what the server really sends: emails show a logo
 * only from an https address (services/email.service.js), and the signing page shows the
 * colour on its mark when there is no logo (pages/SigningPage.jsx).
 */

const MAX_LOGO = 150 * 1024;

export default function TeamBranding({ team, canManage, busy, onSave }) {
  const [brand, setBrand] = useState({
    companyName: team.branding?.companyName || "",
    primaryColor: team.branding?.primaryColor || "#4f46e5",
    logoUrl: team.branding?.logoUrl || "",
    emailFooterText: team.branding?.emailFooterText || "",
  });
  const [dragging, setDragging] = useState(false);
  const colourOk = isHex(brand.primaryColor);
  const accent = colourOk ? brand.primaryColor : "#4f46e5";
  const name = brand.companyName.trim() || team.name;
  const emailLogo = /^https:\/\//i.test(brand.logoUrl);

  const takeLogo = (file) => {
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type) || file.size > MAX_LOGO) {
      toast.error("Choose a PNG or JPEG under 150 KB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setBrand((b) => ({ ...b, logoUrl: String(reader.result) }));
    reader.readAsDataURL(file);
  };

  const save = (event) => {
    event.preventDefault();
    if (colourOk) onSave({ ...brand, logoUrl: brand.logoUrl || null });
  };

  return (
    <div className="grid gap-6" data-testid="team-branding">
      <SectionHead title="Branding">Signers see your name, logo and colour on emails and signing pages, in place of PactDoc&apos;s.</SectionHead>

      <div className="grid gap-6 xl:grid-cols-2 items-start">
        <form onSubmit={save} className={`${PANEL} p-5 grid gap-5`}>
          <fieldset disabled={!canManage} className="grid gap-5 min-w-0">
            <div>
              <label htmlFor="brand-name-input" className={LABEL}>
                Name shown to signers
              </label>
              <input id="brand-name-input" className={INPUT} maxLength={80} placeholder={team.name} value={brand.companyName} onChange={(e) => setBrand({ ...brand, companyName: e.target.value })} />
            </div>

            <div>
              <p className={LABEL}>Logo</p>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  if (canManage) setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  if (canManage) takeLogo(e.dataTransfer.files?.[0]);
                }}
                className={`flex flex-wrap items-center gap-4 p-4 rounded-xl border-2 border-dashed ${dragging ? "border-yellow-400 bg-yellow-400/[0.06]" : "border-white/20 bg-[#090a0f]"}`}
              >
                <span className="w-16 h-16 shrink-0 grid place-items-center rounded-xl bg-white border-2 border-black overflow-hidden">
                  {brand.logoUrl ? <img src={brand.logoUrl} alt="Your logo" className="max-w-full max-h-full object-contain p-1" /> : <ICONS.image className="w-6 h-6 text-gray-400" />}
                </span>
                <span className="flex-[1_1_160px] min-w-0 text-xs text-gray-400">
                  <span className="block text-sm font-black text-white">{brand.logoUrl ? "Your logo" : "No logo yet"}</span>
                  PNG or JPEG, under 150 KB. {canManage && "Drop one here, or choose a file."}
                </span>
                {canManage && (
                  <span className="flex gap-2">
                    <label className={`${BTN.small} cursor-pointer focus-within:ring-2 focus-within:ring-yellow-400`}>
                      {brand.logoUrl ? "Replace" : "Choose"}
                      <input type="file" accept="image/png,image/jpeg" className="sr-only" onChange={(e) => takeLogo(e.target.files?.[0])} />
                    </label>
                    {brand.logoUrl && (
                      <button type="button" className={`${BTN.small} !text-red-300`} onClick={() => setBrand({ ...brand, logoUrl: "" })}>
                        Remove
                      </button>
                    )}
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-xs text-gray-400">An uploaded logo shows on the signing page. Email programs show a logo only when it is given as an https address.</p>
            </div>

            <div>
              <p className={LABEL} id="colour-label">
                Brand colour
              </p>
              <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-labelledby="colour-label">
                {BRAND_COLOURS.map(([hex, label]) => {
                  const on = brand.primaryColor.toLowerCase() === hex;
                  return (
                    <button
                      key={hex}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={label}
                      onClick={() => setBrand({ ...brand, primaryColor: hex })}
                      className={`w-10 h-10 rounded-xl border-2 transition-transform ${on ? "border-white shadow-[3px_3px_0px_0px_#facc15] -translate-y-0.5" : "border-black"}`}
                      style={{ background: hex }}
                    />
                  );
                })}
                <label htmlFor="brand-hex" className="sr-only">
                  Colour code
                </label>
                <input
                  id="brand-hex"
                  className={`${INPUT} !w-28 !min-h-[40px] font-mono uppercase ${colourOk ? "" : "!border-red-500"}`}
                  maxLength={7}
                  value={brand.primaryColor}
                  onChange={(e) => setBrand({ ...brand, primaryColor: e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}` })}
                />
              </div>
              <p className={`mt-1.5 text-xs ${colourOk ? "text-gray-400" : "font-bold text-red-300"}`}>{colourOk ? "Used for the buttons in emails and the team's mark on the signing page." : "Write the colour as # and six characters, like #0f766e."}</p>
            </div>

            <div>
              <label htmlFor="brand-footer" className={LABEL}>
                Line at the foot of emails
              </label>
              <textarea
                id="brand-footer"
                rows={2}
                maxLength={300}
                className={`${INPUT} py-2.5 resize-y`}
                placeholder="Your company · address"
                value={brand.emailFooterText}
                onChange={(e) => setBrand({ ...brand, emailFooterText: e.target.value })}
              />
            </div>
          </fieldset>

          {canManage ? (
            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" className={BTN.primary} disabled={busy === "brand" || !colourOk}>
                {busy === "brand" ? "Saving…" : "Save branding"}
              </button>
              <span className="text-xs text-gray-400">Applies to everything sent from now on.</span>
            </div>
          ) : (
            <ReadOnlyNote />
          )}
        </form>

        {/* What signers will see, as the settings stand before saving */}
        <div className="grid gap-5 min-w-0">
          <p className={`${EYEBROW} flex items-center gap-2`}>
            <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true" />
            Preview: what signers see
          </p>

          <figure>
            <div className="rounded-2xl overflow-hidden border-2 border-black bg-[#f1f5f9] p-3" style={{ boxShadow: `4px 4px 0 0 ${accent}` }}>
              <div className="rounded-xl overflow-hidden bg-white border border-slate-200 text-slate-700">
                <div className="px-5 py-4 bg-[#0f172a] text-center border-b-2" style={{ borderBottomColor: accent }}>
                  {emailLogo ? <img src={brand.logoUrl} alt="" className="inline-block max-h-9 max-w-[180px]" /> : <p className="text-lg font-extrabold text-white break-words">{name}</p>}
                </div>
                <div className="px-5 py-5 text-sm">
                  <p className="font-bold text-slate-900">Please sign: Sample agreement.pdf</p>
                  <p className="mt-2 leading-relaxed">You have been asked to review and sign this document.</p>
                  <p className="mt-4 text-center">
                    <span className="inline-block px-5 py-2.5 rounded-lg text-white font-semibold" style={{ background: accent }}>
                      Review and sign
                    </span>
                  </p>
                </div>
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-500">
                  {brand.emailFooterText.trim() && <p className="mb-1 break-words">{brand.emailFooterText}</p>}
                  <p>
                    {brand.companyName.trim() ? `${brand.companyName.trim()} · ` : ""}PactDoc
                  </p>
                </div>
              </div>
            </div>
            <figcaption className={`${EYEBROW} mt-2`}>Email</figcaption>
          </figure>

          <figure>
            <div className="rounded-2xl overflow-hidden border-2 border-black bg-[#08090d] shadow-[4px_4px_0px_0px_#000]">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
                {brand.logoUrl ? (
                  <img src={brand.logoUrl} alt="" className="h-9 max-w-[7rem] shrink-0 object-contain bg-white rounded-lg p-0.5" />
                ) : (
                  <span className="w-9 h-9 shrink-0 grid place-items-center rounded-xl" style={{ background: accent }} aria-hidden="true">
                    <ICONS.brand className="w-5 h-5 text-white" />
                  </span>
                )}
                <span className="min-w-0">
                  {brand.companyName.trim() && <span className="block text-[10px] font-bold text-gray-300 truncate">Sent by {brand.companyName.trim()}</span>}
                  <span className="block text-sm font-bold text-white truncate">Sample agreement.pdf</span>
                  <span className="block text-[10px] text-gray-400 truncate">
                    Signing as <strong className="text-red-400">Neha</strong>
                  </span>
                </span>
              </div>
              <div className="p-4" aria-hidden="true">
                <div className="h-28 rounded-lg bg-white p-3 grid gap-2 content-start">
                  <span className="h-1.5 w-3/4 bg-slate-200 rounded" />
                  <span className="h-1.5 w-11/12 bg-slate-200 rounded" />
                  <span className="h-1.5 w-2/3 bg-slate-200 rounded" />
                  <span className="mt-3 h-8 w-1/2 border-2 border-dashed border-red-400 rounded-md grid place-items-center text-[10px] font-bold text-red-500">Sign here</span>
                </div>
              </div>
            </div>
            <figcaption className={`${EYEBROW} mt-2`}>Signing page</figcaption>
          </figure>
        </div>
      </div>
    </div>
  );
}
