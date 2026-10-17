import React, { useState, useEffect } from "react";
import API from "../api/axios";
import { useTranslation } from "react-i18next";
import { LIGHT } from "./signature/lightTheme";

export function OtpVerificationModal({
  token,
  recipientEmail,
  documentTitle,
  authType = "otp",
  onVerified,
}) {
  const isPasscode = authType === "passcode";
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sentMessage, setSentMessage] = useState(null);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSendCode = async () => {
    try {
      setLoading(true);
      setError(null);
      await API.post("/sign/otp/send", { token });
      setSentMessage(t("verify.sent", { contact: recipientEmail }));
      setCountdown(60);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || t("verify.sendFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!code.trim()) {
      setError(isPasscode ? t("verify.needPasscode") : t("verify.needCode"));
      return;
    }

    if (!isPasscode && code.trim().length !== 6) {
      setError(t("verify.needFullCode"));
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (isPasscode) {
        const res = await API.post("/sign/otp/verify-passcode", { token, passcode: code.trim() });
        if (res.data?.success || res.status === 200) {
          onVerified();
        }
      } else {
        const res = await API.post("/sign/otp/verify", { token, otp: code.trim() });
        if (res.data?.success || res.status === 200) {
          onVerified();
        }
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          (isPasscode ? t("verify.invalidPasscode") : t("verify.failed"))
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f3efe6] text-gray-900 flex items-center justify-center p-4 font-sans">
      <div className="bg-white border-2 border-black rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-[6px_6px_0px_0px_#000] space-y-5" role="main">
        <div className="inline-flex items-center gap-1.5 text-[11px] font-black tracking-wider text-black bg-yellow-300 border-2 border-black px-3 py-1 rounded-full uppercase">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span>{isPasscode ? t("verify.badgePasscode") : t("verify.badgeOtp")}</span>
        </div>

        <div>
          <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight">{isPasscode ? t("verify.titlePasscode") : t("verify.titleOtp")}</h1>
          <p className="text-sm text-gray-700 mt-1 leading-relaxed">
            {isPasscode ? t("verify.bodyPasscode", { document: documentTitle || "" }) : t("verify.bodyOtp", { document: documentTitle || "" })}
          </p>
        </div>

        {sentMessage && (
          <div className="flex items-center bg-emerald-50 border-2 border-black text-emerald-900 px-3.5 py-2.5 rounded-xl text-sm font-bold" role="status">
            <span>{sentMessage}</span>
          </div>
        )}

        {error && (
          <div className="flex items-center bg-red-50 border-2 border-black text-red-800 px-3.5 py-2.5 rounded-xl text-sm font-bold" role="alert">
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className={LIGHT.label} htmlFor="verify-contact">
              {t("verify.contact")}
            </label>
            <input id="verify-contact" type="text" value={recipientEmail || ""} disabled className={`${LIGHT.input} bg-gray-100 text-gray-600`} />
          </div>

          <div>
            <label className={LIGHT.label} htmlFor="verify-code">
              {isPasscode ? t("verify.passcodeLabel") : t("verify.codeLabel")}
            </label>
            {isPasscode ? (
              <input
                id="verify-code"
                type="password"
                placeholder={t("verify.passcodePlaceholder")}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoFocus
                className={LIGHT.input}
              />
            ) : (
              <input
                id="verify-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/D/g, ""))}
                autoFocus
                className={`${LIGHT.input} text-2xl tracking-[8px] text-center`}
              />
            )}
          </div>

          <div className="flex gap-2.5 pt-2">
            {!isPasscode && (
              <button type="button" onClick={handleSendCode} disabled={loading || countdown > 0} className={`${LIGHT.secondary} flex-1`}>
                {loading ? t("verify.sending") : countdown > 0 ? t("verify.resend", { seconds: countdown }) : t("verify.request")}
              </button>
            )}
            <button
              type="submit"
              disabled={loading || (!isPasscode && code.length !== 6) || (isPasscode && !code.trim())}
              className={`${LIGHT.primary} ${isPasscode ? "w-full" : "flex-[2]"}`}
            >
              {loading ? t("verify.verifying") : t("verify.submit")}
            </button>
          </div>
        </form>

        <p className="pt-3 border-t-2 border-black/10 text-xs text-gray-600 text-center">{t("verify.notice")}</p>
      </div>
    </div>
  );
}
