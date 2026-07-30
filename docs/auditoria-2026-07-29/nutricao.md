# Auditoria da camada de nutrição — Forja

> Agente: nutricionista · 2026-07-29 · escopo: src/features/dieta/, src/features/perfil/,
> src/db/seed/, telas de dieta e gamificação ligada a dieta. Nenhum arquivo editado.

**Fontes verificadas nesta sessão via WebFetch:** Helms et al. 2014 (https://pubmed.ncbi.nlm.nih.gov/24092765/ — proteína em déficit para treinados: 2,3–3,1 g/kg de **massa magra**, escalando com severidade do déficit e magreza) e ISSN Position Stand, Jäger et al. 2017 (https://pubmed.ncbi.nlm.nih.gov/28642676/ — 1,4–2,0 g/kg/dia geral; 2,3–3,1 g/kg/dia em restrição calórica para treinados). Todo o resto está escrito como prática comum, sem citação.

**O que está certo e merece registro:** Mifflin-St Jeor com coeficientes corretos (`src/features/perfil/calculos.ts:61-72`), fatores de atividade padrão, déficit/superávit de 15% coerente com a decisão do cofre, Deurenberg com coeficientes corretos e faixa de plausibilidade (`recomposicao.ts:80-91`), snapshot de refeição consumida respeitado de ponta a ponta (`meal_log_items` com colunas `_snap`, gravação em `src/features/dieta/api.ts:180-229`), IMC/TMB/TDEE calculados e nunca armazenados, spot-check dos valores TACO do seed sem erro (frango 159/32, patinho 219/35,9, feijão carioca 76/4,8/13,6/8,5, banana prata 98).

---

## 1. CRÍTICO — A correção da proteína de recomposição tem uma regressão viva na tela de perfil

**Problema:** O botão "Recalcular automaticamente" da folha de ajuste de meta volta a calcular a proteína de recomposição sobre o peso total — exatamente o bug que o commit `774fd4c` corrigiu.
**Causa:** `app/(tabs)/perfil.tsx:537-544` chama `macros(metaCalorica(tdeeValor, objetivo), pesoKg, objetivo)` — o caminho genérico de `src/features/perfil/calculos.ts:103-120`, que para `recomposicao` usa 2,4 g/kg de **peso total**. O caminho corrigido (`macrosRecomposicao`, sobre massa magra) só é usado por `calcularMeta` em `src/features/perfil/api.ts:296-311` e pelo onboarding (`app/onboarding.tsx:171-175`).
**Impacto:** Usuário de 84 kg com 42% de gordura que toca "Recalcular automaticamente" recebe 202 g de proteína em vez de ~117 g (2,4 × 48,7 kg de massa magra). Como o resultado é salvo com `salvarMeta(..., 'manual')` e `resumo()` prefere a meta salva (`perfil/api.ts:250-258`), o número errado vale até a próxima pesagem disparar `recalcularMeta`. O carboidrato é espremido em ~340 kcal para pagar essa proteína.
**Evidência:** `const m = macros(metaCalorica(tdeeValor, objetivo), pesoKg, objetivo);` (perfil.tsx:538) — nenhuma referência a `macrosRecomposicao`, `gorduraPct` ou `massaMagraKg` na `SheetMeta`, embora `resumo()` já entregue esses campos.
**Solução:** `SheetMeta.recalcular` deve chamar o mesmo `calcularMeta` de `perfil/api.ts` (passando `gorduraPct` e `dadosParaEstimar`). Um único ponto de cálculo de meta no app inteiro.
**Alternativas:** Expor `calcularMeta` como única função pública e tornar `macros()`/`metaCalorica()` internos ao módulo, para o typecheck impedir regressão; ou remover o botão e mostrar a meta auto como preview fixo.

## 2. CRÍTICO — Trocar objetivo ou nível de atividade não recalcula a meta salva

**Problema:** Editar o perfil (objetivo recomposição → hipertrofia, ou sedentário → intenso) salva o perfil e nada mais. A meta calórica exibida continua sendo a antiga.
**Causa:** `app/(tabs)/perfil.tsx:446-458` (`SheetEditar.salvar`) chama só `salvarPerfil`. `recalcularMeta` é disparado apenas ao registrar peso (`app/(tabs)/evolucao.tsx:301`) e bioimpedância (`app/bioimpedancia.tsx:62`). Como `resumo()` prefere a meta persistida em `nutrition_targets` (`src/features/perfil/api.ts:250-258`), a nova configuração só surte efeito na próxima pesagem.
**Impacto:** A pessoa muda para "Ganhar massa" e segue comendo com déficit de 15% — dias ou semanas de meta contrária ao objetivo declarado.
**Evidência:** `salvar()` em SheetEditar não contém `recalcularMeta` nem `salvarMeta`; o subtítulo da aba Dieta (`app/(tabs)/dieta.tsx:75`) exibe `r.meta.kcal` vindo da meta velha.
**Solução:** Chamar `recalcularMeta()` ao final de `SheetEditar.salvar` quando `objetivo` ou `nivel_atividade` mudarem.
**Alternativas:** Recalcular sempre que perfil for salvo; ou aviso "meta desatualizada" comparando `nutrition_targets.origem/valid_from` com a data de edição do perfil.

## 3. ALTO — Emagrecimento continua calculando proteína sobre o peso total

**Problema:** O objetivo `emagrecimento` usa 2,2 g/kg de peso total. É a mesma lógica "gordura consome proteína" que o commit tirou da recomposição, no objetivo onde a gordura corporal tende a ser mais alta.
**Causa:** `src/features/perfil/calculos.ts:103-112` (`gPorKg = 2.2` para emagrecimento, multiplicado por `pesoKg`); a rota `calcularMeta` (`src/features/perfil/api.ts:305-311`) só desvia para massa magra quando `objetivo === 'recomposicao'`.
**Impacto:** Pessoa de 120 kg com 40% de gordura em "Perder gordura" recebe 264 g de proteína/dia (1.056 kcal só de proteína) — inatingível e espreme o carboidrato. A mesma pessoa em "recomposição" (mesmo déficit) recebe ~173 g. Dois números muito diferentes para o mesmo corpo é incoerência de modelo.
**Evidência:** A ISSN (URL verificada) recomenda 2,3–3,1 g/kg/dia em restrição calórica **para treinados relativamente magros**; Helms (URL verificada) ancora a faixa em massa magra justamente para não escalar com a gordura. Nota: o comentário em `recomposicao.ts:132-133` cita "2,2 a 3,1 (Helms)" — o intervalo verificado é 2,3–3,1.
**Solução:** Unificar: emagrecimento passa pelo mesmo mecanismo de massa magra (medida ou Deurenberg) de `macrosRecomposicao`, com g/kg próprio (2,2–2,6 g/kg MM em déficit é defensável).
**Alternativas:** Peso ajustado (massa magra + fração da gordura) se quiser fórmula única sem % de gordura; ou teto absoluto de proteína mantendo o cálculo atual para IMC normal.

## 4. ALTO — O gerador de cardápio ignora restrições, preferências e a meta de proteína

**Problema:** `gerarCardapioSemanal` monta a semana olhando só kcal. Restrição alimentar, preferências e número de refeições configurado não entram; a proteína não é restrição do algoritmo.
**Causa:** `src/features/dieta/api.ts:322-374` usa `listarReceitas()` sem filtro e estrutura fixa de 5 refeições/horários. `combinaComPreferencias` (`src/features/dieta/preferencias.ts:88-115`) não tem nenhum chamador — código morto — e `diet_config.restricao/refeicoes_por_dia` e `food_prefs` nunca são consultados aqui. `planoDoDia` de `timing.ts` tampouco.
**Impacto:** Intolerante a lactose configurado como `sem-lactose` recebe receitas com whey/iogurte; quem come 3 refeições recebe 5; quem treina à noite recebe a mesma grade de quem treina em jejum. E o cardápio pode fechar as kcal com dias de 90 g de proteína contra meta de 150+.
**Evidência:** Loop em `api.ts:350-371` escolhe receita por `(dia + i) % opcoes.length` com filtro exclusivamente calórico; arredondamento de porções pode distorcer lanches com o pool atual de 12 receitas.
**Solução:** Encadear: filtrar por `combinaComPreferencias` (restrição + `categoriasQueCome` + `tempo_max_preparo`), usar `planoDoDia(horario_treino, refeicoes_por_dia)` como estrutura, e validar proteína do dia contra a meta — se faltar, promover a receita mais proteica no slot pós-treino.
**Alternativas:** Mínimo viável: só ligar o filtro de restrição e mostrar proteína total do cardápio vs meta.

## 5. MÉDIO — Fibra existe no banco inteiro e não existe em lugar nenhum da experiência

**Problema:** Todos os 76 alimentos têm `fibra_g`, mas fibra não tem meta, não é somada no dia, não entra no snapshot da refeição e não aparece em tela alguma.
**Causa:** `meal_log_items` não tem `fibra_snap` (`src/db/schema.ts:242-256`), `nutrition_targets` não tem coluna de fibra (`schema.ts:51-59`), `somarMacros`/`macrosDoDia` só agregam 4 campos (`src/features/dieta/api.ts:135-159`). As únicas menções a fibra são orientações de *evitar* fibra no pré-treino.
**Impacto:** Num déficit de 15%, fibra é a alavanca de saciedade mais barata que existe — e o nutriente que mais despenca quando se corta comida. O usuário não tem como saber que fechou o dia com 12 g (prática comum: ~25–38 g/dia, ou ~14 g/1.000 kcal). A mensagem líquida do app vira "fibra atrapalha".
**Evidência:** Grep por `fibra`: schema, seed, tipo e três textos pré-treino — zero agregação, zero meta, zero UI.
**Solução:** `fibra_snap` em `meal_log_items` (migração), somar em `macrosDoDia`, meta 14 g/1.000 kcal e quarta barra discreta na tela de Dieta. Itens antigos ficam `NULL`, não são reescritos.
**Alternativas:** Sem migração: somar via join `food_id → foods.fibra_g` só para exibição (estimativa, deixar claro); ou aviso semanal de fibra média.

## 6. MÉDIO — O TMB medido por bioimpedância nunca envelhece

**Problema:** Depois de uma bioimpedância, `usa_tmb_medido = 1` para sempre. O TMB medido continua definindo o TDEE meses depois, mesmo com o peso mudando.
**Causa:** `src/features/perfil/api.ts:163-168` grava o TMB medido sem validade; `resumo()` (linhas 240-245) o usa incondicionalmente.
**Impacto:** Recomposição funcionando = peso caindo = TMB real caindo. Com TMB de 3 meses atrás, o TDEE fica superestimado e o "déficit de 15%" vira 8–10% real — o progresso trava sem explicação visível. É o inverso do erro que a regra "TMB calculado, nunca armazenado" quis evitar.
**Evidência:** Nenhuma checagem de idade da medição nem de desvio de peso entre `body_metrics.medido_em` e o peso atual em `resumo()`.
**Solução:** Invalidar (ou escalar) quando o peso atual desviar mais que ~3–5% do peso do dia da medição, e sinalizar "TMB medido de DD/MM — refaça a bioimpedância".
**Alternativas:** Offset fixo: delta entre TMB medido e estimado na data da medição, somado à fórmula atual (acompanha o peso); ou expirar por tempo (8 semanas).

## 7. MÉDIO — Meta de água congelada no onboarding, sempre com bônus de treino

**Problema:** A meta de água é gravada uma vez no onboarding, com o peso daquele dia e `treinaHoje = true` — e todos os fallbacks também assumem dia de treino.
**Causa:** `app/onboarding.tsx:194` (`meta_agua_ml: metaDiariaAgua(pesoN, true)`); `src/features/perfil/api.ts:273`; `app/agua.tsx:256`. `metaDiaria` (`src/features/agua/api.ts:19-24`) soma +700 ml quando `treinaHoje`.
**Impacto:** Dia de descanso carrega +700 ml permanentes (84 kg: meta 3.640 ml todos os dias, base seria 2.940). Se o peso mudar 10 kg, a meta salva não acompanha — valor derivado de peso armazenado, contra a filosofia do app. A base 35 ml/kg em si está na faixa de prática comum.
**Solução:** Não persistir meta derivada: calcular `metaDiaria(pesoAtual, temTreinoHoje(data))` na leitura, consultando a agenda; `meta_agua_ml` só como override manual explícito.
**Alternativas:** Recalcular junto de `recalcularMeta` a cada pesagem e diferenciar treino/descanso só na exibição.

## 8. MÉDIO — Casos extremos sem guard-rails: sem piso calórico, e o freio de segurança é código morto

**Problema:** Nenhuma meta calórica tem piso; a meta manual pode ficar aritmeticamente impossível em silêncio; `deficitMaximoSeguro`/`projetar` não são chamados por ninguém.
**Causa:** `metaCalorica`/`calcularMeta` sem piso (`calculos.ts:86-93`; `perfil/api.ts:296-311`); `definirMetaCalorica` zera carbo com `Math.max(0, ...)` sem aviso (`perfil/api.ts:324-341`); `deficitMaximoSeguro` e `projetar` definidos em `recomposicao.ts:234-280` sem chamador; `resumo()` assume 70 kg sem pesagem (`perfil/api.ts:237`).
**Impacto:** Mulher pequena sedentária: TDEE ~1.560 → meta 1.326 kcal sem sinalização. Usuário magro com déficit acima do teto de mobilização (~31 kcal/kg de gordura/dia, documentado no próprio código) não recebe aviso. Meta manual de 1.200 kcal pode gravar P+G = 1.180 kcal e carbo 0 g.
**Evidência:** Grep por `deficitMaximoSeguro|projetar`: apenas definições; `Math.max(0, Math.round(restante / 4))` em três pontos sem caminho de aviso.
**Solução:** (a) piso: meta auto não cai abaixo do TMB sem confirmação; (b) usar `deficitMaximoSeguro` quando houver `gorduraPct`; (c) em `definirMetaCalorica`, se `restante < 0`, reduzir gordura até 20% antes de zerar carbo, e alertar abaixo disso.
**Alternativas:** Reaproveitar o padrão de conferência da `SheetMeta` (perfil.tsx:572-592) nos caminhos automáticos.

## 9. MENOR — Cobertura da base de alimentos ignora o que se come no fim de semana

**Problema:** Os 76 itens cobrem a semana "limpa" e não têm bebida calórica, refeição de restaurante, pizza, salgado ou doce — e nenhum micronutriente (nem sódio).
**Causa:** `src/db/seed/alimentos.ts:12-100` — categorias param em suplementos; única bebida é café sem açúcar; schema de `foods` sem colunas de sódio/micros (`schema.ts:159-174`).
**Impacto:** O dia mais importante de registrar é o dia imperfeito — cerveja, pizza, açaí. Sem itens, o usuário não registra (quebra `dieta_dias` e o histórico mente para baixo) ou registra errado. `criarAlimento` existe mas exige saber a tabela nutricional de cabeça, de pé, no bar.
**Solução:** ~15 itens de "vida real" (cerveja, refrigerante, suco, pizza por fatia, coxinha, pão de queijo, brigadeiro, açaí, sorvete) e 3 entradas genéricas "refeição fora — leve/média/pesada" com medida caseira.
**Alternativas:** Registro rápido só de kcal estimada, gravando snapshot com macros proporcionais à média do dia.

## 10. MENOR — `planoDoDia` quebra com menos refeições — e derruba justamente o pós-treino

**Problema:** Só o ramo "treino à noite" respeita `refeicoes_por_dia`, e ele corta refeições do fim da lista sem renormalizar as fatias — removendo o jantar pós-treino de quem treina à noite.
**Causa:** `src/features/dieta/timing.ts:155-175`: `noite.slice(0, Math.max(3, refeicoesPorDia))`. Com 4 refeições, mantém café/lanche/almoço/pré-treino (fatias somando 0,72) e apaga o jantar `pos_treino` das 21h. Os demais ramos ignoram o parâmetro. Consumido em `app/rotina.tsx:45`.
**Impacto:** O plano de quem treina 20h e come 4 vezes termina no lanche das 17h30 — a orientação mais importante do dia some, e as fatias somam 72% sem explicação.
**Evidência:** Somas por ramo: todos fecham 1,0 antes do slice; depois do slice com 3 refeições, 0,58.
**Solução:** Reduzir refeições fundindo slots `normal` adjacentes (nunca remover `pre_treino`/`pos_treino`) e renormalizar para 1,0; aplicar aos cinco ramos.
**Alternativas:** Ignorar `refeicoes_por_dia` também no ramo noite (consistente, sem bug) até implementar a fusão direito.

---

### Observações fora do ranking

- Medalha `dieta_dias` avalia todo o histórico contra a meta **atual** (`src/features/gamificacao/api.ts:169-179`): mudar a meta reclassifica dias passados — contra a filosofia de snapshot, efeito só cosmético/XP.
- Registrar refeição não alimenta streak nem dá XP (`registrarAtividade` só em treino; `darPontos` sem origem de dieta). Para um app cujo produto é aderência, a dieta tem 3 medalhas e nenhum reforço diário.
- Divergência com a nota do cofre: o cofre fala ~3 g/kg de massa magra; o código usa 2,4 (`recomposicao.ts:136-137`). Pela evidência verificada (2,3–3,1 g/kg MM, topo da faixa para atletas muito magros), **2,4 está certo para o perfil atual com gordura alta** — quem merece atualização é a nota do cofre, não o código.

**Prioridade sugerida pelo agente:** 1 e 2 juntos (mesmo arquivo, mesmo mecanismo), depois 3 e 4, e 6 antes de 5/7/8/9/10 porque corrói silenciosamente o déficit ao longo do tempo.
