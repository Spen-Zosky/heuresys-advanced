exec(open("/tmp/claude-0/-home-user/2b3e97c4-c5ca-59cb-9dfe-3f111c2c1157/scratchpad/h.py").read())
sub("consolidation/page.tsx",'import { useFormat } from "@/lib/format";\n','import { useFormat } from "@/lib/format";\nimport { StatoErrore, StatoVuoto } from "@/components/stato-pagina";\n')
f="content/[id]/page.tsx"
sub(f,'''        <p className="text-sm text-danger">{t("content.detail.notFound")}</p>''','''        <StatoErrore
          errore={detail.error}
          titolo={t("content.detail.notFound")}
          onRiprova={() => void detail.refetch()}
        />''')
sub(f,'''            <p data-testid="content-links-empty" className="text-sm text-muted-foreground">{t("content.links.empty")}</p>''','''            <StatoVuoto titolo={t("content.links.empty")} testId="content-links-empty" />''')
sub(f,'import { useCurrentUserPermissions } from "@/lib/api/auth";\n','import { useCurrentUserPermissions } from "@/lib/api/auth";\nimport { StatoErrore, StatoVuoto } from "@/components/stato-pagina";\n')
f="content/page.tsx"
sub(f,'''                <p className="text-sm text-muted-foreground">{t("content.search.loading")}</p>
              ) : search.isError ? (
                <p data-testid="content-search-error" role="alert" className="text-sm font-medium text-danger">
                  {t("content.search.errorMessage")}
                </p>
              ) : (search.data?.items.length ?? 0) === 0 ? (
                <div data-testid="content-search-empty" className="rounded-card border border-border px-4 py-3">
                  <p className="text-sm font-medium text-foreground">{t("content.search.emptyTitle")}</p>
                  <p className="text-xs text-muted-foreground">{t("content.search.emptyDescription", { q: searchQDebounced })}</p>
                </div>''','''                <StatoCaricamento etichetta={t("content.search.loading")} />
              ) : search.isError ? (
                <StatoErrore
                  errore={search.error}
                  titolo={t("content.search.errorMessage")}
                  testId="content-search-error"
                  onRiprova={() => void search.refetch()}
                />
              ) : (search.data?.items.length ?? 0) === 0 ? (
                <StatoVuoto
                  testId="content-search-empty"
                  titolo={t("content.search.emptyTitle")}
                  motivo={t("content.search.emptyDescription", { q: searchQDebounced })}
                />''')
sub(f,'''            <p className="text-sm text-muted-foreground">{t("content.categories.empty")}</p>''','''            <StatoVuoto titolo={t("content.categories.empty")} />''')
