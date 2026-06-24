"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { AlertCircle, Link as LinkIcon } from "lucide-react";
import { useTranslation } from "@/i18n";
import { Input } from "@/shared/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { Button } from "@/shared/components/ui/button";
import {
  createLinkToken,
  deleteTelegramBotConfig,
  getChannelStatus,
  listChannelAccounts,
  saveTelegramBotConfig,
  unlinkChannelAccount,
  type ChannelProviderStatus,
} from "../api/channel-api";
import {
  ProviderBotInfoRow,
  ProviderConfigShell,
  ProviderDangerZone,
  ProviderHelpAccordion,
  ProviderLinkedAccountRow,
  ProviderTokenSnippet,
  ProviderTriggerCard,
} from "./ProviderConfigModal";

interface ChannelAccount {
  id: string;
  provider: string;
  provider_user_id: string;
  display_name: string | null;
  status: string;
  linked_at: string;
}

interface LinkTokenData {
  token: string;
  provider: string;
  expires_in_minutes: number;
}

interface TelegramLinkCardProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideCard?: boolean;
}

export function TelegramLinkCard({ open, onOpenChange, hideCard }: TelegramLinkCardProps = {}) {
  const { t, locale } = useTranslation();
  const [status, setStatus] = useState<ChannelProviderStatus | null>(null);
  const [account, setAccount] = useState<ChannelAccount | null>(null);
  const [linkToken, setLinkToken] = useState<LinkTokenData | null>(null);
  const [botTokenInput, setBotTokenInput] = useState("");
  const [isEditingToken, setIsEditingToken] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"disableBot" | "unlink" | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const modalOpen = open !== undefined ? open : isModalOpen;
  const setModalOpen = (val: boolean) => {
    setIsModalOpen(val);
    onOpenChange?.(val);
  };

  useEffect(() => () => { if (copyTimerRef.current) clearTimeout(copyTimerRef.current); }, []);

  const fetchStatus = useCallback(async () => {
    try {
      setError(null);
      const [statusRes, accountsRes] = await Promise.all([
        getChannelStatus(),
        listChannelAccounts(),
      ]);
      setStatus(statusRes.providers.telegram);
      setAccount(accountsRes.accounts.find((item) => item.provider === "telegram") ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("channels.telegram.errorLoadStatus"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  const handleSaveBot = async () => {
    try {
      setActionLoading(true);
      setError(null);
      await saveTelegramBotConfig(botTokenInput.trim());
      setBotTokenInput("");
      setIsEditingToken(false);
      setLinkToken(null);
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("channels.telegram.errorSaveToken"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteBot = async () => {
    try {
      setActionLoading(true);
      setError(null);
      await deleteTelegramBotConfig();
      setLinkToken(null);
      setAccount(null);
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("channels.telegram.errorDisableBot"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateLinkToken = async () => {
    try {
      setActionLoading(true);
      setError(null);
      setLinkToken(await createLinkToken("telegram"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("channels.telegram.errorGenerateToken"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnlink = async () => {
    if (!account) return;
    try {
      setActionLoading(true);
      setError(null);
      await unlinkChannelAccount(account.id);
      setLinkToken(null);
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("channels.telegram.errorUnlink"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!linkToken) return;
    try {
      await navigator.clipboard.writeText(`/start ${linkToken.token}`);
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(t("channels.telegram.errorCopy"));
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setError(null);
    setConfirmAction(null);
    setBotTokenInput("");
    setIsEditingToken(false);
  };

  if (hideCard && !modalOpen) return null;

  const configured = status?.configured ?? false;
  const linked = status?.linked ?? false;
  const webhookActive = status?.webhook_status === "active";
  const canGenerateLinkToken = !!(configured && status?.enabled && webhookActive);
  const botUsername = status?.bot_username?.replace(/^@/, "") ?? "";
  const cardStatus = linked
    ? { label: t("channels.telegram.statusLinked"), tone: "ok" as const }
    : configured
      ? { label: t("channels.telegram.statusConfigured"), tone: "ok" as const }
      : { label: t("channels.telegram.statusNotConfigured"), tone: "warn" as const };

  return (
    <>
      {!hideCard && !loading && (
        <ProviderTriggerCard
          provider="telegram"
          title={t("channels.telegram.title")}
          status={cardStatus}
          subtitle={configured && status?.bot_username ? `@${botUsername}` : undefined}
          onClick={() => setModalOpen(true)}
        />
      )}

      {!hideCard && loading && (
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 shrink-0 rounded-lg skeleton-shimmer" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-20 skeleton-shimmer rounded" />
              <div className="h-2.5 w-14 skeleton-shimmer rounded" />
            </div>
            <div className="h-6 w-6 rounded-md skeleton-shimmer" />
          </div>
        </div>
      )}

      {modalOpen && (
        <ProviderConfigShell
          provider="telegram"
          open={modalOpen}
          title={t("channels.telegram.title")}
          description={
            loading
              ? t("channels.telegram.loading")
              : configured && status?.bot_username
                ? `@${botUsername}`
                : t("channels.telegram.description")
          }
          error={error}
          loading={loading}
          onClose={handleCloseModal}
          onOpenChange={(next) => {
            if (!next) handleCloseModal();
            else setModalOpen(true);
          }}
        >
          {!configured && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-body-sm-bold text-foreground" htmlFor="tg-bot-token">
                  {t("channels.telegram.botTokenLabel")}
                </label>
                <Input
                  id="tg-bot-token"
                  type="password"
                  value={botTokenInput}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setBotTokenInput(e.target.value)}
                  onKeyDown={(e: ReactKeyboardEvent<HTMLInputElement>) => {
                    if (e.key === "Enter" && botTokenInput.trim() && !actionLoading) void handleSaveBot();
                  }}
                  placeholder={t("channels.telegram.botTokenPlaceholder")}
                  autoFocus
                />
                <p className="text-caption text-muted-foreground">{t("channels.telegram.botTokenHint")}</p>
              </div>

              <ProviderHelpAccordion
                id="tg-help"
                title={t("channels.telegram.helpTitle")}
                steps={[
                  t("channels.telegram.helpStep1"),
                  t("channels.telegram.helpStep2"),
                  t("channels.telegram.helpStep3"),
                  t("channels.telegram.helpStep4"),
                  t("channels.telegram.helpStep5"),
                ]}
                open={helpOpen}
                onToggle={() => setHelpOpen((p) => !p)}
              />

              <Button
                type="button"
                disabled={actionLoading || !botTokenInput.trim()}
                onClick={handleSaveBot}
                className="w-full"
              >
                {actionLoading ? t("channels.telegram.verifyingButton") : t("channels.telegram.saveButton")}
              </Button>
            </div>
          )}

          {configured && status && (
            <div className="space-y-4">
              <ProviderBotInfoRow
                displayName={`@${botUsername}`}
                maskedToken={status.masked_token ?? ""}
                statusLabel={
                  webhookActive
                    ? t("channels.telegram.webhookActive")
                    : t("channels.telegram.webhookNeedsAttention")
                }
                statusTone={webhookActive ? "ok" : "warn"}
              />

              {status.last_error && (
                <div className="flex items-start gap-2 rounded-md border border-destructive bg-destructive/5 px-3 py-2 text-body-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{status.last_error}</span>
                </div>
              )}

              {isEditingToken && (
                <div className="rounded-md border border-border bg-muted p-3 space-y-2">
                  <p className="text-body-sm-bold text-foreground">
                    {t("channels.telegram.updateToken")}
                  </p>
                  <Input
                    type="password"
                    value={botTokenInput}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setBotTokenInput(e.target.value)}
                    onKeyDown={(e: ReactKeyboardEvent<HTMLInputElement>) => {
                      if (e.key === "Enter" && botTokenInput.trim() && !actionLoading) void handleSaveBot();
                      if (e.key === "Escape") { setBotTokenInput(""); setIsEditingToken(false); }
                    }}
                    placeholder={t("channels.telegram.newTokenPlaceholder")}
                    autoFocus
                  />
                  <div className="flex gap-2 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      disabled={actionLoading || !botTokenInput.trim()}
                      onClick={handleSaveBot}
                    >
                      {actionLoading ? t("channels.telegram.workingButton") : t("channels.telegram.updateToken")}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => { setBotTokenInput(""); setIsEditingToken(false); }}
                    >
                      {t("channels.telegram.cancel")}
                    </Button>
                  </div>
                </div>
              )}

              {linkToken && botUsername && (
                <ProviderTokenSnippet
                  command={`/start ${linkToken.token}`}
                  copied={copied}
                  expiresInMinutes={linkToken.expires_in_minutes}
                  onCopy={handleCopy}
                  copyLabel={t("channels.telegram.copyButton")}
                  copiedLabel={t("channels.telegram.copiedButton")}
                  expiryLabel={t("channels.telegram.tokenExpiry", { minutes: linkToken.expires_in_minutes })}
                  caption={
                    <>
                      {t("channels.telegram.linkInstructionsPre")}
                      <strong className="text-foreground">@{botUsername}</strong>
                      {t("channels.telegram.linkInstructionsPost")}
                    </>
                  }
                  deepLink={{
                    href: `https://t.me/${botUsername}?start=${linkToken.token}`,
                    label: t("channels.listening.openTelegram"),
                  }}
                />
              )}

              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  disabled={actionLoading || !canGenerateLinkToken}
                  onClick={handleCreateLinkToken}
                  className="w-full gap-1.5"
                >
                  <LinkIcon className="h-4 w-4" />
                  {actionLoading ? t("channels.telegram.workingButton") : t("channels.telegram.generateLinkToken")}
                </Button>
                {!isEditingToken && (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={actionLoading}
                    onClick={() => setIsEditingToken(true)}
                    className="w-full"
                  >
                    {t("channels.telegram.updateToken")}
                  </Button>
                )}
              </div>

              {!canGenerateLinkToken && (
                <p className="flex items-start gap-1.5 text-caption text-warning">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{t("channels.telegram.fixSetupHint")}</span>
                </p>
              )}

              {linked && account && (
                <ProviderLinkedAccountRow
                  displayName={account.display_name ?? account.provider_user_id}
                  linkedAtLabel={t("channels.telegram.linkedAt", {
                    date: new Date(account.linked_at).toLocaleDateString(locale),
                  })}
                  unlinkLabel={t("channels.telegram.unlinkChat")}
                  onUnlink={() => setConfirmAction("unlink")}
                  disabled={actionLoading}
                />
              )}

              <ProviderDangerZone
                title={t("channels.dangerZone")}
                description={t("channels.telegram.dangerZoneDescription")}
                actionLabel={t("channels.telegram.disableBot")}
                onAction={() => setConfirmAction("disableBot")}
                disabled={actionLoading}
              />
            </div>
          )}
        </ProviderConfigShell>
      )}

      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={(isOpen) => { if (!isOpen) setConfirmAction(null); }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === "unlink"
                ? t("channels.telegram.unlinkConfirmTitle")
                : t("channels.telegram.disableConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "unlink"
                ? t("channels.telegram.unlinkConfirmDescription")
                : t("channels.telegram.disableConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("channels.telegram.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                const action = confirmAction;
                setConfirmAction(null);
                if (action === "unlink") void handleUnlink();
                else if (action === "disableBot") void handleDeleteBot();
              }}
            >
              {confirmAction === "unlink"
                ? t("channels.telegram.unlinkChat")
                : t("channels.telegram.disableBot")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
