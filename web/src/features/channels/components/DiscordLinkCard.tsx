"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { AlertCircle, Link as LinkIcon } from "lucide-react";
import { useTranslation } from "@/i18n";
import { Button } from "@/shared/components/ui/button";
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
import {
  createLinkToken,
  deleteDiscordBotConfig,
  getChannelStatus,
  listChannelAccounts,
  saveDiscordBotConfig,
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

interface DiscordLinkCardProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideCard?: boolean;
}

export function DiscordLinkCard({ open, onOpenChange, hideCard }: DiscordLinkCardProps = {}) {
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
      setStatus(statusRes.providers.discord);
      setAccount(accountsRes.accounts.find((item) => item.provider === "discord") ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("channels.discord.errorLoadStatus"));
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
      await saveDiscordBotConfig(botTokenInput.trim());
      setBotTokenInput("");
      setIsEditingToken(false);
      setLinkToken(null);
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("channels.discord.errorSaveToken"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteBot = async () => {
    try {
      setActionLoading(true);
      setError(null);
      await deleteDiscordBotConfig();
      setLinkToken(null);
      setAccount(null);
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("channels.discord.errorDisableBot"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateLinkToken = async () => {
    try {
      setActionLoading(true);
      setError(null);
      setLinkToken(await createLinkToken("discord"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("channels.discord.errorGenerateToken"));
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
      setError(err instanceof Error ? err.message : t("channels.discord.errorUnlink"));
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
      setError(t("channels.discord.errorCopy"));
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
  const gatewayActive = status?.status === "active";
  const canGenerateLinkToken = !!(configured && status?.enabled && gatewayActive);
  const cardStatus = linked
    ? { label: t("channels.discord.statusLinked"), tone: "ok" as const }
    : configured
      ? { label: t("channels.discord.statusConfigured"), tone: "ok" as const }
      : { label: t("channels.discord.statusNotConfigured"), tone: "warn" as const };

  return (
    <>
      {!hideCard && !loading && (
        <ProviderTriggerCard
          provider="discord"
          title={t("channels.discord.title")}
          status={cardStatus}
          subtitle={configured && status?.bot_username ? status.bot_username : undefined}
          onClick={() => setModalOpen(true)}
        />
      )}

      {!hideCard && loading && (
        <div className="rounded-lg border border-hairline-soft bg-card p-3">
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
          provider="discord"
          open={modalOpen}
          title={t("channels.discord.title")}
          description={
            loading
              ? t("channels.discord.loading")
              : configured && status?.bot_username
                ? status.bot_username
                : t("channels.discord.description")
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
                <label className="block text-body-sm-bold text-ink-deep" htmlFor="discord-bot-token">
                  {t("channels.discord.botTokenLabel")}
                </label>
                <Input
                  id="discord-bot-token"
                  type="password"
                  value={botTokenInput}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setBotTokenInput(e.target.value)}
                  onKeyDown={(e: ReactKeyboardEvent<HTMLInputElement>) => {
                    if (e.key === "Enter" && botTokenInput.trim() && !actionLoading) void handleSaveBot();
                  }}
                  placeholder={t("channels.discord.botTokenPlaceholder")}
                  autoFocus
                />
                <p className="text-caption text-steel">{t("channels.discord.botTokenHint")}</p>
              </div>

              <ProviderHelpAccordion
                id="discord-help"
                title={t("channels.discord.helpTitle")}
                steps={[
                  t("channels.discord.helpStep1"),
                  t("channels.discord.helpStep2"),
                  t("channels.discord.helpStep3"),
                  t("channels.discord.helpStep4"),
                  t("channels.discord.helpStep5"),
                ]}
                open={helpOpen}
                onToggle={() => setHelpOpen((p) => !p)}
                externalLink={{
                  href: "https://discord.com/developers/applications",
                  label: t("channels.discord.openDeveloperPortal"),
                }}
              />

              <Button
                type="button"
                disabled={actionLoading || !botTokenInput.trim()}
                onClick={handleSaveBot}
                className="w-full"
              >
                {actionLoading ? t("channels.discord.verifyingButton") : t("channels.discord.saveButton")}
              </Button>
            </div>
          )}

          {configured && status && (
            <div className="space-y-4">
              <ProviderBotInfoRow
                displayName={status.bot_username ?? ""}
                maskedToken={status.masked_token ?? ""}
                statusLabel={
                  gatewayActive
                    ? t("channels.discord.gatewayActive")
                    : t("channels.discord.gatewayNeedsAttention")
                }
                statusTone={gatewayActive ? "ok" : "warn"}
              />

              {status.last_error && (
                <div className="flex items-start gap-2 rounded-md border border-critical-strong bg-critical-strong/5 px-3 py-2 text-body-sm text-critical">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{status.last_error}</span>
                </div>
              )}

              {isEditingToken && (
                <div className="rounded-md border border-hairline-soft bg-surface-soft p-3 space-y-2">
                  <p className="text-body-sm-bold text-ink-deep">
                    {t("channels.discord.updateToken")}
                  </p>
                  <Input
                    type="password"
                    value={botTokenInput}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setBotTokenInput(e.target.value)}
                    onKeyDown={(e: ReactKeyboardEvent<HTMLInputElement>) => {
                      if (e.key === "Enter" && botTokenInput.trim() && !actionLoading) void handleSaveBot();
                      if (e.key === "Escape") { setBotTokenInput(""); setIsEditingToken(false); }
                    }}
                    placeholder={t("channels.discord.newTokenPlaceholder")}
                    autoFocus
                  />
                  <div className="flex gap-2 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      disabled={actionLoading || !botTokenInput.trim()}
                      onClick={handleSaveBot}
                    >
                      {actionLoading ? t("channels.discord.workingButton") : t("channels.discord.updateToken")}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => { setBotTokenInput(""); setIsEditingToken(false); }}
                    >
                      {t("channels.discord.cancel")}
                    </Button>
                  </div>
                </div>
              )}

              {linkToken && (
                <ProviderTokenSnippet
                  command={`/start ${linkToken.token}`}
                  copied={copied}
                  expiresInMinutes={linkToken.expires_in_minutes}
                  onCopy={handleCopy}
                  copyLabel={t("channels.discord.copyButton")}
                  copiedLabel={t("channels.discord.copiedButton")}
                  expiryLabel={t("channels.discord.tokenExpiry", { minutes: linkToken.expires_in_minutes })}
                  caption={t("channels.discord.linkInstructions")}
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
                  {actionLoading ? t("channels.discord.workingButton") : t("channels.discord.generateLinkToken")}
                </Button>
                {!isEditingToken && (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={actionLoading}
                    onClick={() => setIsEditingToken(true)}
                    className="w-full"
                  >
                    {t("channels.discord.updateToken")}
                  </Button>
                )}
              </div>

              {!canGenerateLinkToken && (
                <p className="flex items-start gap-1.5 text-caption text-accent-amber">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{t("channels.discord.fixSetupHint")}</span>
                </p>
              )}

              {linked && account && (
                <ProviderLinkedAccountRow
                  displayName={account.display_name ?? account.provider_user_id}
                  linkedAtLabel={t("channels.discord.linkedAt", {
                    date: new Date(account.linked_at).toLocaleDateString(locale),
                  })}
                  unlinkLabel={t("channels.discord.unlinkChat")}
                  onUnlink={() => setConfirmAction("unlink")}
                  disabled={actionLoading}
                />
              )}

              <ProviderDangerZone
                title={t("channels.dangerZone")}
                description={t("channels.discord.dangerZoneDescription")}
                actionLabel={t("channels.discord.disableBot")}
                onAction={() => setConfirmAction("disableBot")}
                disabled={actionLoading}
              />
            </div>
          )}
        </ProviderConfigShell>
      )}

      <AlertDialog open={confirmAction !== null} onOpenChange={(isOpen) => { if (!isOpen) setConfirmAction(null); }}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === "unlink" ? t("channels.discord.unlinkConfirmTitle") : t("channels.discord.disableConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "unlink" ? t("channels.discord.unlinkConfirmDescription") : t("channels.discord.disableConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("channels.discord.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                const action = confirmAction;
                setConfirmAction(null);
                if (action === "unlink") void handleUnlink();
                else if (action === "disableBot") void handleDeleteBot();
              }}
            >
              {confirmAction === "unlink" ? t("channels.discord.unlinkChat") : t("channels.discord.disableBot")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
