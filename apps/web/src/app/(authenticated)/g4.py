exec(open("/tmp/claude-0/-home-user/2b3e97c4-c5ca-59cb-9dfe-3f111c2c1157/scratchpad/h.py").read())
f="consolidation/page.tsx"
sub(f,'''@@EMPTY@@
        </Card>''','''        <StatoVuoto
          testId="consolidation-empty"
          titolo={t("consolidation.emptyTitle")}
          motivo={t("consolidation.emptyDescription")}
          azione={
            canRun ? (
              <Button type="button" data-testid="consolidation-start" disabled={occupato} onClick={() => start.mutate()}>
                {t("consolidation.start")}
              </Button>
            ) : undefined
          }
        />''')
