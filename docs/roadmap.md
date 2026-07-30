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
| 2 | Motor de treino | F2 F3 F4 F6 | **pendente — PRÓXIMA.** Ler `docs/auditoria-2026-07-29/fitness.md` INTEGRAL antes (soluções detalhadas por achado). Cross-review do fitness-scientist obrigatório |
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
