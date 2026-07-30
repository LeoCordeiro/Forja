# Auditoria científica da lógica de treino — Forja

> Agente: fitness-scientist · 2026-07-29 · escopo: gerador.ts, api.ts, programa.ts,
> periodizacao.ts, estagnacao.ts, classificacao.ts, volume.ts, recuperacao.ts,
> executor de sessão e gamificação. Nenhum arquivo editado.

**Fontes abertas e verificadas via WebFetch nesta sessão** (únicas citadas como evidência científica):

- [Schoenfeld et al. 2016 — descanso 1 vs 3 min, PubMed 26605807](https://pubmed.ncbi.nlm.nih.gov/26605807/)
- [Schoenfeld, Ogborn, Krieger 2016 — frequência ≥2×/semana, PubMed 27102172](https://pubmed.ncbi.nlm.nih.gov/27102172/)
- [Pelland et al. — meta-regressão dose-resposta de volume, contagem fracionada, PubMed 41343037](https://pubmed.ncbi.nlm.nih.gov/41343037/)
- [Precisão de equações de 1RM cai com ≥10 reps, PubMed 18714230](https://pubmed.ncbi.nlm.nih.gov/18714230/)
- [Lundberg et al. 2022 — interferência em fibra; corrida > ciclismo, PMC9474354](https://pmc.ncbi.nlm.nih.gov/articles/PMC9474354/)

Tudo que não vem dessas cinco está marcado como prática comum, sem citação.

---

## Achado 1 — CRÍTICO. Troca "só para hoje" grava permanentemente no template da rotina

**Problema:** A substituição de exercício durante a sessão promete valer só para o treino do dia, mas altera a rotina para sempre.
**Causa:** `src/features/treino/api.ts:313-318` — `substituirExercicio` faz `UPDATE routine_exercises SET exercise_id = ?, eh_composto = ?, descanso_seg = ...`. A tabela `substituicoes` é só log de INSERT; nenhum código em `finalizarSessao`, `cancelarSessao` ou em qualquer outro lugar lê `de_exercise` para restaurar (verificado por grep: `substituicoes` só é escrita e apagada em `recomecarTreino`).
**Impacto:** Viola a regra 1 do AGENTS.md ("Plano ≠ execução — nunca gravar execução no template"). Um supino trocado por crossover porque o banco estava ocupado uma vez vira o exercício oficial do bloco. Isso destrói exatamente o que o gerador protege em `gerador.ts:820-828`: o composto principal fica fixo a semana inteira "porque é comparando a carga dele que se enxerga progresso". Além disso `eh_composto` e `descanso_seg` do template mudam junto — trocar composto por isolador uma vez rebaixa o descanso do template para 90 s permanentemente.
**Evidência:** `app/sessao/[id].tsx:918-920` mostra ao usuário: "A troca vale só para o treino de hoje. Sua rotina continua como está." — afirmação falsa dado o UPDATE acima.
**Solução:** Resolver o exercício efetivo por sessão: o executor consulta `substituicoes` da sessão atual e sobrepõe em memória, sem tocar `routine_exercises`.
**Alternativas:** (a) Restaurar `exercise_id`/`descanso_seg`/`eh_composto` originais em `finalizarSessao` e `cancelarSessao`; (b) perguntar na troca: "só hoje" ou "definitivo" — o motivo `preferencia` já sugere intenção definitiva, `ocupado` sugere temporária.

## Achado 2 — CRÍTICO. Periodização, deload e plano de retorno existem só como texto; a prescrição nunca muda

**Problema:** As fases do bloco (semana 8 com 55% do volume), o RIR por fase e o plano de retorno pós-pausa (semana 1 com 50% do volume e 60% da carga) são exibidos em telas informativas, mas o treino que a pessoa executa é idêntico em todas as semanas.
**Causa:** `src/features/treino/programa.ts:97-104` (deload 55%) e `periodizacao.ts:106-153` (readaptação 50-80%) definem percentuais que nenhum consumidor aplica. `gerador.ts` não recebe fase; `aplicarPlano` grava `series_alvo` cheio; `app/sessao/[id].tsx` não exibe RIR nem ajusta séries. `descansoSugerido` (periodizacao.ts:49-57) e `VOLUME_SEMANAL` (periodizacao.ts:24-28) são código morto — grep no repositório inteiro não encontra nenhuma chamada.
**Impacto:** É o pior caso possível para o usuário real: retorna de pausa, a home mostra "semana 1: 50% do volume, comece leve de propósito", e a sessão abre com 100% das séries em compostos pesados de 5-8 reps. O risco que o próprio código documenta ("tendão e articulação se adaptam mais devagar — a lesão custa mais semanas que a cautela", periodizacao.ts:102-104) não é mitigado por nada executável. O deload da semana 8 idem: sem redução real de volume, a fadiga acumulada aparece — e o detector de estagnação até a diagnostica ("fim do bloco, faça a semana leve", estagnacao.ts:147-152), recomendando uma semana leve que o app não gera.
**Evidência:** `semana_plano` já é gravado em cada sessão (`api.ts:393-398`) e `app/dia/[id].tsx:58-63` calcula a fase — mas o único uso é o texto `RIR_POR_FASE[fase.fase].texto` na linha 266. Grep de `volumePct` em `app/` só encontra a tag visual `programa.tsx:138`.
**Solução:** Aplicar `volumePct` da fase vigente sobre `series_alvo` no momento de montar a sessão (em memória, sem tocar o template): `Math.max(1, Math.round(series_alvo * volumePct/100))` — e mostrar o RIR alvo da fase no cabeçalho do executor. Toda a infraestrutura (fase, semana_plano, textos) já existe; falta ligar o fio.
**Alternativas:** (a) Mínimo viável: banner no executor na semana de deload/readaptação dizendo "hoje: metade das séries" com as séries excedentes já desmarcadas; (b) regenerar a rotina por fase (pior: mexe no template e quebra comparabilidade).

## Achado 3 — ALTO. Não existe motor de progressão de carga; a progressão dupla prometida nunca é verificada

**Problema:** O método declarado do app ("bateu o topo da faixa em todas as séries → sobe a carga na próxima sessão") não tem uma linha de código que o execute. A progressão é 100% iniciativa do usuário — e a UI empurra na direção contrária.
**Causa:** `programa.ts:18-20` e `shared/ajudas.ts:188` descrevem a regra; nenhum módulo compara as reps da última execução com `reps_max`. No executor, `abrirCampo` (`app/sessao/[id].tsx:343-369`) herda automaticamente o peso da sessão anterior no buffer — o caminho de menor atrito é repetir a carga, nunca subi-la.
**Impacto:** Sobrecarga progressiva, que o próprio `diagnostico.ts` chama de determinante, vira esperança. O incremento correto por grupo — que o app conhece (+2,5 kg tronco / +5 kg perna em `programa.ts:64`; 1,25 kg para grupos pequenos em `estagnacao.ts:165`) — nunca aparece no momento da decisão, que é com o halter na mão. O detector de estagnação só age depois de 3 sessões paradas: o app espera o problema acontecer em vez de preveni-lo.
**Evidência:** `ultimaExecucao` (`api.ts:602-621`) entrega tudo que a regra precisa (peso e reps por série da última sessão), e `reps_max` está em cada `RoutineExerciseFull` carregado na tela. Os dados estão lado a lado no mesmo estado do componente e nunca são cruzados.
**Solução:** No carregamento da sessão: se todas as séries da última execução atingiram `reps_max`, preencher o placeholder/buffer com `peso_anterior + incremento(grupo)` e mostrar um selo "hora de subir: X kg". Se ficaram abaixo de `reps_min`, sugerir manter ou reduzir 5%. É lógica pura sobre dados já carregados.
**Alternativas:** (a) Notificação pós-treino ("no próximo supino, suba para 62,5 kg"); (b) marcar visualmente na tabela as séries que bateram o topo da faixa, deixando a decisão explícita mas manual.

## Achado 4 — ALTO. e1RM por Epley sem teto de repetições gera PR falso — e há duas fórmulas divergentes no código

**Problema:** Qualquer série vira candidata a recorde de e1RM, inclusive séries de 15-20 repetições, onde a fórmula de Epley extrapola muito além do seu domínio de validade.
**Causa:** `src/features/perfil/calculos.ts:129-132` — `e1rm` sem limite de reps; `api.ts:518-521` — `detectarPRs` calcula e1RM para toda série com peso e reps. Agravante: `api.ts:637` (`evolucaoExercicio`) usa uma segunda fórmula embutida no SQL, `MAX(peso_kg * (1 + reps/30.0))`, que diverge da função TS no caso reps=1 (SQL: peso×1,033; TS: peso) e também não tem teto.
**Impacto:** O próprio gerador prescreve panturrilha e abdômen em 12-20 reps e isoladores em 10-15 (`gerador.ts:586-592`). Uma série de leg press de 20 reps aplica fator 1,67 — estudo verificado mostra que equações de predição de 1RM são acuradas com menos de 10 repetições e degradam acima disso ([PubMed 18714230](https://pubmed.ncbi.nlm.nih.gov/18714230/)). Resultado: e1RM "recorde" inflado por uma série de resistência trava todos os PRs legítimos seguintes (a comparação é contra `MAX(valor)`), distribui 50 XP por recorde falso e distorce o gráfico de evolução.
**Evidência:** `api.ts:502-508` — `melhorPR` compara contra o máximo histórico sem distinção de faixa; um e1RM de série de 20 reps entra na mesma régua de um de série de 5.
**Solução:** Gerar candidato a PR de e1RM apenas quando `reps <= 10`; unificar a fórmula na função TS (a query de evolução pode filtrar `reps <= 10` e aplicar o mesmo cap).
**Alternativas:** (a) Cap suave: calcular com `min(reps, 10)`; (b) trocar de equação não resolve — a solução real é o teto.

## Achado 5 — ALTO. Contraindicações por dor são inconsistentes, e a troca em sessão ignora dor e local

**Problema:** As listas de exercícios a evitar por região dolorida têm buracos incoerentes, e o fluxo de substituição durante o treino pode oferecer de volta exatamente o exercício que foi removido por dor.
**Causa:** `src/features/perfil/diagnostico.ts:140-146` — o critério foi o implemento, não o padrão de movimento: lombar evita `Stiff` mas não `Levantamento terra romeno` nem `Bom dia com barra`; joelho evita `Afundo com barra` mas mantém `Afundo com halteres`, `Agachamento búlgaro` e `Afundo caminhando`; ombro evita `Elevação lateral` mas mantém `Remada alta` e `Mergulho no paralelo` (prática clínica comum associa os dois a dor subacromial; sem fonte verificada nesta sessão). E `api.ts:341-365` — `substitutosDisponiveis` não filtra por `dores` do perfil nem por `foraDoLocal`: o mapa `SUBSTITUICOES` (`classificacao.ts:211`) devolve `Desenvolvimento militar` como substituto de `Desenvolvimento com halteres` mesmo para quem marcou dor no ombro.
**Impacto:** A proteção do gerador é desfeita no ponto de maior risco: no meio do treino, com pressa, o app sugere o movimento contraindicado. O motivo de troca `dor` (`MOTIVOS_TROCA`) é gravado e nunca lido — não marca o exercício, não sugere atualizar o perfil.
**Evidência:** Fluxo concreto: perfil com dor "ombro" → gerador exclui militar → na sessão, usuário troca o desenvolvimento com halteres (aparelho ocupado) → sheet oferece "Desenvolvimento militar" como primeira opção.
**Solução:** Derivar contraindicação por padrão (`padraoDe` já existe) + característica de carga (axial, overhead, flexão profunda de joelho) em vez de lista nominal; aplicar `evitarPorDor` e filtro de local dentro de `substitutosDisponiveis`.
**Alternativas:** (a) Correção mínima: completar as listas nominais (romeno, bom dia, afundos com halter, búlgaro, remada alta, mergulho); (b) motivo `dor` registrado 2× no mesmo exercício dispara sugestão de adicioná-lo às dores do perfil.

## Achado 6 — MÉDIO. Detector de estagnação compara séries que não existem; lista "evoluindo" nunca retorna nada

**Problema:** O score de progresso combina o maior peso e o maior número de repetições da sessão vindos de séries diferentes; e a consulta de "o que está subindo" tem SQL que garante resultado vazio.
**Causa:** `src/features/treino/estagnacao.ts:63-66` — `MAX(peso_kg)` e `MAX(reps)` agregados independentemente por sessão: pirâmide de 100×5 + 80×12 vira score fictício 100×12=1200. Sessão seguinte com progresso real no top set (102,5×5 + 80×10) pontua 1025 < 1200 e é contada como estagnada. E `estagnacao.ts:174-178` — a subquery `primeiro` aplica `ORDER BY ... LIMIT 1` sobre um `MAX()` sem GROUP BY: `primeiro` vira o recorde de todos os tempos, sempre ≥ `ultimo`, então `filter(l.ultimo > l.primeiro)` nunca passa.
**Impacto:** Falsos positivos de estagnação para quem treina em pirâmide; e a metade motivacional da feature — que o próprio arquivo justifica com "só cobrança desanima" (linha 170) — está morta desde que nasceu.
**Evidência:** Trechos citados; qualquer usuário com séries de peso variado dentro da sessão produz o score impossível.
**Solução:** Score por `MAX(peso_kg * reps)` na sessão, ou o melhor e1RM da sessão; em `evoluindo`, buscar o peso máximo da primeira sessão com subquery correlacionada correta.
**Alternativas:** Volume total do exercício na sessão — mais estável, porém mascara progressão de carga com queda de reps; o melhor-set por e1RM é mais fiel à progressão dupla.

## Achado 7 — MÉDIO. Streak zera com aderência perfeita ao plano que o próprio app prescreve; treino manual não alimenta a sequência

**Problema:** A sequência com freeze é aritmeticamente incompatível com treinar 3-4×/semana — que é o que o gerador recomenda.
**Causa:** `src/features/gamificacao/api.ts:94-103` — gap de 1 dia continua; gap de 2 consome freeze; gap ≥3 zera sempre. O padrão default de 3 dias é seg/qua/sex: sexta→segunda é gap 3 → a streak zera toda semana, com aderência de 100%. E `registrarAtividade` só é chamada em `finalizarSessao` (`api.ts:578`) — `marcarTreinoManual` (`api.ts:146-158`) não a chama, apesar de o comentário prometer que a marcação "conta para frequência, sequência e check-in"; nem poderia, porque `registrarAtividade` só registra `hoje()`.
**Impacto:** Aderência é a variável que mais decide resultado de longo prazo, e a mecânica desenhada para protegê-la pune o comportamento prescrito. Um contador que zera semanalmente apesar da execução perfeita ensina o usuário a ignorar a gamificação inteira.
**Evidência:** Simulação direta: seg (streak 1) → qua gap 2, usa freeze → sex gap 2, sem freeze → streak 1 → seg gap 3 → streak 1. Máximo alcançável com 3×/semana: 2.
**Solução:** Trocar a unidade da streak de "dias corridos" para "semanas seguidas batendo a meta de treinos" (a meta já existe em `resumoSemana(metaDias)`), com freeze perdoando 1 treino faltante na semana.
**Alternativas:** (a) Contar "dia agendado cumprido" (dias sem treino agendado não quebram); (b) mínimo: gap tolerado = maior intervalo do plano ativo + freeze, e `registrarAtividade(data)` aceitando retroativo.

## Achado 8 — MÉDIO. Aquecimento não existe: nem prescrito, nem registrável

**Problema:** O app prescreve compostos pesados a 5-8 reps com 180 s de descanso e não gera nem permite registrar séries de aquecimento.
**Causa:** O schema e o pipeline estão prontos — `set_logs.tipo = 'aquecimento'` é excluído de volume, PR e histórico (`api.ts:449, 493, 617, 640, 692`) e `PRIORIDADE.aquecimento = 0` existe (`classificacao.ts:142`) — mas o executor sempre grava `tipo: 'normal'` (`app/sessao/[id].tsx:464-472`) e o gerador nunca cria séries de aproximação.
**Impacto:** Para um usuário retornando de pausa, abrir a sessão direto na carga de trabalho de um terra 5-8RM é o cenário de risco tendíneo que a fase de readaptação (não aplicada — achado 2) deveria evitar. E se o usuário registrar as aproximações por conta própria, elas contam como séries válidas: poluem o "Anterior" da série 1 e podem gerar PR de `volume_serie`.
**Evidência:** Infraestrutura órfã descrita; nenhuma UI de toggle de aquecimento na `LinhaSerie`.
**Solução:** Gerar 1-2 séries de aquecimento automáticas nos compostos pesados (40-60% da carga da última execução, sem contar no alvo) e um toggle "aquecimento" na linha da série.
**Alternativas:** Mínimo: apenas o toggle manual na linha, aproveitando a exclusão já implementada no backend.

## Achado 9 — MENOR. Dose de cardio autocontraditória; mapa de recuperação conta séries não concluídas

**Problema:** O app declara 3 sessões de cardio/semana para recomposição, mas o gerador anexa cardio a todos os dias de treino; a dose real acaba definida pelo corte de tempo, não pela prescrição. E a estimativa de recuperação conta séries que não aconteceram.
**Causa:** `gerador.ts:881-897` — todo dia gerado recebe cardio quando objetivo é emagrecimento/recomposição, contra `periodizacao.ts:187` (recomposição: 3 sessões de 30 min). `recuperacao.ts:73-78` — `COUNT(sl.id)` sem `concluida = 1` nem `tipo <> 'aquecimento'`.
**Impacto:** Quem treina 5-6 dias recebe 5-6 blocos de cardio; o mapa de recuperação superestima fadiga. Duas fontes de verdade brigando.
**Evidência:** Trechos citados. As regras de cardio em si estão corretas — ver validações.
**Solução:** Limitar o cardio gerado a `CARDIO.porObjetivo[objetivo].sessoes` dias (os de sessão mais curta), e adicionar os filtros de `concluida`/`aquecimento` na query de recuperação.
**Alternativas:** Cardio como "dia leve" separado nos dias sem musculação.

## Achado 10 — MENOR. Três fontes de verdade para volume-alvo; periodizacao.ts contradiz o gerador

**Problema:** Os alvos de volume semanal existem em três lugares com números diferentes, dois deles nunca usados.
**Causa:** `periodizacao.ts:24-28` (`VOLUME_SEMANAL`: avançado até 26 — código morto), `gerador.ts:151-155` (`VOLUME_POR_EXPERIENCIA`: 10/14/18), `volume.ts:27-29` (piso 10/teto 20). `descansoSugerido` também é morto.
**Impacto:** Risco clássico de manutenção: ajustar a constante errada e acreditar que o app mudou.
**Evidência:** Grep de `VOLUME_SEMANAL` e `descansoSugerido`: apenas as definições.
**Solução:** Uma constante única exportada e importada por gerador, auditoria e telas; apagar o código morto.
**Alternativas:** Se `VOLUME_SEMANAL` é a forma desejada, migrá-la para o gerador e derivar piso/teto dela.

---

## Áreas validadas (sem achado — e por quê)

- **Descanso por classificação (180/150/90/60 s):** alinhado com o RCT verificado ([PubMed 26605807](https://pubmed.ncbi.nlm.nih.gov/26605807/)), inclusive a distinção composto/isolador.
- **Volume semanal (piso 10, teto 20, foco 28) e contagem fracionada (indireta = 0,5):** compatível com a meta-regressão verificada ([PubMed 41343037](https://pubmed.ncbi.nlm.nih.gov/41343037/)) — evidência mais forte justamente para contagem fracionada; retornos decrescentes sem platô rígido sustentam o teto de foco em 28. Observação: o gerador não modula volume pelo objetivo (déficit vs superávit); a evidência para reduzir volume em déficit é fraca/indireta.
- **Frequência mínima 2×/grupo e divisões (full body ≤3d, upper/lower 4d, PPL 6d):** alinhado com a meta-análise verificada ([PubMed 27102172](https://pubmed.ncbi.nlm.nih.gov/27102172/)).
- **Regras de cardio (depois da musculação, bicicleta/elíptico sobre corrida, Zona 2):** preferência por ciclismo com suporte no meta verificado ([PMC9474354](https://pmc.ncbi.nlm.nih.gov/articles/PMC9474354/)). Só a dose está inconsistente (achado 9).
- **Ordem de exercícios:** composto pesado abre, isolador e cardio fecham, preferência de equipamento não varre o composto pesado. As correções dos commits recentes (preferência por máquina, padrão de movimento, dia de costas com remada, colapso de bíceps) estão completas no gerador. A ponta solta está na substituição em sessão (achados 1 e 5).
- **Integridade de PRs na edição (regra 5):** `atualizarSerie`/`desfazerSerie` apagam os PRs derivados e redetectam — o "8080" corrigido deixa de travar a progressão. O problema restante de PR é de fórmula, não de CRUD (achado 4).
- **RIR por fase como conteúdo:** os alvos (3-4 readaptação, 2-3 acúmulo, 0-2 intensificação) são prática comum coerente; o problema é não chegarem ao executor (achado 2).

**Ressalva:** as afirmações do código sobre "ACSM Position Stand 2026" (volume.ts:6, gerador.ts:57) e os estudos citados em `programa.ts` (Baz-Valle 2019, Coleman 2024) e `gerador.ts` (Refalo 2025, Nuzzo 2023, Haugen 2023) **não foram verificados nesta sessão** — se forem virar argumento de produto, precisam do mesmo processo de WebFetch antes.

**Prioridade sugerida pelo agente:** 1 e 2 antes de tudo, depois 3-5 (progressão e segurança), depois o resto.
