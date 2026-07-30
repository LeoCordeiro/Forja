# Consolidação CTO — auditoria 2026-07-29

30 achados (10 fitness, 10 nutrição, 10 UX). Relatórios integrais: `fitness.md`, `nutricao.md`, `ux-ui.md`.
IDs: F = fitness, N = nutrição, U = UX. Esforço: S ≤ ~1h de sessão, M = meia sessão, L = sessão inteira+.

## Padrão transversal

O defeito dominante da Forja não é regra errada — é **fio desligado**: a camada de conhecimento
está certa (validada com fonte) e a camada executável não a consome. Periodização/deload só
texto (F2), progressão dupla nunca verificada (F3), aquecimento só no schema (F8),
`deficitMaximoSeguro`/`projetar`/`combinaComPreferencias`/`VOLUME_SEMANAL`/`descansoSugerido`
código morto (N8, N4, F10), fibra no banco e invisível (N5), `HIT = 52` definido e ignorado na
tela mais tocada (U2). Segundo padrão: **o app promete em texto o que o código contradiz** —
"a troca vale só hoje" (F1), "50% do volume na volta" (F2), "marcação conta para sequência" (F7).

## P0 — dados mentem ou se perdem (fazer antes de qualquer feature)

| ID | Achado | Impacto | Esforço |
|----|--------|---------|---------|
| F1 | Troca "só para hoje" grava permanente no template (viola regra 1) | Corrompe o plano e a comparabilidade do bloco | M |
| U3 | Gravação de série falha em silêncio (verde na tela, nada no banco) | Perde histórico — o produto — sem avisar | S |
| U4 | "Cancelar treino" apaga tudo com 1 toque, sem confirmação | Perda irreversível por erro motor | S |
| N1 | Botão "Recalcular" ressuscita o bug do commit 774fd4c (proteína sobre peso total) | Meta errada persistida como 'manual' | S |
| N2 | Trocar objetivo/atividade não recalcula a meta | Meta contraria o objetivo declarado por semanas | S |

## P1 — anulam a proposta de valor central

| ID | Achado | Impacto | Esforço |
|----|--------|---------|---------|
| U1+U2 | Registrar série: 4 toques + alvos de 34pt (HIT=52 ignorado) | O gesto central do app, 20×/treino | M |
| F3 | Progressão dupla não existe em código; UI induz a repetir carga | A promessa do app vira iniciativa do usuário | M |
| F2 | Deload/readaptação nunca aplicados à prescrição | Risco tendíneo no retorno; fadiga no fim do bloco | M |
| F4 | e1RM sem teto de reps + 2 fórmulas divergentes → PR falso trava PRs reais | Recordes e gráfico mentem; XP indevido | S |
| F5 | Substituição em sessão ignora dor e local; listas de dor com buracos | Sugere o exercício contraindicado na hora da pressa | M |
| N3 | Proteína de emagrecimento sobre peso total (264 g p/ 120 kg) | Meta inatingível no objetivo com mais gordura | S |

## P2 — coerência e qualidade

| ID | Achado | Esforço |
|----|--------|---------|
| F6 | Estagnação: score mistura séries; lista "evoluindo" nunca retorna (SQL) | S |
| F7 | Streak zera com aderência perfeita 3×/semana; treino manual não conta | S |
| N6 | TMB medido nunca expira → déficit real encolhe com o tempo | S |
| N8 | Sem piso calórico; `deficitMaximoSeguro` é código morto; carbo 0 g silencioso | S |
| U5 | Contraste 3:1 na coluna "Anterior" (decide a carga) em 12 px | S |
| U6 | Timer de descanso some quando o NumberPad abre | S |
| U7 | Série adicionada por engano não pode ser removida; trava auto-avanço | S |
| U8 | Teclado cobre Input nos Sheets (nota de setup, edições) | S |
| N4 | Cardápio ignora restrição alimentar, preferências e meta de proteína | M |
| N10 | `planoDoDia` derruba o pós-treino de quem treina à noite | S |

## P3 — backlog (fazer quando tocar no domínio)

F8 aquecimento (toggle + geração), F9 dose de cardio + query de recuperação, F10 constantes
de volume triplicadas, N5 fibra (migração `fibra_snap`), N7 meta de água congelada,
N9 alimentos de "vida real" no seed, U9 CTA do treino abaixo da dobra na Home, U10 skeletons,
cache de `i.ytimg.com` no SW, XP/streak para dieta, medalha `dieta_dias` vs meta atual.

## Roadmap de sessões (uma fase por sessão, conforme AGENTS.md)

1. **"Nada se perde"** — P0 inteiro: F1, U3, U4, N1, N2. Tema único: integridade de dados.
   mobile-expo implementa, qa cross-review.
2. **"Série em 1 toque"** — U1, U2, U5, U6, U7: é um único redesign da linha de série +
   theme. Validar no celular de verdade, não no navegador.
3. **"Motor de treino"** — F2, F3, F4, F6: fase aplicada à sessão, sugestão de progressão,
   teto do e1RM, correção do detector. fitness-scientist revisa o resultado (sem editar).
4. **"Segurança e nutrição"** — F5, N3, N6, N8, U8: contraindicações na troca, proteína
   unificada em massa magra, expiração do TMB medido, pisos caloricos.
5. Backlog conforme demanda.

## O que NÃO mexer (validado pelos auditores)

Descanso 180/150/90/60 s, volume 10–20 (foco 28) com contagem fracionada, frequência 2×/grupo
e divisões, preferência bicicleta > corrida, ordem de exercícios e as correções recentes do
gerador, CRUD de PRs na edição de série, Mifflin-St Jeor, Deurenberg, déficit/superávit 15%,
snapshot de refeição, 2,4 g/kg MM na recomposição (é a nota do cofre que está desatualizada,
não o código), e toda a engenharia do descanso/recuperação de sessão/NumberPad/atualização PWA.
