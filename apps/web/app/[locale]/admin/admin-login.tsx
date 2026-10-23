"use client";

import type { TelegramLoginPayload } from "@khmio/shared";
import { Button, Card, Checkbox, Input, SegmentedControl } from "@khmio/ui";
import { Copy, FlaskConical, KeyRound, ShieldCheck, ShieldHalf } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import QRCode from "qrcode";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { BOT_USERNAME, SHOW_DEV_LOGIN, TelegramButton } from "@/components/telegram-button";
import type { AdminMe } from "@/lib/admin-api";
import { api, ApiError } from "@/lib/api";

/**
 * The admin login (roadmap step 7): Telegram, then the authenticator app.
 * The first time, the admin scans a QR code, proves it with one code, and
 * is shown 8 backup codes — once.
 */
export function AdminLogin({ me, onSignedIn }: { me: AdminMe | null; onSignedIn: () => void }) {
  const t = useTranslations("AdminApp");
  const [stage, setStage] = useState<"start" | "enrol" | "code">(me?.stage === "pending_2fa" ? (me.enrolled ? "code" : "enrol") : "start");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function stepOne(path: string, body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ next: "enrol" | "code" }>(path, { method: "POST", ...(body ? { body } : {}) });
      setStage(result.next);
    } catch (failure) {
      setError(failure instanceof ApiError && failure.code === "admin_not_configured" ? t("notConfigured") : failure instanceof ApiError && failure.code === "too_many_requests" ? t("tooManyTries") : t("notAnAdmin"));
    } finally {
      setBusy(false);
    }
  }
  const onTelegram = useCallback((user: TelegramLoginPayload) => void stepOne("/admin/auth/telegram", user), []); // eslint-disable-line react-hooks/exhaustive-deps

  if (backupCodes) return <BackupCodes codes={backupCodes} onDone={onSignedIn} />;

  return (
    <LoginFrame>
      {stage === "start" && (
        <>
          <Card className="flex flex-col gap-3 p-5">
            <p className="text-sm text-muted">{t("stepOneHint")}</p>
            {BOT_USERNAME ? <TelegramButton onLogin={onTelegram} /> : <p className="text-sm text-muted">{t("telegramNotSetUp")}</p>}
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
          </Card>
          {SHOW_DEV_LOGIN && (
            <Card className="flex flex-col gap-3 border-dashed p-5">
              <p className="flex items-start gap-2 text-sm text-muted">
                <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {t("devLoginHint")}
              </p>
              <Button variant="secondary" loading={busy} onClick={() => void stepOne("/admin/auth/dev-login")}>
                {t("devLogin")}
              </Button>
            </Card>
          )}
        </>
      )}
      {stage === "enrol" && <Enrol onEnrolled={setBackupCodes} />}
      {stage === "code" && <CodeEntry onSignedIn={onSignedIn} onRestart={() => setStage("start")} />}
    </LoginFrame>
  );
}

function LoginFrame({ children }: { children: ReactNode }) {
  const t = useTranslations("AdminApp");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  return (
    <div className="min-h-dvh bg-canvas p-4 text-fg">
      <div className="mx-auto flex w-full max-w-[420px] flex-col gap-4 pt-10">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 font-semibold">
            <ShieldHalf className="h-6 w-6 text-brand" aria-hidden="true" />
            {t("title")}
          </span>
          <SegmentedControl
            value={locale}
            onChange={(next) => router.replace(pathname.replace(/^\/(km|en)/, `/${next}`))}
            options={[
              { value: "km", label: "ខ្មែរ" },
              { value: "en", label: "EN" },
            ]}
          />
        </div>
        {children}
      </div>
    </div>
  );
}

/** Six digits from the app, or a backup code. */
function CodeField({ value, onChange, error }: { value: string; onChange: (value: string) => void; error?: string }) {
  const t = useTranslations("AdminApp");
  return (
    <Input
      label={t("codeLabel")}
      inputMode="text"
      autoComplete="one-time-code"
      autoFocus
      maxLength={9}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      error={error}
      className="text-center font-mono text-xl tracking-[0.3em]"
    />
  );
}

function useCodeSubmit(onDone: (result: { backupCodes?: string[] }) => void) {
  const t = useTranslations("AdminApp");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    setError(undefined);
    try {
      onDone(await api<{ ok: true; backupCodes?: string[] }>("/admin/auth/verify", { method: "POST", body: { code } }));
    } catch (failure) {
      setError(failure instanceof ApiError && failure.code === "code_locked" ? t("locked") : failure instanceof ApiError && failure.code === "too_many_requests" ? t("tooManyTries") : failure instanceof ApiError && failure.status === 401 ? t("expired") : t("wrongCode"));
      setCode("");
    } finally {
      setBusy(false);
    }
  }
  return { code, setCode, error, busy, submit };
}

function Enrol({ onEnrolled }: { onEnrolled: (codes: string[]) => void }) {
  const t = useTranslations("AdminApp");
  const [qr, setQr] = useState<{ image: string; secret: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const { code, setCode, error, busy, submit } = useCodeSubmit((result) => onEnrolled(result.backupCodes ?? []));

  useEffect(() => {
    api<{ otpauthUri: string; secret: string }>("/admin/auth/enrol", { method: "POST" })
      .then(async ({ otpauthUri, secret }) => setQr({ image: await QRCode.toDataURL(otpauthUri, { margin: 1, width: 220 }), secret }))
      .catch(() => setFailed(true));
  }, []);

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start gap-3">
        <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
        <div>
          <h1 className="font-semibold">{t("enrolTitle")}</h1>
          <p className="text-sm text-muted">{t("enrolBody")}</p>
        </div>
      </div>
      {failed && <p className="text-sm text-danger">{t("expired")}</p>}
      {qr && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- a QR code made in the browser */}
          <img src={qr.image} alt={t("qrAlt")} width={220} height={220} className="mx-auto rounded-DEFAULT bg-white p-2" />
          <details className="text-sm">
            <summary className="flex min-h-touch cursor-pointer items-center text-brand">{t("cantScan")}</summary>
            <p className="mt-1 break-all rounded-DEFAULT bg-border/20 p-3 font-mono text-sm">{qr.secret.replace(/(.{4})/g, "$1 ").trim()}</p>
          </details>
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <CodeField value={code} onChange={setCode} error={error} />
            <Button type="submit" variant="primary" loading={busy} disabled={code.replace(/\s/g, "").length < 6}>
              {t("confirmCode")}
            </Button>
          </form>
        </>
      )}
    </Card>
  );
}

function CodeEntry({ onSignedIn, onRestart }: { onSignedIn: () => void; onRestart: () => void }) {
  const t = useTranslations("AdminApp");
  const { code, setCode, error, busy, submit } = useCodeSubmit(() => onSignedIn());
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
        <div>
          <h1 className="font-semibold">{t("codeTitle")}</h1>
          <p className="text-sm text-muted">{t("codeBody")}</p>
        </div>
      </div>
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <CodeField value={code} onChange={setCode} error={error} />
        <Button type="submit" variant="primary" loading={busy} disabled={code.replace(/\s/g, "").length < 6}>
          {t("signIn")}
        </Button>
      </form>
      <Button variant="ghost" tone="muted" onClick={onRestart} className="-ml-3 self-start">
        {t("startOver")}
      </Button>
    </Card>
  );
}

function BackupCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const t = useTranslations("AdminApp");
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <LoginFrame>
      <Card className="flex flex-col gap-4 p-5">
        <div>
          <h1 className="font-semibold">{t("backupTitle")}</h1>
          <p className="text-sm text-muted">{t("backupBody")}</p>
        </div>
        <ol className="grid grid-cols-2 gap-2 rounded-DEFAULT bg-border/20 p-3 font-mono text-base">
          {codes.map((code) => (
            <li key={code} className="text-center tracking-wider">
              {code}
            </li>
          ))}
        </ol>
        <Button
          variant="secondary"
          onClick={() => {
            void navigator.clipboard?.writeText(codes.join("\n")).then(() => setCopied(true), () => undefined);
          }}
        >
          <Copy className="h-4 w-4" aria-hidden="true" />
          {copied ? t("copied") : t("copyCodes")}
        </Button>
        <Checkbox checked={saved} onChange={(e) => setSaved(e.target.checked)} label={t("savedThem")} />
        <Button variant="primary" disabled={!saved} onClick={onDone}>
          {t("continue")}
        </Button>
      </Card>
    </LoginFrame>
  );
}
