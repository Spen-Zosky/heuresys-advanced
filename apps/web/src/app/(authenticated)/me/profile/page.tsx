"use client";

import { Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, PageHeader } from "@heuresys/ui";
import type { MeProfileFull, MeTheme, MePalette } from "@heuresys/shared";
import { apiFetch } from "../../../../lib/api/fetch";
import { useMyPreferences, useUpdateMyPreferences } from "../../../../lib/api/auth";
import { ProfileTabs, type ProfileTabDef } from "../../../../components/profile-tabs";
import { OverviewTab } from "./_components/overview-tab";
import { OrganizationTab } from "./_components/organization-tab";
import { ContractsTab } from "./_components/contracts-tab";
import { DocumentsTab } from "./_components/documents-tab";

interface MeProfile {
  userId: string;
  email: string;
  displayName: string | null;
  tenantId: string | null;
  locale: string | null;
  timezone: string | null;
  bio: string | null;
  phone: string | null;
  linkedinUri: string | null;
}

const ProfileFormSchema = z.object({
  displayName: z.string().min(1).max(255),
  locale: z.string().max(16).optional(),
  timezone: z.string().max(64).optional(),
  bio: z.string().max(4096).optional(),
  phone: z.string().max(64).optional(),
  linkedinUri: z.string().max(4096).optional(),
});
type ProfileFormValues = z.infer<typeof ProfileFormSchema>;

const THEME_OPTIONS: { value: MeTheme; labelKey: string }[] = [
  { value: "dark", labelKey: "profile.theme.dark" },
  { value: "light", labelKey: "profile.theme.light" },
];
const PALETTE_OPTIONS: { value: MePalette; labelKey: string }[] = [
  { value: "balanced", labelKey: "profile.palette.balanced" },
  { value: "cool-ocean", labelKey: "profile.palette.coolOcean" },
  { value: "warm-sunset", labelKey: "profile.palette.warmSunset" },
  { value: "brand-mono", labelKey: "profile.palette.brandMono" },
];

/** WS-4 P1 — theme + palette controls. Server is the source of truth (PATCH /v1/me/preferences);
 *  the layout's PreferencesApplier re-applies the saved choice on every session. */
function AppearanceCard() {
  const { t } = useTranslation("ess");
  const prefs = useMyPreferences();
  const update = useUpdateMyPreferences();
  const theme = prefs.data?.theme;
  const palette = prefs.data?.palette;

  return (
    <Card>
      <CardHeader><CardTitle>{t("profile.appearanceTitle")}</CardTitle></CardHeader>
      <CardContent>
        {prefs.isLoading ? (
          <span className="text-sm text-muted-foreground">{t("common:loading")}</span>
        ) : (
          <div className="space-y-4" data-testid="me-appearance">
            <div className="space-y-1">
              <span className="text-sm font-medium text-foreground">{t("profile.themeLabel")}</span>
              <div className="flex flex-wrap gap-2" role="group" aria-label={t("profile.themeLabel")}>
                {THEME_OPTIONS.map((o) => (
                  <Button
                    key={o.value}
                    type="button"
                    size="sm"
                    variant={theme === o.value ? "default" : "outline"}
                    data-testid={`pref-theme-${o.value}`}
                    disabled={update.isPending}
                    onClick={() => { void update.mutateAsync({ theme: o.value }); }}
                  >
                    {t(o.labelKey)}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-sm font-medium text-foreground">{t("profile.paletteLabel")}</span>
              <div className="flex flex-wrap gap-2" role="group" aria-label={t("profile.paletteLabel")}>
                {PALETTE_OPTIONS.map((o) => (
                  <Button
                    key={o.value}
                    type="button"
                    size="sm"
                    variant={palette === o.value ? "default" : "outline"}
                    data-testid={`pref-palette-${o.value}`}
                    disabled={update.isPending}
                    onClick={() => { void update.mutateAsync({ palette: o.value }); }}
                  >
                    {t(o.labelKey)}
                  </Button>
                ))}
              </div>
            </div>
            {update.isError && (
              <p className="text-sm text-danger" data-testid="pref-error">
                {t("profile.errorSave")}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Edit form for the editable subset (displayName/locale/timezone/phone/linkedin/bio). */
function SettingsForm() {
  const { t } = useTranslation("ess");
  const qc = useQueryClient();
  const profile = useQuery({
    queryKey: ["me", "profile"],
    queryFn: () => apiFetch<MeProfile>("/v1/me/profile"),
  });

  const update = useMutation({
    mutationFn: (body: ProfileFormValues) =>
      apiFetch<MeProfile>("/v1/me/profile", { method: "PATCH", body }),
    onSuccess: (next) => qc.setQueryData(["me", "profile"], next),
  });

  const { register, handleSubmit, reset, formState: { isSubmitting, isDirty } } =
    useForm<ProfileFormValues>({
      resolver: zodResolver(ProfileFormSchema),
      values: profile.data
        ? {
            displayName: profile.data.displayName ?? "",
            locale: profile.data.locale ?? "",
            timezone: profile.data.timezone ?? "",
            bio: profile.data.bio ?? "",
            phone: profile.data.phone ?? "",
            linkedinUri: profile.data.linkedinUri ?? "",
          }
        : undefined,
    });

  const onSubmit = handleSubmit(async (vals) => {
    await update.mutateAsync(vals);
    reset(vals);
  });

  return (
    <Card>
      <CardHeader><CardTitle>{t("profile.anagraficaTitle")}</CardTitle></CardHeader>
      <CardContent>
        {profile.isLoading ? (
          <span className="text-sm text-muted-foreground">{t("common:loading")}</span>
        ) : (
          <form onSubmit={(e) => { void onSubmit(e); }} className="space-y-4" data-testid="me-profile-form">
            <div className="space-y-1">
              <label htmlFor="displayName" className="text-sm font-medium text-foreground">{t("profile.displayNameLabel")}</label>
              <Input id="displayName" data-testid="profile-displayName" {...register("displayName")} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label htmlFor="locale" className="text-sm font-medium text-foreground">{t("profile.localeLabel")}</label>
                <Input id="locale" data-testid="profile-locale" placeholder="it-IT" {...register("locale")} />
              </div>
              <div className="space-y-1">
                <label htmlFor="timezone" className="text-sm font-medium text-foreground">{t("profile.timezoneLabel")}</label>
                <Input id="timezone" data-testid="profile-timezone" placeholder="Europe/Rome" {...register("timezone")} />
              </div>
            </div>
            <div className="space-y-1">
              <label htmlFor="phone" className="text-sm font-medium text-foreground">{t("profile.phoneLabel")}</label>
              <Input id="phone" data-testid="profile-phone" {...register("phone")} />
            </div>
            <div className="space-y-1">
              <label htmlFor="linkedinUri" className="text-sm font-medium text-foreground">{t("profile.linkedinLabel")}</label>
              <Input id="linkedinUri" data-testid="profile-linkedinUri" {...register("linkedinUri")} />
            </div>
            <div className="space-y-1">
              <label htmlFor="bio" className="text-sm font-medium text-foreground">{t("profile.bioLabel")}</label>
              <Input id="bio" data-testid="profile-bio" {...register("bio")} />
            </div>

            {update.isSuccess && (
              <p className="text-sm text-success" data-testid="profile-saved">{t("profile.saved")}</p>
            )}
            {update.isError && (
              <p className="text-sm text-danger" data-testid="profile-error">{t("profile.errorSave")}</p>
            )}

            <Button type="submit" data-testid="profile-submit" disabled={isSubmitting || update.isPending || !isDirty}>
              {update.isPending ? t("profile.submitting") : t("profile.submit")}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

/** Read-only tabbed view (Panoramica + Organizzazione) fed by GET /v1/me/profile/full. */
function ProfileTabsSection() {
  const { t } = useTranslation("ess");
  const full = useQuery({
    queryKey: ["me", "profile", "full"],
    queryFn: () => apiFetch<MeProfileFull>("/v1/me/profile/full"),
  });

  if (full.isLoading) {
    return <span className="text-sm text-muted-foreground" data-testid="profile-full-loading">{t("common:loading")}</span>;
  }
  if (full.isError || !full.data) {
    return <p className="text-sm text-danger" data-testid="profile-full-error">{t("profile.full.error")}</p>;
  }
  const data = full.data;
  const tabs: ProfileTabDef[] = [
    {
      id: "panoramica", label: t("profile.full.tabs.overview"),
      testId: "profile-tab-panoramica", render: () => <OverviewTab data={data} />,
    },
    {
      id: "organizzazione", label: t("profile.full.tabs.organization"),
      testId: "profile-tab-organizzazione", render: () => <OrganizationTab data={data} />,
    },
    {
      id: "contratti", label: t("profile.full.tabs.contracts"),
      testId: "profile-tab-contratti", render: () => <ContractsTab />,
    },
    {
      id: "documenti", label: t("profile.full.tabs.documents"),
      testId: "profile-tab-documenti", render: () => <DocumentsTab />,
    },
  ];
  return <ProfileTabs tabs={tabs} ariaLabel={t("profile.full.tabs.aria")} />;
}

export default function MeProfilePage() {
  const { t } = useTranslation("ess");
  const profile = useQuery({
    queryKey: ["me", "profile"],
    queryFn: () => apiFetch<MeProfile>("/v1/me/profile"),
  });

  return (
    <main data-testid="me-profile-page" className="mx-auto max-w-5xl space-y-8 px-6 py-8">
      <PageHeader
        data-testid="me-profile-title"
        title={t("profile.title")}
        description={t("profile.description")}
        badges={
          <Badge variant="secondary" data-testid="me-profile-email">
            {profile.data?.email ?? "…"}
          </Badge>
        }
      />

      <Suspense fallback={<span className="text-sm text-muted-foreground">{t("common:loading")}</span>}>
        <ProfileTabsSection />
      </Suspense>

      <section className="space-y-6" data-testid="me-profile-settings">
        <h2 className="text-lg font-semibold text-foreground">{t("profile.settingsTitle")}</h2>
        <SettingsForm />
        <AppearanceCard />
      </section>
    </main>
  );
}
