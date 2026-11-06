"use client";

/**
 * StepUpDialog — ADR-0050 D5.
 *
 * Montato una volta nel guscio autenticato. Quando l'API chiede una conferma recente del
 * secondo fattore (403 `STEP_UP_REQUIRED`, letture per mandato di retribuzione e
 * valutazioni), `apiFetch` chiama `chiediConferma()` e questa finestra raccoglie il codice
 * (app, email, SMS o codice di recupero) oppure la passkey. Confermato, la richiesta si
 * ripete da sola; annullato, resta l'errore dell'API.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { startAuthentication } from "@simplewebauthn/browser";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from "@heuresys/ui";
import type { StepUpBeginResponse, StepUpVerifyResponse } from "@heuresys/shared/schemas/mfa";
import { apiFetch } from "@/lib/api/fetch";
import { isApiError } from "@/lib/api/errors";
import { registraRichiestaConferma } from "@/lib/api/step-up";

const subscribeNever = () => () => {};

export function StepUpDialog() {
  const { t } = useTranslation("common");
  const [aperta, setAperta] = useState(false);
  const [sfida, setSfida] = useState<StepUpBeginResponse | null>(null);
  const [codice, setCodice] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const [occupata, setOccupata] = useState(false);
  const risolvi = useRef<((ok: boolean) => void) | null>(null);

  const passkeySupportata = useSyncExternalStore(
    subscribeNever,
    () => window.isSecureContext && typeof window.PublicKeyCredential !== "undefined",
    () => false,
  );

  // ApiError porta già il testo per la persona, ricavato dal codice (lib/api/errors.ts).
  const messaggio = useCallback(
    (err: unknown) => (isApiError(err) ? err.message : t("stepUp.error")),
    [t],
  );

  /** Una sfida nuova: il challengeToken è monouso, e un codice sbagliato lo consuma. */
  const nuovaSfida = useCallback(async () => {
    setSfida(null);
    try {
      setSfida(await apiFetch<StepUpBeginResponse>("/v1/auth/mfa/step-up/begin", { method: "POST", body: {} }));
    } catch (err) {
      setErrore(messaggio(err));
    }
  }, [messaggio]);

  useEffect(
    () =>
      registraRichiestaConferma(
        () =>
          new Promise<boolean>((resolve) => {
            risolvi.current = resolve;
            setCodice("");
            setErrore(null);
            setAperta(true);
            void nuovaSfida();
          }),
      ),
    [nuovaSfida],
  );

  const chiudi = (ok: boolean) => {
    setAperta(false);
    setSfida(null);
    setCodice("");
    const r = risolvi.current;
    risolvi.current = null;
    r?.(ok);
  };

  const conferma = async (e: FormEvent) => {
    e.preventDefault();
    if (!sfida) return;
    setOccupata(true);
    setErrore(null);
    try {
      await apiFetch<StepUpVerifyResponse>("/v1/auth/mfa/step-up/verify", {
        method: "POST",
        body: { challengeToken: sfida.challengeToken, code: codice.trim() },
      });
      chiudi(true);
    } catch (err) {
      setErrore(messaggio(err));
      setCodice("");
      await nuovaSfida();
    } finally {
      setOccupata(false);
    }
  };

  const conPasskey = async () => {
    if (!sfida) return;
    setOccupata(true);
    setErrore(null);
    try {
      const opt = await apiFetch<{ options: Parameters<typeof startAuthentication>[0]["optionsJSON"] }>(
        "/v1/auth/mfa/webauthn/authentication/options",
        { method: "POST", body: { challengeToken: sfida.challengeToken } },
      );
      const assertion = await startAuthentication({ optionsJSON: opt.options });
      await apiFetch<StepUpVerifyResponse>("/v1/auth/mfa/step-up/webauthn/verify", {
        method: "POST",
        body: { challengeToken: sfida.challengeToken, response: assertion },
      });
      chiudi(true);
    } catch (err) {
      setErrore(messaggio(err));
      await nuovaSfida();
    } finally {
      setOccupata(false);
    }
  };

  const passkey = passkeySupportata && sfida?.availableKinds.includes("WEBAUTHN");

  return (
    <Dialog open={aperta} onOpenChange={(o) => { if (!o) chiudi(false); }}>
      <DialogContent data-testid="step-up-dialog">
        <DialogHeader>
          <DialogTitle>{t("stepUp.title")}</DialogTitle>
          <DialogDescription>{t("stepUp.description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void conferma(e)} className="space-y-4" noValidate>
          <div>
            <label htmlFor="step-up-code" className="block text-sm font-medium mb-1">
              {t("stepUp.codeLabel")}
            </label>
            <Input
              id="step-up-code"
              data-testid="step-up-code"
              type="text"
              autoComplete="one-time-code"
              autoFocus
              maxLength={32}
              placeholder="123456"
              value={codice}
              onChange={(e) => setCodice(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">{t("stepUp.codeHint")}</p>
          </div>
          {errore && (
            <div role="alert" data-testid="step-up-error" className="text-sm text-danger bg-danger/10 border border-danger/30 rounded px-3 py-2">
              {errore}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => chiudi(false)} disabled={occupata}>
              {t("stepUp.cancel")}
            </Button>
            {passkey && (
              <Button type="button" variant="outline" data-testid="step-up-passkey" onClick={() => void conPasskey()} disabled={occupata}>
                {t("stepUp.usePasskey")}
              </Button>
            )}
            <Button type="submit" data-testid="step-up-submit" disabled={occupata || !sfida || codice.trim().length < 6}>
              {occupata ? t("stepUp.confirming") : t("stepUp.confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
