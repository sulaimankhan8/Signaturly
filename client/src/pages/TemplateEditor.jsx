import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";
import Navbar from "../components/Navbar";
import DocumentEditor from "../components/editor/DocumentEditor";
import { useFieldHistory } from "../components/editor/useFieldHistory";
import { useAutosave } from "../components/editor/useAutosave";
import { UI } from "../components/editor/icons";
import { fetchTemplateDetailsApi, updateTemplateApi } from "../api/template.api";
import { fetchUserSubscription } from "../api/billing.api";
import { RECIPIENT_PALETTE } from "../utils/constants";

const newRoleId = () => `role-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * Laying out a reusable template: the roles that will sign it (Tenant, Landlord, Witness) and
 * where each role's fields go. Saved as you go.
 */
export default function TemplateEditor() {
  const { templateId } = useParams();
  const navigate = useNavigate();

  const history = useFieldHistory([]);
  const { fields, setFields, resetFields } = history;
  const [template, setTemplate] = useState(null);
  const [roles, setRoles] = useState([]);
  const [subData, setSubData] = useState(null);
  const [loaded, setLoaded] = useState(false);

  // On a paid plan, whichever one. The server says what level the account's plan is, so a
  // plan added or renamed in the admin app counts without being listed here.
  const isProOrAbove = Boolean(subData?.entitlements?.tier && subData.entitlements.tier !== "free");

  useEffect(() => {
    let current = true;
    Promise.all([fetchTemplateDetailsApi(templateId), fetchUserSubscription().catch(() => null)])
      .then(([data, sub]) => {
        if (!current) return;
        setTemplate({ ...data, url: `${import.meta.env.VITE_API_BASE_URL}${data.pdfUrl}` });
        setSubData(sub);
        setRoles(data.roles || []);
        resetFields(data.fields || []);
        setLoaded(true);
      })
      .catch(() => {
        toast.error("The template could not be opened.");
        navigate("/templates");
      });
    return () => {
      current = false;
    };
  }, [templateId, navigate, resetFields]);

  const save = useCallback((value) => updateTemplateApi(templateId, value), [templateId]);
  // A role whose name is being typed still saves under a name
  const layout = useMemo(() => ({ fields, roles: roles.map((r, i) => ({ ...r, name: r.name.trim() || `Signer ${i + 1}` })) }), [fields, roles]);
  const autosave = useAutosave(save, layout, { enabled: loaded && isProOrAbove });

  const leave = async (to) => {
    await autosave.flush().catch(() => {});
    navigate(to);
  };

  // The server writes each field's role name from its role when it saves
  const renameRole = (id, name) => setRoles((list) => list.map((r) => (r.id === id ? { ...r, name } : r)));

  const addRole = () =>
    setRoles((list) => [
      ...list,
      { id: newRoleId(), name: `Signer ${list.length + 1}`, color: RECIPIENT_PALETTE[list.length % RECIPIENT_PALETTE.length].color, signingOrder: list.length + 1 },
    ]);

  const removeRole = (id) => {
    if (roles.length <= 1) return;
    const placed = fields.filter((f) => f.roleId === id).length;
    if (placed > 0 && !window.confirm(`Remove this role and its ${placed} field${placed === 1 ? "" : "s"}?`)) return;
    setFields((list) => list.filter((f) => f.roleId !== id));
    setRoles((list) => list.filter((r) => r.id !== id).map((r, i) => ({ ...r, signingOrder: i + 1 })));
  };

  if (!template) {
    return (
      <div className="min-h-screen bg-[#08090d] flex items-center justify-center">
        <Toaster position="top-right" />
        <div className="w-10 h-10 border-4 border-white/10 border-t-red-600 rounded-full animate-spin" role="status" aria-label="Opening the template" />
      </div>
    );
  }

  // Free Tier Lock Screen
  if (subData && !isProOrAbove) {
    return (
      <div className="min-h-screen bg-[#08090d] text-gray-100 font-sans">
        <Toaster position="top-right" />
        <Navbar />
        <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-[#13151f] border-2 border-yellow-400 rounded-2xl p-6 sm:p-8 shadow-[4px_4px_0px_0px_#ef4444] text-center space-y-4">
            <span className="text-[10px] font-black uppercase tracking-wider bg-yellow-400 text-black px-2.5 py-0.5 rounded-full border-2 border-black">Pro feature</span>
            <h2 className="text-xl sm:text-2xl font-black text-white uppercase">Your own templates are on Pro</h2>
            <p className="text-sm text-gray-300">Save your documents as reusable templates with roles and fields on the Pro plan.</p>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => navigate("/billing/plans")}
                className="px-6 min-h-[44px] bg-yellow-400 hover:bg-yellow-300 text-black font-black text-xs uppercase tracking-wider rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_#ef4444]"
              >
                See plans
              </button>
              <button type="button" onClick={() => navigate("/templates")} className="px-5 min-h-[44px] bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl">
                Back to templates
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const rolesPanel = (
    <details className="group rounded-xl border-2 border-white/15 bg-[#090a0f] p-3">
      <summary className="cursor-pointer text-[11px] font-black uppercase tracking-wider text-gray-300 flex items-center justify-between">
        Roles ({roles.length})<span className="text-yellow-400 group-open:hidden">Edit</span>
      </summary>
      <ul className="mt-3 space-y-2">
        {roles.map((role, index) => (
          <li key={role.id} className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-full border-2 border-black shrink-0" style={{ background: role.color }} />
            <input
              aria-label={`Name of role ${index + 1}`}
              value={role.name}
              maxLength={40}
              onChange={(e) => renameRole(role.id, e.target.value)}
              className="flex-1 min-w-0 min-h-[36px] px-2 bg-[#13151f] border-2 border-white/20 rounded-lg text-white text-xs font-bold focus:outline-none focus:border-yellow-400"
            />
            <button
              type="button"
              disabled={roles.length <= 1}
              onClick={() => removeRole(role.id)}
              aria-label={`Remove role ${role.name}`}
              className="w-8 h-8 rounded-lg hover:bg-red-600 disabled:opacity-30 flex items-center justify-center text-gray-300"
            >
              <UI.close className="w-3.5 h-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={addRole}
        disabled={roles.length >= 10}
        className="mt-3 w-full min-h-[36px] rounded-lg border-2 border-white/20 bg-[#1e2235] hover:bg-[#282d47] text-white text-[11px] font-black uppercase tracking-wider"
      >
        + Add a role
      </button>
    </details>
  );

  return (
    <>
      <Toaster position="top-right" />
      <DocumentEditor
        mode="template"
        fileUrl={template.url}
        title={template.name}
        subtitle={`Template · ${fields.length} field${fields.length === 1 ? "" : "s"}`}
        participants={roles}
        history={history}
        saveStatus={autosave.status}
        sidebarTop={rolesPanel}
        onBack={() => leave("/templates")}
        backLabel="Templates"
        secondaryAction={
          <button
            type="button"
            onClick={() => leave(`/templates/use/${templateId}`)}
            className="hidden sm:inline-flex items-center gap-2 min-h-[44px] px-3 rounded-xl border-2 border-white/20 bg-[#1e2235] hover:bg-[#282d47] text-white text-[11px] font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#000]"
          >
            Use it now
          </button>
        }
        primaryAction={{
          label: "Done",
          icon: <UI.check className="w-4 h-4" />,
          onClick: async () => {
            try {
              await autosave.flush();
              toast.success("Template saved.");
              navigate("/templates");
            } catch (error) {
              toast.error(error.response?.data?.message || "The template could not be saved.");
            }
          },
        }}
      />
    </>
  );
}
