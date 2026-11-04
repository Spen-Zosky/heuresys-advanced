exec(open("/tmp/claude-0/-home-user/2b3e97c4-c5ca-59cb-9dfe-3f111c2c1157/scratchpad/h.py").read())
# compensation-intelligence
f="compensation-intelligence/page.tsx"
sub(f,'''        <p className="text-sm text-muted-foreground">{t("common:loading")}</p>
      ) : q.isError ? (
        <p className="text-sm text-danger" data-testid="comp-evaluation-error">
          {t("compReward.error")}
        </p>''','''        <StatoCaricamento />
      ) : q.isError ? (
        <StatoErrore
          errore={q.error}
          titolo={t("compReward.error")}
          testId="comp-evaluation-error"
          onRiprova={() => void q.refetch()}
        />''')
sub(f,'''          ) : (
            <p className="py-12 text-center text-xs text-muted-foreground">
              {dist.isLoading ? t("common:loading") : t("compensation.distributionEmpty")}
            </p>
          )}''','''          ) : dist.isLoading ? (
            <StatoCaricamento />
          ) : (
            <StatoVuoto titolo={t("compensation.distributionEmpty")} />
          )}''')
imp(f,["StatoCaricamento","StatoErrore","StatoVuoto"],'import { apiFetch } from "@/lib/api/fetch";\n')
# consolidation
f="consolidation/page.tsx"
sub(f,'''        <div data-testid="consolidation-load-error" className="rounded-card border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
          {t("consolidation.loadError")}
        </div>''','''        <StatoErrore
          errore={access.error ?? sessions.error}
          titolo={t("consolidation.loadError")}
          testId="consolidation-load-error"
          onRiprova={() => {
            void access.refetch();
            void sessions.refetch();
          }}
        />''')
sub(f,'''        <Card data-testid="consolidation-empty">
          <CardHeader><CardTitle>{t("consolidation.emptyTitle")}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>{t("consolidation.emptyDescription")}</p>
            {canRun ? (
              <Button type="button" data-testid="consolidation-start" disabled={occupato} onClick={() => start.mutate()}>
                {t("consolidation.start")}
              </Button>
            ) : null}
          </CardContent>''','''@@EMPTY@@''')
