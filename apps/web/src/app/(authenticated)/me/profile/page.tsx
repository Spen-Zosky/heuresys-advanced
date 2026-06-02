"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, PageHeader } from "@heuresys/ui";
import { apiFetch } from "../../../../lib/api/fetch";
import { useMyPreferences, useUpdateMyPreferences } from "../../../../lib/api/auth";
import type { MeTheme, MePalette } from "@heuresys/shared";

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

const THEME_OPTIONS: { value: MeTheme; label: string }[] = [
  { value: "dark", label: "Scuro" },
  { value: "light", label: "Chiaro" },
];
const PALETTE_OPTIONS: { value: MePalette; label: string }[] = [
  { value: "balanced", label: "Balanced" },
  { value: "cool-ocean", label: "Cool ocean" },
  { value: "warm-sunset", label: "Warm sunset" },
  { value: "brand-mono", label: "Brand mono" },
];

/** WS-4 P1 — theme + palette controls. Server is the source of truth (PATCH /v1/me/preferences);
 *  the layout's PreferencesApplier re-applies the saved choice on every session. */
function AppearanceCard() {
  const prefs = useMyPreferences();
  const update = useUpdateMyPreferences();
  const theme = prefs.data?.theme;
  const palette = prefs.data?.palette;

  return (
    <Card>
      <CardHeader><CardTitle>Aspetto</CardTitle></CardHeader>
      <CardContent>
        {prefs.isLoading ? (
          <span className="text-sm text-muted-foreground">Caricamento…</span>
        ) : (
          <div className="space-y-4" data-testid="me-appearance">
            <div className="space-y-1">
              <span className="text-sm font-medium text-foreground">Tema</span>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Tema">
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
                    {o.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-sm font-medium text-foreground">Palette</span>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Palette">
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
                    {o.label}
                  </Button>
                ))}
              </div>
            </div>
            {update.isError && (
              <p className="text-sm text-danger" data-testid="pref-error">
                Errore durante il salvataggio.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function MeProfilePage() {
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
    <main data-testid="me-profile-page" className="mx-auto max-w-3xl space-y-6 px-6 py-8">
      <PageHeader
        data-testid="me-profile-title"
        title="Profilo"
        description="Gestisci i tuoi dati anagrafici e le preferenze di contatto."
        badges={
          <Badge variant="secondary" data-testid="me-profile-email">
            {profile.data?.email ?? "…"}
          </Badge>
        }
      />

      <Card>
        <CardHeader><CardTitle>Anagrafica</CardTitle></CardHeader>
        <CardContent>
          {profile.isLoading ? (
            <span className="text-sm text-muted-foreground">Caricamento…</span>
          ) : (
            <form
              onSubmit={(e) => { void onSubmit(e); }}
              className="space-y-4"
              data-testid="me-profile-form"
            >
              <div className="space-y-1">
                <label htmlFor="displayName" className="text-sm font-medium text-foreground">Nome visualizzato</label>
                <Input id="displayName" data-testid="profile-displayName" {...register("displayName")} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label htmlFor="locale" className="text-sm font-medium text-foreground">Locale</label>
                  <Input id="locale" data-testid="profile-locale" placeholder="it-IT" {...register("locale")} />
                </div>
                <div className="space-y-1">
                  <label htmlFor="timezone" className="text-sm font-medium text-foreground">Timezone</label>
                  <Input id="timezone" data-testid="profile-timezone" placeholder="Europe/Rome" {...register("timezone")} />
                </div>
              </div>
              <div className="space-y-1">
                <label htmlFor="phone" className="text-sm font-medium text-foreground">Telefono</label>
                <Input id="phone" data-testid="profile-phone" {...register("phone")} />
              </div>
              <div className="space-y-1">
                <label htmlFor="linkedinUri" className="text-sm font-medium text-foreground">LinkedIn URL</label>
                <Input id="linkedinUri" data-testid="profile-linkedinUri" {...register("linkedinUri")} />
              </div>
              <div className="space-y-1">
                <label htmlFor="bio" className="text-sm font-medium text-foreground">Bio</label>
                <Input id="bio" data-testid="profile-bio" {...register("bio")} />
              </div>

              {update.isSuccess && (
                <p className="text-sm text-success" data-testid="profile-saved">Salvato.</p>
              )}
              {update.isError && (
                <p className="text-sm text-danger" data-testid="profile-error">
                  Errore durante il salvataggio.
                </p>
              )}

              <Button
                type="submit"
                data-testid="profile-submit"
                disabled={isSubmitting || update.isPending || !isDirty}
              >
                {update.isPending ? "Salvataggio…" : "Salva modifiche"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <AppearanceCard />
    </main>
  );
}
