exec(open("/tmp/claude-0/-home-user/2b3e97c4-c5ca-59cb-9dfe-3f111c2c1157/scratchpad/h.py").read())
f="approvals/[id]/page.tsx"
sub(f,'''        <p className="text-sm text-muted-foreground" data-testid="approval-detail-loading">{t("common:loading")}</p>
      ) : detail.isError || !d ? (
        <p className="text-sm text-danger" data-testid="approval-detail-error">{t("approvals.detail.notFound")}</p>''','''        <StatoCaricamento testId="approval-detail-loading" />
      ) : detail.isError || !d ? (
        <StatoErrore
          errore={detail.error}
          titolo={t("approvals.detail.notFound")}
          testId="approval-detail-error"
          onRiprova={() => void detail.refetch()}
        />''')
imp(f,["StatoCaricamento","StatoErrore"],'import { AgentPanel, Badge, Button, Card, CardContent, CardHeader, CardTitle, PageHeader } from "@heuresys/ui";\n')
f="blueprints/[variantId]/page.tsx"
sub(f,'''        <span className="text-sm text-muted-foreground">{t("common:loading")}</span>''','''        <StatoCaricamento />''')
sub(f,'''      <main className="mx-auto max-w-5xl px-6 py-8" data-testid="blueprint-error">
        <Link href="/blueprints" className="text-sm underline">{t("detail.back")}</Link>
        <p className="mt-4 text-danger">
          {status === 404 ? t("detail.notFound") : t("detail.error")}
        </p>''','''      <main className="mx-auto max-w-5xl px-6 py-8">
        <Link href="/blueprints" className="text-sm underline">{t("detail.back")}</Link>
        <div className="mt-4">
          <StatoErrore
            errore={variant.error}
            titolo={status === 404 ? t("detail.notFound") : t("detail.error")}
            testId="blueprint-error"
            onRiprova={() => void variant.refetch()}
          />
        </div>''')
imp(f,["StatoCaricamento","StatoErrore"],'import { Card, CardContent, CardHeader, CardTitle, PageHeader } from "@heuresys/ui";\n')
f="career-succession/page.tsx"
sub(f,'''              <p className="py-10 text-center text-xs text-muted-foreground">
                {readinessDist.isLoading ? t("common:loading") : t("career.pipelineEmpty")}
              </p>''','''              readinessDist.isLoading ? (
                <StatoCaricamento />
              ) : (
                <StatoVuoto titolo={t("career.pipelineEmpty")} />
              )''')
imp(f,["StatoCaricamento","StatoVuoto"],'import { PageHeader } from "@heuresys/ui";\n')
