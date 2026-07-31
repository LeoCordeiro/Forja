# Roadmap vivo — Forja

Estado do ciclo atual. Toda sessão `/sprint` lê este arquivo, executa a
primeira fase `pendente` e atualiza o status ao terminar. Regras: `AGENTS.md`.

**Rodada atual:** auditoria 2026-07-29 —
`docs/auditoria-2026-07-29/consolidado-cto.md` (30 achados).

**Repriorizado 30/07 pelo Leonardo:** a criação de treino está genérica demais —
motor de treino sobe para próxima fase. Coincide com a prioridade que o próprio
fitness-scientist sugeriu no relatório ("1 e 2 antes de tudo"; o 1 já foi).

| # | Fase | Itens | Status |
|---|------|-------|--------|
| 1 | Nada se perde | F1 U3 U4 N1 N2 | **feita** — commit `97f480f`, verificação independente 30/07 |
| 2 | Motor de treino | F2 F3 F4 F6 | **aguardando-aprovação** — 31/07, implementada + cross-review duplo (qa reprovou 1ª rodada com 1 ALTO, corrigido e re-aprovado; fitness-scientist aprovou os 4 com ressalvas → candidatos abaixo). Ver "Validação da fase 2" |
| 3 | Prescrição completa | F8 F9 F10 | pendente — aquecimento gerado + toggle, dose de cardio por objetivo, fonte única de volume |
| 4 | Série em 1 toque | U1 U2 U5 U6 U7 | pendente — validar no celular, não só navegador |
| 5 | Segurança e nutrição | F5 N3 N6 N8 U8 | pendente |
| 6 | Sobras do P2 | F7 N4 N10 | pendente |
| 7 | Re-auditoria (rodada 2) | comparar com o consolidado atual | após as fases acima |

P3 (backlog): só quando tocar no domínio correspondente — lista no consolidado.

**Aviso para a fase 2** (do relatório do fitness-scientist): as citações que já
estão no código (`ACSM 2026` em volume.ts, Baz-Valle/Coleman em programa.ts,
Refalo/Nuzzo/Haugen em gerador.ts) NÃO foram verificadas — não tratar como
evidência nem reaproveitar em texto de produto sem WebFetch antes. As 5 fontes
verificadas estão no cabeçalho do fitness.md.

## Validação da fase 2 (31/07/2026)

Working tree, sem commit. `tsc --noEmit` limpo (3×, a última no re-review do qa).
Sem mudança de schema → gate de migração não se aplica.

**Validado no navegador a 390×844, clicando (fluxo real, onboarding → 2 sessões):**

- F2: card do check-in com fase do bloco ("Semana 1 · Calibrar" + o que fazer +
  RIR) — antes só existia para plano de retorno; chip "Calibrar · RIR 3" no
  cabeçalho do executor nas duas sessões.
- F3 completo: sessão 1 com Leg press 3×60×12 (topo da faixa) → sessão 2 abre
  com selo "Hora de subir: 65 kg" (60+5 de perna) e campo de peso vazio herdando
  65; Agachamento (série de 8, dentro da faixa) sem selo, como especificado.
- F4 completo: série 40×15 gravada NÃO gerou recorde de e1RM; recorde exibido =
  50,7 kg vindo da série 40×8 (fórmula antiga teria cravado 60 kg da série de 15
  e travado os PRs seguintes); "Últimas sessões" com 1RM do dia correto e sem
  ponto zerado no gráfico. Edição de série (5444→40) recalculou volume e PRs.
- F6: tela "O que travou" renderiza sem erro com as queries novas.
- Regressão: nenhuma observada; XP (209), streak (1) e finalização normais.
  Único erro de console: WakeLock do `expo-keep-awake` com aba oculta (ambiente
  de dev, já documentado na memória).

**Não validado no navegador (e por quê):**

- F2 modulação reduzida (deload 55% / readaptação 50-80%): exige fase ativa —
  banco novo está na semana 1 (100%) e NÃO EXISTE caminho de UI para registrar
  pausa pós-onboarding (virou candidato abaixo). Coberto pela re-simulação de
  cenário do qa (rampa 67/73/80 verificada passo a passo após a correção do
  ALTO). **Teste no celular do Leonardo deve incluir isso quando houver pausa
  real.**
- F6 retorno de dados de travados/evoluindo: exige 3+ sessões de histórico;
  banco de teste tem 1. Lógica revisada por 2 agentes (score da mesma série,
  bare columns com MAX único conferidos).
- Selo "Volta leve" (readaptação): mesma dependência de fase ativa acima.

**ALTO pego e corrigido no cross-review:** herança de carga da readaptação
compunha `cargaPct` sobre a sessão já reduzida (100 kg → 67 → 45 → 33... quando
o plano pede 67% → 80% da carga PRÉ-pausa). Corrigido: `pesoDeVolta` só quando a
série anterior é anterior à retomada (`registrado_em < retomadaEmMs`); pós-pausa
herda direto. + 1 MÉDIO (índice esparso podia esconder série gravada da tela) e
2 BAIXOs (gate de tipo de carga na herança; catch no load da fase).

## Riscos abertos

- **OPFS:** derrubar o worker no meio de uma escrita zera o banco inteiro
  (observado no dev web). Investigar se o PWA real tem janela parecida
  (navegador/iOS matando o processo em segundo plano). Enquanto aberto,
  "nada se perde" não está 100% — mitigação possível: backup automático
  periódico para localStorage/arquivo.

## Não se confirmou

(vazio)

## Candidatos à próxima rodada

(achados novos encontrados durante sprints entram aqui, nunca viram código
fora da própria fase)

Da fase 2 (31/07 — fitness-scientist R1-R8 + descobertas da validação):

1. **Avaliador de progressão cego ao contexto da sessão-baseline** (R2, MÉDIA):
   após deload (RIR 4-5 de propósito), reps baixas viram "Segure a carga" falso;
   e a 1ª sessão após obedecer "Hora de subir" derruba o score da melhor série
   (100×12→102,5×8) — o detector de estagnação pode carimbar "travado" pelo
   salto que o próprio app sugeriu. `semana_plano` da sessão anterior + carga
   maior no top-set bastam para suprimir os dois.
2. **Sem caminho de UI para registrar pausa pós-onboarding**: `retomou_em`/
   `meses_parado` só nascem no onboarding — quem parar DEPOIS de usar o app
   nunca ganha plano de retorno (e a modulação F2 fica inalcançável). Achado da
   validação browser.
3. **Incrementos por equipamento** (R4): 1,25 kg para grupo pequeno (alinhar com
   o conselho do próprio detector em `estagnacao.ts`), degrau de pino para
   máquina, validar montabilidade via `anilhas.ts` (que já tem a matemática).
4. **Pirâmide × gatilho "todas ≥ topo"** (R3): top-set pesado proposital recebe
   "segurar" crônico; pirâmide descendente nunca dispara subida. Registrado como
   limitação conhecida do gatilho canônico.
5. **Deload do plano de retorno: dados dizem carga 85%, executor mantém 100%**
   (R5): uniformizar — recomendação do fitness: `cargaPct: null` naquela semana.
6. **Vácuo de periodização pós-bloco vencido** (R6): sem deload nunca mais até
   recriar rotina; ação "recomeçar bloco" no aviso de vencimento.
7. **`app/programa.tsx` ainda clampa `semanaDoBloco`** (R7): mostra "Semana 8 ·
   55%" para sempre após vencer, enquanto o executor (correto) aplica 100% —
   duas fontes de verdade de fase de novo. Unificar com `resolverFase`.
8. **Semanas 5-7: "+1 série nos 2 principais" sem mecanismo** — o texto do bloco
   promete; virar sugestão opt-in no executor (não inflação silenciosa).
9. **`evoluindo` compara só peso** (fitness): progresso feito só em repetições é
   invisível na lista motivacional; comparar score da mesma série e excluir
   sessões moduladas.
10. **Verificar `reps` NULL em `personal_records` antigos do banco real** (R8):
    linha de e1rm com reps NULL é silenciosamente excluída da comparação/exibição
    pelo teto novo — aceitável, mas conferir no celular do Leonardo.
11. **F8 (aquecimento)**: `anilhas.ts` já tem `aquecimento()` pronto e órfão —
    par natural da readaptação, melhor custo/benefício do relatório original
    ainda não implementado (já está na fase 3 do roadmap).
