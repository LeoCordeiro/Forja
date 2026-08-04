# Roadmap vivo — Forja

Estado do ciclo atual. Toda sessão `/sprint` lê este arquivo, executa a
primeira fase `pendente` e atualiza o status ao terminar. Regras: `AGENTS.md`.

**Rodada atual:** auditoria 2026-07-29 —
`docs/auditoria-2026-07-29/consolidado-cto.md` (30 achados).

**Nova prioridade — 31/07, com print do treino real no celular do Leonardo:**
a *seleção* de exercícios está genérica. O dia "A — Peito e tríceps" saiu com
**7 exercícios de peito (4 no mesmo padrão de movimento), 22 séries de peito
numa sessão, tudo em 8-12 reps e 150s**. Isso é diferente do que a fase 2
resolveu (periodização e progressão): é o gerador escolhendo o que entra.

Causa mecânica confirmada no código:
`docs/auditoria-2026-07-30-gerador/causa-mecanica.md`.
Prescrição-alvo (o que devia sair): `prescricao-alvo.md` na mesma pasta.

| # | Fase | Itens | Status |
|---|------|-------|--------|
| 1 | Nada se perde | F1 U3 U4 N1 N2 | **feita** — commit `97f480f`, verificação independente 30/07 |
| 2 | Motor de treino | F2 F3 F4 F6 | **feita** — commit `890ec16`. Cross-review duplo (qa reprovou a 1ª rodada com 1 ALTO, corrigido e re-aprovado; fitness-scientist aprovou os 4 com ressalvas → candidatos abaixo). Ver "Validação da fase 2" |
| **G1** | **Estrutura e seleção** | A2, A1+A11, A4, A3, A8 | **feita e no ar** — commits `ee543d2` + `8c68ef1` (correção do cross-review), build `1e725e2c2d8d`. Gate reverificado pelo Claude 2×: 32 falhas contra o código pré-G1, 9 contra o `ee543d2`, 0 depois. Ver "Validação de G1" |
| G2 | Prescrição com papel | A5 A6 A7 A9 A10 + F8 | **feita e no ar** — commit `5374f1e`, build `f11ddcbac48c`. Reprovada por qa (3 ALTOs) E fitness-scientist (2 CRÍTICOS + 5 ALTOs) na 1ª entrega; corrigida e reverificada. Gate final conferido pelo Claude: **27 falhas contra o código em produção, 0 depois**. Ver "Validação de G2" |
| G2.1 | Sobras do G2 | ALTO-3 (backfill de papel) + M1 M2 M3-texto + variedade semanal | **no ar** — commit `bb6babf`. Gate: 23 falhas no gerador + 5 na migração contra `63c716b`, 0 depois. **Reprovada no cross-review do qa** (2 ALTOs + 4 MÉDIOS + 4 BAIXOs) — ver "Correção do cross-review de G2.1" |
| G2.2 | Correção do cross-review de G2.1 | ALTO-1 (chaves de local) ALTO-2 (papel congelado) M1 M2 M3 M4 + 4 BAIXOs | **feita, não commitada** — gate: **10 falhas no gerador + 2 na migração contra `bacf85c`, 0 depois** |
| G3 | Treinador que explica e varia | execução detalhada, técnicas de intensidade, objetivo do exercício, variação entre ciclos | **feita, não commitada** — gate: **30 falhas contra `c241562`, 0 depois**. Ver "Validação de G3" |
| 4 | Série em 1 toque | U1 U2 U5 U6 U7 | **feita, não commitada** — gate: **33 falhas contra `bb6babf`, 0 depois**. Ver "Validação da fase 4" |
| 5 | Segurança e nutrição | F5 N3 N6 N8 U8 | **feita, não commitada** — gate: **50 falhas contra `ee156d5`, 0 depois**. Ver "Validação da fase 5" |
| 6 | Sobras do P2 | F7 F9 F10 N4 N10 | pendente |
| 7 | Re-auditoria (rodada 2) | comparar com os dois consolidados | após as fases acima |

### G1 — Estrutura e seleção (A2, A1, A11, A3, A4, A8)

**Ordem obrigatória — A2 primeiro.** A auditoria da saída achou a causa-raiz
acima do fallback: com `focos=['peito']` e 4 dias, `SPLITS_FOCO.superior[4]` dá
**peito 1× por semana**. Com 1 aparição, `ceil(alvo/aparicoes)` joga o orçamento
semanal inteiro numa sessão — é daí que vêm as 22 séries. E o aviso de frequência
(`gerador.ts:774-791`) só examina a região *preterida*, então nunca percebe que
o grupo **enfatizado** caiu para 1×. Corrigir A2 sozinho já derruba metade do
resto.

1. **A2** — `aparicoes(grupo_grande) >= 2` vira **restrição dura** na escolha do
   split (split que viola é inválido, não é aviso). Ênfase = mais séries e/ou
   mais aparições; **nunca menos aparições**. Split alvo para 4 dias com ênfase
   superior em B1 do `prescricao-alvo.md`.
2. **A1 + A11** — teto por sessão reaplicado como **última etapa do pipeline**
   (depois de `preencherTempo` e `consolidar`) e sobre o total **fracionado**:
   12 para grupo grande, 10 para pequeno. E a folga de agenda deixa de virar
   série: escada de uso em B2 (aproximação → descanso completo → cardio na dose
   certa → mobilidade → sobra declarada).
3. **A4** — rodar a ordenação por papel **uma vez, no fim**. Hoje `porPapel` só
   roda na montagem e `posicaoPara` insere sem reordenar: por isso composto
   pesado caiu nas posições 4 e 5, depois de um isolador na 3.
4. **A3** — teto por padrão: máx. 2 exercícios e 8 séries por padrão por sessão.
   Matar o `?? livres[0]` de `exercicioParaAcrescentar` (`gerador.ts:1361`): sem
   padrão novo, **não acrescenta exercício**. Ampliar `padraoDe` (lista de 8
   padrões de empurrar em B4).
5. **A8** — desambiguar `Crossover na polia baixa`: nome de crucifixo, imagem de
   `Cable_Chest_Press`, classificado em `COMPOSTOS`, padrão `abertura`. Duas
   classificações internas discordam do mesmo exercício. Existe `Crossover na
   polia` correto ao lado.

**Gate extra, não pulável:** `npm run testar:gerador` hoje diz "Tudo passou" com
o código que gerou esse treino — verificado em 03/08. Os testes novos (lista na
`causa-mecanica.md`) precisam FALHAR contra o código atual antes de qualquer
correção. Sem isso a correção não está provada: foi exatamente esse tipo de regra
que passou pela auditoria de código de 29/07 **e** pelo teste automatizado ao
mesmo tempo.

**Alvo verificável ao fim de G1** (números de B10, para o dia A): 20 séries de
força em vez de 32; 10 de empurrão em vez de 29; 7 padrões distintos em 7
exercícios; no máximo 1 exercício no padrão mais concorrido; ~52 min em vez de 87.

**O que G1 entregou desse alvo, e o que ficou faltando.** Entregue: 17 séries de
força (contra 32), **1** exercício no padrão mais concorrido (contra 4), 47 min
(contra 87), zero redundância de padrão. Parcial: empurrão com extensão de
cotovelo caiu de 29/32 (91%) para 14/17 (82%) — melhor, mas ainda alto, e o que
sobra é justamente o desenvolvimento militar que A9 manda tirar do dia de
empurrar. Faltando:
**5 padrões distintos, não 7** — e o motivo é medido, não estimado. Os dois
padrões que faltam travam no teto SEMANAL fracionado, não no da sessão:
tríceps 15,5 contra teto 14 e ombro 21 contra teto 20, ambos por volume
indireto. Ou seja, o gerador está recusando **corretamente** pela regra de A11
(folga de agenda não vira série). Destravar exige A7 (piso de 2 exercícios para
grupo pequeno no dia que leva o nome dele) e A9 (ombro não-anterior no dia de
empurrar) — os dois são **G2**. Subir a asserção do teste de 5 para 6 padrões é
o critério de aceite de G2.

### G2 — Prescrição com papel (A5, A6, A7, A9, A10, F8)

Papel explícito por exercício (principal / complementar / isolador /
finalizador), **derivado de atributos** — `articulacoes`, `demanda_estabilizacao`,
`pico_de_tensao` (B3) — e não de lista nominal. Dele saem faixa de reps, RIR e
descanso (tabelas B5 e B6).

- **A6** — `repsDe` só dá `[5,8]` quando `experiencia !== 'iniciante'`: marcar
  "iniciante" apaga a zona pesada do programa **inteiro**. Leonardo é
  intermediário destreinado. Reps e RIR passam a sair do papel.
- **A5** — inverter a chave de `descansoCorreto`: **papel primeiro**, reps só
  desempatam dentro do isolador. Hoje o ramo dos 180 s é inalcançável para
  qualquer perfil "iniciante" (`rmax=12 > 8` → 150 s até em composto pesado).
- **A7** — piso de 2 exercícios para grupo pequeno em dia que leva o nome dele,
  sendo ao menos 1 monoarticular na posição alongada. Hoje "peito e tríceps" tem
  zero extensão de cotovelo isolada e 15 séries fracionadas de tríceps.
- **A9** — em dia de empurrar, zero desenvolvimento pesado; ombro entra com 2
  isoladores não-anteriores. Hoje: 17,5 fracionadas no deltoide, **zero** no medial.
- **A10** — cardio pela constante `CARDIO.porObjetivo` (3 sessões, 30 min, Zona 2,
  bicicleta/elíptico) em vez de esteira 20 min todo dia; e ou entra no orçamento
  de tempo, ou a tela declara que está fora dele.
- **F8** — aquecimento: 2 séries de aproximação (40% e 65%) no principal.
  `set_logs.tipo = 'aquecimento'` já existe no schema e `anilhas.ts` já tem
  `aquecimento()` órfão.

### G3 — Treinador que explica e varia

- **Execução detalhada:** cadência e tempo sob tensão, amplitude, erro comum. O
  catálogo já tem `instrucoes` e `dica`; falta a camada de tempo. Atenção: o
  relatório trata negativa lenta como **cadência, não técnica de intensidade**
  (0,5 a 8 s produzem hipertrofia semelhante; ~2 s é o mais eficiente em tempo).
- **Técnicas de intensidade por papel e fase (B7),** com regras duras: só em
  isolador ou finalizador, só na última série, máx. 2 por sessão, **zero durante
  readaptação e deload**. Duas ressalvas que precisam sobreviver à implementação:
  **myo-reps não tem nenhuma fonte verificada** — não prescrever como se tivesse;
  e **pré-exaustão é contraindicada** (reduz o volume no multiarticular seguinte
  sem vantagem de hipertrofia).
- **"Por que este exercício está aqui"** — o papel já dá a resposta estrutural.
- **Variação entre ciclos (B8), em três níveis:** âncora fixa no bloco (nível 0,
  única série que alimenta gráfico e e1RM), troca entre blocos com **quebra
  explícita da curva** (nível 1), rodízio de complementares/isoladores dentro do
  mesmo padrão (nível 2). Preserva a regra do projeto de comparabilidade de carga.

P3 (backlog): só quando tocar no domínio correspondente — lista no consolidado.

**Aviso para a fase 2** (do relatório do fitness-scientist): as citações que já
estão no código (`ACSM 2026` em volume.ts, Baz-Valle/Coleman em programa.ts,
Refalo/Nuzzo/Haugen em gerador.ts) NÃO foram verificadas — não tratar como
evidência nem reaproveitar em texto de produto sem WebFetch antes. As 5 fontes
verificadas estão no cabeçalho do fitness.md.

## Validação de G3 — Treinador que explica e varia (04/08/2026)

Working tree, sem commit. `tsc --noEmit` limpo. `testar:gerador` e
`testar:migracao` 100%. **Sem mudança de schema** — a âncora do bloco é derivada
de `routine_exercises.papel` (v16, já preenchida pelo backfill de G2.1) e a
quebra de curva é reconstruída comparando a rotina ativa com a última arquivada.
Nada a responder sobre "quem já está com o banco estragado": nenhuma coluna
nova, nenhuma linha reescrita, e quem trocou de bloco ANTES desta fase também
ganha a quebra, porque rotina antiga nunca é apagada (`ativa = 0`).

**O gate.** As seções 36-40 foram escritas antes de qualquer correção e rodadas
contra `c241562` num worktree com o MESMO arquivo de teste: **30 falhas**.
Nenhuma asserção de G1/G2/G2.1/Fase 4/Fase 5 quebrou dos dois lados. Depois: **0**.

| Invariante | UNIDADE | contra `c241562` | depois |
|---|---|---|---|
| 36. cadência, amplitude e erro derivados | **exercício** (117) | 9 | 0 |
| 37. técnica por papel e fase (B7) | **exercício × fase** | 8 | 0 |
| 38. objetivo específico na sessão | **exercício × sessão** | 5 | 0 |
| 39. B8 níveis 0 e 2 | **bloco** (grade de 1.350) | 4 | 0 |
| 40. B8 nível 1 | **transição entre blocos** | 6 | 0 |

**Duas réguas nasceram erradas e foram corrigidas ANTES de virar código.** A
primeira cobrava "mesma ÂNCORA no bloco" e media a coisa errada: no plano real o
ombro abre o dia A com `Face pull` (nenhum principal ali) e o dia D com
`Remada alta` (principal). Cobrar o mesmo nome obrigaria a pôr desenvolvimento
pesado num dia de empurrar — o que A9 proíbe e o invariante (b) já testa. B8 diz
"o **principal** de cada grupo"; a régua passou a medir o principal. A segunda
cobrava variedade de perfil onde a única alternativa era peso do corpo (goblet →
agachamento sem carga): variedade que custa carga é regressão com outro nome.

**1. Execução — a camada de tempo, e ela é cadência.** `execucao.ts` deriva
cadência, amplitude e erro comum de `padraoDe`/`picoDeTensao`/
`perfilDeResistencia`/`articulacoesDe`. **117 de 117** exercícios ganharam
cadência: **112 em 2-0-1**, **2 em 4-0-1** (excêntrico puro, protocolo próprio) e
3 sem cadência por serem série por tempo. Amplitude: 4 textos derivados do pico
de tensão. Erro comum: 9 textos derivados da classe mecânica.

**A pausa de 1 s no fundo foi implementada, medida e REJEITADA.** Ela daria 4 s
por repetição a 42 dos 117 exercícios (todo pico alongado). Como `duracao.ts`
passou a consumir a cadência, o custo apareceu na grade de 1.350 perfis:

| | sem pausa | com pausa |
|---|---|---|
| séries de força no total | 92.994 | **91.810 (−1.184)** |
| exercícios no total | 29.212 | 28.897 (−315) |
| sessões estourando o tempo pedido | 1.416 | **1.486 (+70)** |

1,3% do volume de força do app inteiro, por algo que Krzysztofik 2019 — a única
fonte aberta sobre tempo de fase — **não prescreve**. "Não quique no fundo" ficou
em `amplitudeDe` e `erroComumDe`, custa zero segundo e diz o mesmo.

**E a `dica` do catálogo parou de mentir.** A tela rotulava `dica` como "Erro
mais comum", e para boa parte das linhas isso é falso ("Melhor exercício para
peitoral superior" não é erro). O erro agora é derivado e sempre verdadeiro; a
`dica` continua, como "Dica deste exercício".

**2. Técnicas de intensidade — 1 prescrita de 7 catalogadas.**

| técnica | prescrita? | por quê |
|---|---|---|
| drop set | **sim** | Sødal 2023: sem diferença vs tradicional (**p = 0,392**), metade a um terço do tempo. O ganho declarado é TEMPO |
| falha momentânea | não | Refalo 2023: não é superior. E o RIR do papel já diz onde parar — dois botões para a mesma decisão |
| rest-pause | não | sem evidência verificada; prática comum, declarada como tal |
| **myo-reps** | **não** | **nenhuma fonte aberta**; fica descrita, nunca prescrita |
| **pré-exaustão** | **não, CONTRAINDICADA** | Krzysztofik 2019: reduz o volume no multiarticular seguinte sem vantagem |
| BFR / excêntrico acentuado | não | exigem pressão de oclusão medida e parceiro |

Na grade (4.725 sessões × 4 fases): **831 aplicações, todas em `finalizador`,
nunca mais de 1 por sessão, zero na readaptação e zero no deload**. A primeira
versão aceitava qualquer isolador e prescrevia **3.169** (2.338 em isolador
comum) — mais do que B7 autoriza, porque o único ganho medido é tempo e oferecer
tempo a quem não precisa é vender benefício inexistente. Sem aperto de relógio,
só o finalizador; com aperto, o teto de 2 abre.

**Negativa lenta NÃO está em `tecnicas.ts`** — ela é cadência, mora em
`execucao.ts`, e o invariante proíbe que apareça nas duas casas.

**3. Objetivo específico — 29.192 linhas, 177 frases distintas, 0 repetidas
dentro do mesmo grupo no mesmo dia.** A frase sai de `padrão + perfil de
resistência + pico`, e a unicidade não é sorte: `cabeNoPadrao` só aceita um
segundo exercício do mesmo padrão quando o perfil é outro. `PORQUE_PAPEL` mudou
de `papel.ts` para `porque.ts` — duas casas para "por que este exercício está
aqui" é como o crossover virou composto numa função e abertura em outra.

**4. B8, os três níveis.**

*Nível 2 — o candidato 14 fechado, medido na GRADE (não em cenário nomeado).*
Nos 5 perfis escolhidos a dedo o número era 0 dos dois lados; na grade eram 8, e
todos com **dor** — a régua não descontava o que a dor proíbe, exatamente o
defeito que G2.1 achou na variedade semanal (168 que eram 114). Com a régua
certa: **0 de 1.027 pares** repetem os acessórios, e **0** mantêm o mesmo perfil
de resistência dentro do padrão. No dia do print (4 dias, foco peito, máquina):

| | dia A | dia D |
|---|---|---|
| âncora | Supino máquina | **Supino máquina** (nível 0 preservado) |
| inclinado | Supino inclinado **máquina** | Supino inclinado **com barra** |
| abertura | Crossover **na polia** | Crucifixo **com halteres** |
| tríceps 2º | Tríceps **na polia** | Tríceps **na máquina** |

*Nível 0 — a garantia é a DECLARAÇÃO, não o zero.* "Dois principais no mesmo
bloco" cai de **297 para 272** em 900 blocos. Prometer zero seria inatingível —
seria pedir que o gerador violasse a variedade de padrão da semana (invariante
(l)) e o teto de 2 aparições do mesmo pesado (invariante (i)). Na grade de 1.350
perfis: **428 de 1.703** grupos terminam com duas referências, por
`colapsaPadrao` (361), `pesado3x` (64) e regra da sessão (3) — e **todas as 428
são declaradas no plano**, com a frase "compare a carga de cada exercício com ele
mesmo, nunca entre os dois". Foi a primeira versão desta correção que quebrou o
invariante (l) em **81 perfis** (costas com 2 dias virando só `horizontal`) e o
(i) em **22** (`Levantamento terra` em 3 dias).

*Nível 1 — a unidade que nada media.* `montarPlano` passou a aceitar
`ancorasAnteriores` e a devolver `quebras`. Em 900 transições: **1.252 de 2.788
grupos (44,9%) trocam de âncora**, **0 trocam de padrão**, e **1.252 quebras
declaradas** — uma para cada troca. `regerarTreino` alimenta isso lendo a rotina
ativa antes de arquivá-la; o onboarding não passa nada, porque não existe bloco
anterior. A tela do exercício mostra a quebra ACIMA do gráfico, com dois textos
("esta curva termina aqui" / "começa do zero").

**Régua duplicada evitada em dois pontos:** `trocaCabeNaSessao` foi extraída de
`diversificarNaSemana` e agora serve os quatro que trocam; `compararNoBloco` /
`abridorDoGrupo` saíram de `ordenarPorPapelNoDia` e o harness usa a MESMA função
para explicar recusas, em vez de uma cópia do comparador.

**A trava de ordem, na segunda tentativa.** A primeira exigia o mesmo tier de
fadiga e era grosseira nos dois sentidos: recusava 4 trocas seguras da grade
(`Agachamento búlgaro` → `Afundo com barra` num bloco que já abre com
`Leg press`) e não garantia nada quando o substituto do mesmo tier vencia o
desempate por pico. A régua exata é a pergunta direta — com o substituto no
lugar, quem abre o bloco continua sendo quem abria?

**Validação no navegador: INCOMPLETA, e isto é uma falha do gate.** O app sobe e
renderiza a 390×844 com **zero erro de console**, mas o onboarding não foi
dirigido de ponta a ponta nesta sessão: os chips de escolha só respondem a
`PointerEvent` sintético em JS e os botões grandes só ao mouse do CDP, e mandar
os dois num chip marca e desmarca. Sem perfil o app redireciona toda rota para
`/onboarding`, então **nenhuma tela nova foi vista rodando**: a camada de tempo
na tela do exercício, o objetivo na tela do dia, a técnica no executor e a quebra
de curva no gráfico estão cobertas só pelas asserções de fonte das seções 36-40
(que provam que o fio está ligado, não que a tela está boa). **Conferir as quatro
no celular, e refazer o treino duas vezes para ver a quebra de âncora.**

## Validação da fase 5 — Segurança e nutrição (04/08/2026)

Working tree, sem commit. `tsc --noEmit` limpo. `testar:gerador` e
`testar:migracao` 100%. **Sem mudança de schema** — N6 usa `body_metrics`
(`tmb_kcal` + `peso_kg` da mesma linha, que já existem desde a v2) e F5c lê
`substituicoes.motivo`, que era gravado e nunca lido. Nada a responder sobre
"quem já está com o banco estragado": nenhuma coluna nova, nenhuma linha
reescrita.

**O gate, com a unidade em cada invariante.** As seções 30-35 foram escritas
antes de qualquer correção e rodadas contra `ee156d5` num worktree com o MESMO
arquivo de teste: **50 falhas**. Nenhuma asserção de G1/G2/G2.1/Fase 4 quebrou
dos dois lados (408 asserções nos dois, 358 ok / 50 falhas antes; 408 ok
depois). Depois: **0**.

| Invariante | UNIDADE | contra `ee156d5` | depois |
|---|---|---|---|
| 30. contraindicação por dor derivada | **exercício × dor** (124 × 5 = 620 decisões) | 9 | 0 |
| 31. troca em sessão respeita dor e local | **exercício × dor** | 6 | 0 |
| 32. motivo `dor` lido 2× vira sugestão | **exercício × dor** | 5 | 0 |
| 33. meta de nutrição | **dia de dieta** (672 corpos) | 11 | 0 |
| 34. TMB medido envelhece | **dia de dieta** | 6 | 0 |
| 35. Sheet com Input reage ao teclado | **tela** | 10 | 0 |

**F5a — a contraindicação virou função, e a lista virou exemplo.**
`src/features/treino/contraindicacao.ts` descreve cada exercício por CARGAS
MECÂNICAS derivadas de `padraoDe` + `perfilDeResistencia` + tipo de carga, e
cada região declara quais cargas contraindica. `REGIOES_DOR.evitar` foi
**renomeado para `exemplos`** de propósito: lista antiga viva ao lado da regra
nova é a que a próxima pessoa acha primeiro.

| Região | bloqueava | bloqueia | entraram | saiu |
|---|---|---|---|---|
| ombro | 4 | **12** | +9 | `Elevação lateral` |
| lombar | 4 | **11** | +7 | — |
| joelho | 3 | **14** | +11 | — |
| punho | 3 | **8** | +5 | — |
| cotovelo | 3 | **7** | +4 | — |

A única saída é a que F5 manda desfazer: abdução neutra com carga leve
(12-20, RIR 2) era o exercício de ombro que o app tirava, enquanto mantinha a
remada alta (abdução com rotação interna, barra pesada) e o mergulho. Entraram,
entre outros: os 6 desenvolvimentos overhead (não só o militar), `Levantamento
terra romeno`, `Bom dia com barra` e `Stiff com halteres` no lombar, e os 7
padrões de flexão profunda unilateral no joelho.

**Reforço nominal declarado, um só:** `Hack machine` para dor no joelho. Ele e o
`Leg press` são o mesmo padrão, equipamento e estabilização — nenhum atributo do
projeto os separa hoje, e derivar sem reforço DESBLOQUEARIA um exercício que
produção já protege. O invariante cobra o motivo mecânico por escrito, justamente
para ninguém acrescentar nome ali sem essa conta.

**F5b — a proteção do gerador deixou de ser desfeita em um toque.** O filtro é
`filtrarSubstitutos` (puro, exercitável contra catálogo × dor × local); `api.ts`
só lê o perfil. Medido nas mesmas combinações: o mapa cru oferecia **275
substitutos contraindicados** e **4.746 que o local não tem** — agora 0 e 0. No
app real, com dor no ombro, trocar `Supino inclinado com halteres` oferecia
`Supino inclinado com barra` em primeiro lugar; agora ele aparece na linha
"Fora da lista por causa das dores do seu perfil", junto de `Mergulho no
paralelo` e `Supino reto com barra`.

**F5c — o motivo `dor` era escrita que ninguém lia.** Duas trocas por dor no
mesmo exercício disparam a pergunta, com a região deduzida das cargas mecânicas
dele. Uma vez só não sugere nada de propósito.

**N3 — proteína de emagrecimento, medida em corpos concretos:**

| perfil | antes | depois |
|---|---|---|
| 120 kg, 40% gordura, M | **264 g** (2.803 kcal, C 261) | **173 g** (C 352) |
| 84 kg, 42%, F | 185 g | **117 g** |
| 58 kg, 30%, F sedentária | 128 g | **97 g** |
| 62 kg, 12%, M | 136 g | 131 g (e a meta subiu 2.280 → 2.451, ver N8) |

O mesmo corpo em déficit passou a receber a MESMA proteína em "perder gordura" e
em "recomposição" — a pior razão entre os dois objetivos, na grade de 672 corpos,
é **1,00×**.

**N8 — os freios existiam e não eram chamados.** `deficitMaximoSeguro` estava
escrito com fonte no comentário e grep não achava chamador. Agora o piso é o
maior entre o metabolismo basal e `TDEE − deficitMaximoSeguro`, e a meta manual
passou pela escada certa (gordura cede até 20% das calorias **antes** de o carbo
apertar). Na grade: déficit acima do teto de mobilização **62 → 0**; proteína
fora da faixa defensável **98 → 0**. No app, meta manual de 900 kcal: gordura
desce ao piso e aparecem os dois avisos, em vez de `carbo 0 g` gravado calado.

**E `definirMetaCalorica` continuaria morta.** Ela tinha a escada e nenhum
chamador — o sheet gravava os quatro campos crus, então baixar a meta para 1.500
mantinha 78 g de gordura e 346 g de carbo (2.802 kcal para uma meta de 1.500). O
sheet passou a recalcular pela escada enquanto os macros não forem tocados à mão,
e a mostrar o que ela teve que fazer. Ligar a função sem ligar o fio teria sido
repetir o achado.

**N6 — o TMB medido envelhece por dois caminhos**, porque um só não bastava:
desvio de peso > 3% (é o peso que move o TMB) e idade > 8 semanas (composição
muda com o peso parado). Nada é apagado: a medição continua em `body_metrics` e a
decisão é tomada na LEITURA — regra 6 do projeto. A tela de perfil diz por quê,
com a data e os dois pesos na frase.

**U8 — `KeyboardAvoidingView` não serviria.** No `react-native-web` ele depende
de eventos `keyboardDidShow` que o navegador não emite: seria correto no
simulador e inerte no PWA, a mesma armadilha do `hitSlop` da Fase 4. O hook
`useTeclado` usa `visualViewport` no web e `Keyboard` no nativo; o `Sheet`
encolhe o `maxHeight` e sobe o rodapé pela altura coberta. `rolavel` é opt-in
porque o sheet de registrar alimento traz a própria `FlatList` — ele é rolável só
no passo do `Input`.

**Validado no navegador a 390×844** (Chrome headless próprio com
`Emulation.setDeviceMetricsOverride`; o Browser pane não compõe frames e o
clique sintético não chega ao `Pressable`): onboarding completo com 120 kg /
"Perder gordura" → prévia da meta já com 179 g em vez de 264 → "Refazer meu
treino" marcando **dor no ombro** → dia A com `Elevação lateral` presente
(4 × 10-15, RIR 0-2) e **zero desenvolvimento, zero remada alta, zero mergulho**;
peito abrindo com `Supino máquina` porque o de barra saiu → sessão iniciada →
`Trocar` no supino inclinado com halteres, com as três recusas nomeadas na tela →
troca por dor 1× (sem pergunta) → segunda sessão, troca por dor 2× → "Você já
trocou Tríceps testa por dor 2×. Quer marcar cotovelo nas suas dores?" →
aceitando, `Tríceps francês` desaparece da lista de troca na hora. Dieta com
meta 2.803 kcal / P 179 g; perfil mostrando "Proteína: 2,4 g por kg de massa
magra (74,4 kg, estimada pelo IMC)"; meta manual de 1.500 kcal disparando os dois
avisos de piso. Zero erro de console.

**Não validado no navegador:** o teclado em si. Chrome headless não tem teclado
virtual, então `visualViewport` nunca encolhe e o caminho novo do `Sheet` não é
exercitado de verdade — o que a seção 35 garante é que o fio está ligado e que
`hitSlop`-style inércia não se repetiu (o hook usa a API que funciona no web).
**Conferir no celular:** abrir "Nota de setup" no meio do treino e "Ajustar
meta", com o teclado aberto, e ver o campo e o botão.

## Validação da fase 4 — Série em 1 toque (04/08/2026)

Working tree, sem commit. `tsc --noEmit` limpo. `testar:gerador` e
`testar:migracao` 100%. **Sem mudança de schema** — U7 é só estado de tela.

**O gate, com a unidade em cada invariante.** As seções 23-27 foram escritas
antes e rodadas contra `bb6babf`: **33 falhas**. Nenhuma asserção de G1/G2/G2.1
quebrou. Depois: **0**.

| Invariante | UNIDADE | contra `bb6babf` | depois |
|---|---|---|---|
| 23. registrar uma série (13 asserções) | **toque** | 11 | 0 |
| 24. alvo da linha de série | **alvo (pt)** | 6 | 0 |
| 25. contraste da coluna "Anterior" | **par cor/fundo composto** | 1 | 0 |
| 26. remover série adicionada por engano | **linha, depois de reabrir** | 8 | 0 |
| 27. descanso com o teclado aberto | **tela** | 3 | 0 |

**Toques por série, medidos no app real a 390×844** (não no modelo): repetir a
carga de sempre **5 → 1** (2 teclados → 0); subir 2,5 kg e registrar **6 → 4**.
A auditoria dizia 4 toques; o número real era 5 porque o pulo automático
peso → reps abria o campo VAZIO — a herança só existia no toque direto no
campo. Eram duas regras de herança para a mesma informação, e a pior estava no
caminho automático. Agora é uma só, em `src/features/treino/registro.ts`.

**Alvos, medidos com `getBoundingClientRect` no app real** (antes → depois):
check da série 36×34 → **52×52**; campos 74×44 / 58×44 → **70×52 / 54×52**;
bolinha da trilha 30×30 → **44×52**; "Pular" 58×30 → **58×44**; "Concluir"
86×38 → **86×44**; voltar/info 36×36 → **44×44**; "Trocar" 82×30 → **82×44**;
"Adicionar série" 340×32 → **340×52**; "Anterior/Próximo" 175×43 → **175×52**;
"Fotos" 116×27 → **116×44**. Nenhum alvo da tela abaixo de 44×44.

**`hitSlop` não funciona no PWA — e era nele que o alvo de 44 pt de G2 se
apoiava.** `react-native-web` só implementa `hitSlop` no `Touchable` legado; o
`Pressable` (que o `Press` embrulha) descarta a prop. Conferido em
`node_modules/react-native-web/dist`: três arquivos citam `hitSlop`, os três de
`Touchable`. Medido no navegador, o toggle de aquecimento tinha **24×18**, não
44. Todo alvo desta fase é caixa de verdade; o teste proíbe `hitSlop=` na tela.

**A tensão aquecimento × toque, resolvida por contagem.** Concluir série
acontece ~20×/treino; marcar aquecimento e remover linha, 0-2×. O check ficou
com o alvo primário (52 pt, borda direita) e os dois gestos raros saíram para o
**toque longo em qualquer ponto da linha** → sheet com as duas ações rotuladas.
Custo: aquecimento vai de 1 para 2 toques. Ganho: −80 toques por treino de 20
séries. O toque longo não custa largura, funciona no web (ao contrário de
`hitSlop`) e ganhou o que o toggle não tinha: rótulo escrito e espaço para
EXPLICAR a recusa. A seção 19 (fluxo da aproximação) não mudou — ela exercita
`inserirAproximacoes`/`hidratarSeries`, que continuam iguais; o gesto novo é
coberto pela seção 27.

**Contraste da coluna "Anterior", medido no pixel composto** (não no token):
`textFaint` 12 px = **3,00:1** → `textDim` 13 px = **7,00:1** na linha normal,
**5,42:1** na linha concluída (successSoft sobre surface) e **5,34:1** na de
aquecimento. Os três estados de fundo são compostos com alpha, e o teste mede os
três. De quebra, na mesma tela: cabeçalho da tabela 3,00 → 7,00; números da
trilha 2,73 → 6,37; contagem da trilha → 7,24; posição "1 de 10" e o
"duração · séries · volume" do cabeçalho → 7,00.

**U7: a remoção respeita o que a reabertura devolve.** `removerSerie` recusa em
três casos, com frase: série já gravada (desmarcar é o caminho, e ele recalcula
PR), série gravada DEPOIS desta (`serie_index` é posição — renumerar faria tela
e banco discordarem em silêncio) e abaixo do piso de `hidratarSeries` (a linha
voltaria no próximo carregamento). Sem a terceira, o conserto trocaria o defeito
"não dá para remover" pelo defeito que a própria auditoria descreve ao lado:
"o mesmo treino tem dois estados dependendo de reabrir".

**Validado no navegador a 390×844**, no app real, com histórico real, pelo
fluxo inteiro: iniciar treino → 3 séries (1 toque, 1 toque, 4 toques com +2,5)
→ corrigir uma já gravada (82,5 → 80, volume recalculado) → desmarcar (3 → 2
séries, trilha 1/10 → 0/10) → remarcar (1 toque) → adicionar série extra
(trilha cai para 0/10) → toque longo → "Remover série" (trilha volta a 1/10) →
concluir. Recusas conferidas na tela: remover gravada e remover no piso, as
duas com o motivo escrito no banner. Aquecimento pelo menu marca, renumera as
valendo e desmarca. Cancelar em 2 estágios e as 5 abas seguem sem erro de
console.

**Conferir no celular:** o toque longo foi exercitado com ponteiro de mouse
(`mousePressed` + 800 ms). No iOS o mesmo gesto disputa com o menu de seleção do
Safari — o `PressResponder` do `react-native-web` dá `preventDefault` no
`contextmenu` quando existe `onLongPress` e o ponteiro é toque, mas isso não foi
verificado no aparelho. Se o menu do Safari aparecer por cima, a saída é
`user-select: none` na linha, não abandonar o gesto.

**Fora do navegador:** o Browser pane não compõe frames (`rAF = 0`,
`visibilityState: hidden`), então as animações do reanimated congelam no estado
inicial e `getBoundingClientRect` mede o meio da animação — o botão "Continuar"
media 40×60 num contêiner de 32 pt. Toda medição desta fase foi feita num Chrome
headless próprio, com `Emulation.setDeviceMetricsOverride` (o `--window-size=390`
do Windows renderiza 500×748, como a memória já registrava).

## Correção do cross-review de G2.1 (04/08/2026)

O qa reprovou G2.1 com 2 ALTOs, 4 MÉDIOS e 4 BAIXOs, já em produção (`bb6babf`),
com a Fase 4 por cima (`bacf85c`). Working tree, sem commit. `tsc --noEmit`
limpo, `testar:gerador` e `testar:migracao` 100%, sem mudança de schema.

**O gate.** Os invariantes novos rodados contra `bacf85c` num worktree com o
MESMO arquivo de teste: **10 falhas no gerador + 2 na migração**. Nenhuma
asserção de G1, G2, G2.1 ou Fase 4 quebrou dos dois lados. Depois: **0**.

| Invariante | UNIDADE | contra `bacf85c` | depois |
|---|---|---|---|
| 2b. existe checagem estrita de chave de local | chave de local | 1 | 0 |
| (f) cardio na dose, medido de verdade | semana | 112 de 1.350 | 0 |
| (l) todo grupo grande com 2+ padrões na semana | grupo × semana | 3 de 1.350 | 0 |
| 28. papel recalculado quando a composição muda | linha × composição | 5 | 0 |
| 29. tela e executor concordam sobre o bloco | **bloco (8 semanas)** | 2 | 0 |
| 8b. backfill ignora rotina arquivada | rotina | 1 | 0 |
| 8d. descanso baixado à mão sobrevive ao catálogo | linha × tempo | 1 | 0 |

**A unidade mais fina deixou de ser o bloco.** G2.1 registrou o bloco de 8
semanas como o buraco de cobertura, e foi exatamente ali que M1 estava. A seção
29 cobre agora: tela e executor concordando sobre "venceu", a semana continuando
a contar depois da 8ª, modulação que nunca infla nem cai abaixo de 2, e ajuste
de esforço declarado em toda semana. A mais fina agora é a **transição entre
BLOCOS** (o que muda de exercício quando o bloco recomeça) — que é B8, ou seja
G3.

**ALTO-1 — a grade testava a mesma academia 4×, e o silêncio era a causa.**
`academia_rede`, `academia_simples` e `casa_halteres` nunca existiram;
`equipamentosDe` caía mudo em `LOCAIS[0]`. Corrigido nas duas frentes que o qa
pediu: a grade passou a derivar `LOC` de `LOCAIS` (não de literais),
`equipamentosDe` ganhou `console.warn` alto mantendo o fallback (perfil
corrompido não pode impedir o app de abrir), nasceu `localConhecido` para quem
precisa ser estrito, e o harness ESTOURA com chave inventada em vez de aceitar.
`padroesDoLocal` também passou a descontar `semEstes` — a Smart Fit tem cabo mas
não tem glute ham raise.

*Tudo que G2.1 declarou em cima da grade, remedido com as chaves reais*
(1.350 perfis, `63c716b` → árvore atual):

| | com chaves erradas | com chaves REAIS |
|---|---|---|
| (l) variedade semanal, antes | 114 | **3** |
| bíceps, séries diretas/perfil | 4,01 → 4,49 (+12%) | **3,87 → 4,31 (+11,4%)** |
| tríceps, séries diretas/perfil | 3,82 → 4,11 (+7,6%) | **3,83 → 4,11 (+7,3%)** |
| panturrilha, séries diretas/perfil | 3,53 → 3,71 | 3,48 → 3,62 (+4,0%) |
| sessões de cardio por perfil | — | 1,36 → 1,85 |

Os dois números de M1 sobreviveram à correção. O de variedade **não**: 114 era
inflado pela academia repetida — o número honesto é 3, e os 3 tinham a mesma
forma (`casa_equipada` + foco inferior, glúteo só em `ponte`).

**E os 3 fecharam, pela terceira vez o mesmo padrão.** `diversificarNaSemana`
chegava a ver um dia com TRÊS exercícios de glúteo e três padrões — variedade de
sobra — e `aplicarTetosDaSessao`, logo depois, aparava os dois últimos por
estouro do teto fracionado. A diversificação olhava um plano que ainda não
existia. Agora ela roda por ÚLTIMO, depois de tudo que remove exercício, e a
troca consulta o teto da sessão antes de escolher: mover a chamada sem essa
trava reabriu o teto em **12 perfis** (glúteo em 12,5 num teto de 12) e num
cenário nomeado do qa — o harness pegou, que é para isso que ele existe.

**ALTO-2 — papel gravado virou cache invalidável.** Escolhida a saída (a):
recalcular sempre que a composição do dia mudar. A saída (b) — não persistir —
fecharia o buraco e reabriria o motivo do backfill: `corrigirDescansos` precisa
do papel GRAVADO para saber que aquele supino quer 180 s, e sem coluna volta o
fallback que trata todo multiarticular como principal. A regra derivada mora em
`prescricaoDaRotina` (`papel.ts`, sem SQL) e `recalcularPapeisDoDia` (`api.ts`)
é a casca fina; `removerExercicioDoDia`, `addExercicioNoDia` e
`reordenarPorPrioridade` chamam. A substituição de sessão NÃO chama — regra nº 1
do projeto, ela vale só para hoje. O descanso **só sobe**, que é a regra que
`corrigirDescansos` já usava.

Verificado no app real, no banco real, com as três manifestações:

| | antes | depois |
|---|---|---|
| remover a âncora do peito | inclinado seguia `complementar` para sempre | vira **`principal`** |
| ordem manual → "Reordenar pela ciência" | supino preso em `complementar/RIR 1-2/150s` | volta a **`principal`** |
| acrescentar exercício | **2 finalizadores** gravados | **1**, e o antigo vira isolador |
| acrescentar `Agachamento livre` | `Principal · RIR 2-3 · 90 s` | **180 s**, e reps do papel |

**M3 — o invariante de cardio era inatingível, e escondia 112 defeitos.**
A régua aceitava dose curta sempre que o aviso semanal existisse, e o gerador
empurra esse aviso incondicionalmente: as duas asserções não podiam falhar. O
"994 → 0" era construção, não conquista. Reescrita em três réguas que medem —
dose completa quando há dias e nada foi cortado; nunca menos que a agenda
permite; e os NÚMEROS do aviso conferidos contra o plano. Resultado imediato:
**112 falhas** apareceram, todas em `emagrecimento`, e todas o mesmo defeito
real — o laço genérico de `cortarParaCaber` comia o cardio, contradizendo a
regra escrita vinte linhas acima ("em emagrecimento o aeróbio fica e a
musculação é que cede") e anunciando a remoção como "cardio ficou abaixo do
mínimo semanal". Pior: `estimarDuracao` filtra cardio, então tirar aquela linha
devolvia **zero segundo** à conta que o laço tentava baixar. Cardio saiu dos
candidatos do laço; quem tira cardio é o bloco dedicado, que sabe por quê.

**M4 — "grupos grandes inalterados" era média, e o qa está certo.** Remedido em
5.400 perfis × 4 objetivos (32.400 pares perfil×grupo):

| | pré-G2.1 → G2.1 | pré-G2.1 → árvore atual |
|---|---|---|
| perfis com grupo grande mudando volume direto | 306 | 383 |
| quedas / altas | 289 / 40 | 358 / 73 |
| quedas / altas em grupo de **FOCO** | 46 / 19 | **83 / 48** |
| séries em grupo de foco (soma) | −34 | −47 |
| grupo grande zerado | 0 | **0** |
| pior queda em grupo de foco | −4 | **−3** (10 casos em 32.400) |

Duas correções entraram por causa disso. `preencherTempo` sortava candidatos só
por "menos séries primeiro", o que entrega a folga sistematicamente ao grupo
PEQUENO (nasce com 2 séries) em vez do grupo grande em foco (3-4) — a ênfase
ganhou o desempate, como ela já ganha em `alvoSemanal`, `priorizarNoDia`,
`aparExcesso` e `ordenarPorPapelNoDia`; as altas em foco foram de 13 para 48. E
o piso de `cortarParaCaber` contava CARDIO como exercício, então um dia com
bicicleta parava o corte com dois exercícios de força em vez de três — visível
ao consertar M3: um perfil de 2 dias × 30 min perdia o peito da semana inteira
(8 → 0). Agora o piso conta musculação, e **nenhum grupo grande é zerado**.

O que ficou: a queda de foco é real e bounded em **−3 séries semanais**, em 10
de 32.400 pares (o pior é `peito 21 → 18`, o caso que o qa citou). É o preço do
teto do pequeno em 18, que é o próprio pedido de M1, e o número continua muito
acima do piso de 10.

**Sessões estourando o tempo pedido**, 18.900 sessões:

| | só musculação | musculação + cardio |
|---|---|---|
| pré-G2.1 (`63c716b`) | 1.864 | 5.543 |
| G2.1 em produção | **1.864** | **7.408** |
| árvore atual | 1.874 | 7.613 |

Ou seja: medido só na musculação, **G2.1 não mexeu nisso** (1.864 → 1.864) — os
9,9% que estouram são anteriores, e vêm de `cortarParaCaber` parar quando só
sobram compostos pesados. O que G2.1 de fato criou foi o estouro **com cardio**
(+1.865 sessões, +34%), consequência direta de M2 prescrever nos quatro
objetivos. Minhas correções somam 10 sessões na primeira coluna (o preço do piso
de 3 exercícios de força) e 205 na segunda (emagrecimento agora fica com o
cardio, como a regra manda).

**M2 — o número do cardio agora aparece no card.** A aba Treino e a tela de
refazer já mostravam "+ 30 min de cardio"; a tela do DIA não mostrava minuto
nenhum e ainda contava a bicicleta como exercício ("8 exercícios" num dia de 7 —
o achado 26, fechado junto). Agora: **"7 exercícios · ~57 min + 30 min de
cardio"**.

**M1 — uma fonte só para "o bloco venceu".** `semanaDoBloco` grampeava em 8 e
`resolverFase` não. A função parou de grampear (`faseAtual` continua, porque a
pergunta dela é outra: qual LINHA do BLOCO descreve a semana), nasceu
`blocoVencido` com a mesma régua das duas pontas, e a tela do programa passou a
ter um estado próprio de vencido em vez de repetir "Semana 8 · Aliviar · 55%"
para sempre.

**BAIXOs, todos fechados.** Rotina arquivada (`ativa = 0`) saiu das duas queries
do backfill — escrita que ninguém lê. `descansos_v3` é apagada junto com a
gravação da v4. `completarCatalogo` parou de apagar a flag de descanso: o DELETE
não tinha função (catálogo novo entra em `exercises`, não em rotina de ninguém)
e custava a escolha de quem tinha BAIXADO um intervalo. E `addExercicioNoDia`
deixou de gravar 90 s cegos — a linha nova recebe descanso, RIR e faixa de
repetição do papel dela.

**Validado no navegador a 390×844** (app real, banco real): plano regerado com 4
dias × 1h30; tela do dia com o cabeçalho novo; as três manifestações do ALTO-2
exercitadas de ponta a ponta pela API do app (remover âncora, acrescentar,
reordenar) com o banco conferido a cada passo; tela do programa sem número de
RIR conflitante. Zero erro de console.

**Não validado no navegador:** o clique sintético não aciona `Pressable` do
React Native Web no pane (limitação do harness, já registrada em G2), então
remover/acrescentar foi feito chamando a mesma função que o botão chama, não
tocando o botão. E a semana de deload continua dependente de data — coberta
pelas seções 22 e 29 do harness. **Conferir as duas no celular.**

## Validação de G2.1 (03/08/2026)

Working tree, sem commit. `tsc --noEmit` limpo. `testar:gerador` e
`testar:migracao` 100%. **Sem mudança de schema** — o backfill escreve em
colunas que a v16 já criou.

**O gate, com a unidade declarada em cada invariante.** Os invariantes novos
foram escritos primeiro e rodados contra `63c716b` num worktree com o MESMO
arquivo de teste: **23 falhas no `testar:gerador` e 5 no `testar:migracao`**.
Nenhuma asserção pré-existente de G1 ou G2 quebrou dos dois lados. Depois da
correção: **0**.

| Invariante | UNIDADE | contra `63c716b` | depois |
|---|---|---|---|
| (f) cardio na dose da constante, ou dose declarada | semana | 994 de 1.350 | 0 |
| (k) volume acima do teto útil sempre declarado | grupo × semana | 1.203 de 1.350 | 0 |
| (l) todo grupo grande com 2+ padrões na semana | grupo × semana | 114 de 1.350 | 0 |
| 20. o teto útil é UM número nas duas pontas | constante | 4 | 0 |
| 21. cardio nos 4 objetivos × 3 agendas | semana | 9 de 12 | 0 |
| 22. a fase imprime direção, não RIR absoluto | semana (texto) | 7 | 0 |
| 8. backfill de papel/RIR em rotina pré-v16 | linha × dia | 5 | 0 |

**Onde a cobertura ainda é mais fina.** A unidade de **semana** deixou de ser a
mais fraca: G2.1 acrescentou 4 invariantes semanais (cardio, teto útil,
variedade de padrão, dose declarada) aos 2 que existiam. A mais fina agora é o
**bloco** — 8 semanas: nenhum invariante mede o que acontece ENTRE semanas
(progressão de carga, deload chegando, âncora que não muda). É a unidade de B8
e de G3, e é onde o próximo defeito de unidade errada deve aparecer.

**1. ALTO-3 revertido do jeito certo — backfill de `papel`, não solta o fallback.**
Leonardo autorizou reescrever o plano do iPhone. A correção NÃO foi deixar
`corrigirDescansos` usar a regra nova com `papel` NULL: com papel nulo o
fallback trata todo multiarticular como principal, e isso daria descanso
**errado**, não só diferente. `preencherPapeis` (em `src/db/normalizar.ts`)
deriva o papel por **dia da rotina, na ordem dos exercícios**, com a mesma
`papeisDaRotina` que as telas usam, grava `papel`/`rir_min`/`rir_max` só onde
`papel IS NULL`, e só então `corrigirDescansos` roda com uma regra só para todo
mundo. `descansoLegado` foi apagado de `papel.ts`.

*E quem já está com o banco estragado?* Atendido na primeira abertura do app.
O passo roda dentro de `normalizar`, é idempotente (a segunda passada não acha
mais NULL) e escreve em UMA tabela: `routine_exercises`. `set_logs`,
`personal_records`, `point_events` e `workout_sessions` não aparecem em cláusula
nenhuma. A flag subiu para `descansos_v4` de propósito — quem já tinha
`descansos_v3` nunca mais rodaria o passo, e é justamente essa pessoa que a
decisão do Leonardo mandou atender.

Validado no navegador, no banco REAL da sessão de G2: rotina ativa com
`papel`/RIR zerados e descanso na regra antiga, mais `set_logs`,
`personal_records`, `point_events` e `workout_sessions` inseridos. Após um
reload: 7 linhas de força com papel (Supino máquina → principal, **Supino
inclinado máquina → complementar** — o caso que o fallback errava), cardio
seguindo sem papel, RIR em todas, 3 descansos subindo, e histórico intacto
(1 série 72,5 × 9, 1 PR, 40 XP, 2 sessões, 127 linhas de rotina — nenhuma criada
nem apagada). O log agora diz o que aconteceu: *"descanso corrigido em 3 de 127
exercício(s) das suas rotinas, agora pelo papel de cada um — ex.: Supino reto
com barra 150→180s"*. `aquecimento_series` fica em 0: aproximação é prescrição
nova, não dado ausente.

**2. M1 — uma constante só, e o gerador declara quando passa.**
`ALVO_SERIES`/`TETO_UTIL`/`FREQ_MINIMA` passaram a morar em `periodizacao.ts`
(puro, sem `@/db/client`); `volume.ts` reexporta e o gerador importa. O teto do
grupo pequeno subiu de **14 para 18** fracionadas. O gerador ganhou
`avisarTetoUtil`, com dois textos diferentes: ênfase pedida (até 28, e a tela de
volume vai marcar "alto" — é o mesmo número visto do outro lado) e excesso
indireto não pedido.

*Efeito medido na grade de 1.350 perfis, antes → depois:*

| | antes | depois |
|---|---|---|
| séries de força por perfil | 68,84 | 69,73 (+1,3%) |
| minutos de musculação por semana | 191,0 | 192,9 |
| bíceps, séries DIRETAS | 4,01 | **4,49 (+12%)** |
| tríceps, séries DIRETAS | 3,82 | **4,11 (+7,6%)** |
| panturrilha, séries DIRETAS | 3,53 | 3,71 (+5%) |
| peito / costas / ombro / quadríceps / posterior / glúteo | — | inalterados (±0,04) |

Ou seja: o teto moveu volume exatamente onde devia — trabalho **direto** de
grupo pequeno — e não tocou em grupo grande.

**O 3+2 de tríceps de B10 NÃO veio, e o motivo está medido.** O dia A continua
2+2. O bloqueio não é `tetoDe`: é `aparExcesso`, que mede o excesso do grupo
pequeno pelo total **fracionado** (~16 no tríceps, quase todo indireto dos
supinos) contra um alvo que significa trabalho **direto** (6). A montagem
produz 3+2 e o aparador devolve 2+2. É a mesma troca de unidade que M1 achou
entre os dois tetos, um nível acima — o achado 22. Testado nesta rodada
(`porDireto = emFoco || PEQUENOS`): o dia A **perdeu a elevação lateral** (7
exercícios viraram 6), o tríceps continuou 2+2 e o invariante (b) quebrou, com
desenvolvimento militar voltando a um dia de empurrar. Revertido; o mecanismo
ficou isolado no comentário da função.

**3. M2 — cardio nos 4 objetivos, e a dose declarada na semana.**
A porta era `emagrecimento || recomposicao`. Passou a ser "tem dose na
constante": `hipertrofia` (2 × 20 min) e `manutencao` (3 × 25 min) recebem.
**Escolha: prescrever, não apagar da constante** — em hipertrofia a dose é
cardiovascular, não estética; Lundberg 2022 (já citado no arquivo) achou o
efeito de interferência pequeno e ausente quando o aeróbio é pedalado, e a
ordem de modalidade já prefere bicicleta; e o cardio fica fora de
`estimarDuracao` e é a primeira coisa que `cortarParaCaber` remove, então ele
não consegue roubar série de força.

O aviso de cardio existia só por DIA e nunca somava. Agora existe o semanal:
*"das 3 sessões previstas para o seu objetivo, 0 couberam nos dias de treino.
As 3 que faltam você faz num dia SEM musculação"*. Sessões de cardio por perfil
na grade: **1,35 → 1,71**. Validado no navegador com 3 dias × 50 min, que é
exatamente o perfil que terminava em 0 sessões calado.

**4. Variedade semanal genérica — 114 → 0, e a régua estava errada antes.**
O relatório de G2 dizia 168. Com a régua corrigida — que desconta o que a **dor**
proíbe e o que a **cobertura indireta** satura (A9) — o número honesto contra
`63c716b` é **114**, e são 0 agora. Os 54 de diferença nunca foram alcançáveis:
com dor no ombro saem `Elevação lateral` (único exercício do padrão `lateral`) e
`Remada alta` (único do `alta`), e num dia de superior `desenvolvimento` e
`frontal` já vêm saturados pelos supinos — sobra UM padrão, que é o teto do que
A9 permite. Cobrar dois ali seria cobrar que A9 fosse violada.

A correção é a que o próprio relatório previu: a troca da SEMANA passou a
consultar `padroesSaturados` do dia (a função da própria sessão, extraída e
compartilhada pelos três consumidores). Com as duas escalas querendo a mesma
coisa, a ordem deixou de ser um empate a decidir e `diversificarNaSemana` pôde
rodar **depois** de `trocarPorCoberturaFinal` — antes ela rodava antes e era
desfeita. Segunda metade: a troca deixou de tentar só a ÚLTIMA aparição e passa
da última para a primeira, protegendo a primeira só quando ela é composto
**pesado** (é a carga do pesado que alimenta o gráfico).

**5. M3-texto — a fase imprime DIREÇÃO, o número é da linha.**
`RIR_POR_FASE` ganhou `ajuste: [number, number]` e os quatro textos viraram
relativos. O chip do executor (`fase.rirTexto`) mostrava **"RIR 3-4"** na
readaptação e **"RIR 4-5"** no deload, vindos de `RIR_POR_FASE`, sobre linhas
que diziam RIR 2 — agora mostra "afrouxe 1 a 2 reps" e some nas fases que não
afrouxam nada. Achado a mais durante a validação: `app/programa.tsx` imprimia
**"parar a 3 da falha"** a partir do campo cru da semana do bloco, o mesmo
defeito em outra tela; a tag agora usa a mesma direção, via
`faseDaSemanaDoBloco` (uma definição só, consumida por `fase.ts` e pela tela).
Confirmado no navegador: a semana 1 não imprime número nenhum.

**Validado no navegador a 390×844** (app real, banco real da sessão anterior):
rotina pré-v16 reidratada com papel/RIR/descanso coerentes e histórico intacto;
"Refazer meu treino" com 4 dias × 1h30 (avisos novos de teto útil, com vírgula
decimal como o resto do app) e com 3 dias × 50 min (aviso semanal de dose de
cardio); tela do dia mostrando papel + RIR em cada linha; tela do programa sem o
número de RIR conflitante. Zero erro de console.

**Não validado no navegador:** a semana de **deload** nas telas — ela é
dependente de data (semana 8 do bloco ou do plano de retorno) e o banco de teste
está na semana 1. Coberta pela seção 22 do harness, que resolve as duas fases
via `resolverFase` e confere o chip. **Conferir no celular quando a semana 8
chegar.**

## Validação de G2 (03/08/2026)

Working tree, sem commit. `tsc --noEmit` limpo. `testar:gerador` e
`testar:migracao` 100%. Schema: **v16** (aditiva).

**O gate, na ordem certa desta vez.** Os invariantes novos foram escritos
direto na grade de 1.350 perfis (seção 16) *antes* de qualquer correção e
rodados contra o HEAD: **30 falhas**. Depois, o MESMO arquivo de teste rodou
num worktree em `8c68ef1` — **30 falhas, as mesmas**, e nenhuma asserção
pré-existente de G1 quebrou dos dois lados. Ou seja: tudo que falhou era
defeito de G2, nada era regressão de G1. Com a correção: **0**.

| Invariante (grade de 1.350 perfis) | contra `8c68ef1` | depois |
|---|---|---|
| (a) exatamente 1 principal por grupo por sessão | 16.947 | 0 |
| (b) nenhum desenvolvimento pesado em dia de empurrar | 548 | 0 |
| (c) grupo pequeno em dia homônimo com 2 exercícios e 1 mono | 786 | 0 |
| (d) reps ≤ 8 sempre com 180 s | 0 | 0 |
| (e) faixa de reps não colapsa dentro do grupo | 2.337 | 0 |
| (f) cardio na dose e modalidade da constante | 613 | 0 |
| (g) RIR em todo exercício de força | 27.708 | 0 |
| G1: exercício acima de 4 séries | 0 | 0 |
| G1: sessão acima do teto fora da exceção | 0 | 0 |
| G1: 3+ exercícios do mesmo padrão | 0 | 0 |

(d) já passava contra G1 e continua passando: o defeito de A5 não era o tier
errado, era o tier **inalcançável** — quem marcava "iniciante" nunca chegava a
`reps ≤ 8`. Quem pega isso é a seção 17, que compara a prescrição do mesmo
exercício no mesmo papel entre iniciante e intermediário (3 cenários, todos
divergiam antes; nenhum diverge agora) e cobra ao menos um exercício a 180 s
no plano de um iniciante (era zero em todos).

**O dia A, de G1 para G2** (mesmo perfil do bug: 4 dias, foco peito, iniciante,
academia, preferência máquina, 90 min, recomposição):

| | G1 | G2 | B10 pedia |
|---|---|---|---|
| Padrões distintos / exercícios | 5 em 5 | **7 em 7** | 7 em 7 |
| Exercícios de tríceps | 1 (mergulho) | **2** (testa + polia) | 2 |
| Extensão de cotovelo alongada | 0 | **1** | 1 |
| Séries diretas de ombro, nenhuma anterior | 0 | **6** | 6 |
| Desenvolvimento pesado no dia | 1 | **0** | 0 |
| Faixas de reps distintas | 2 | **4** | 4 |
| RIR na tela | não existia | **em todo exercício** | sim |
| Séries de aproximação | 0 | **2, só no principal** | 2 |
| Cardio | esteira, 20 min, todo dia | **bicicleta, 30 min, 3 dias** | idem |
| Duração declarada | 47 min (cardio invisível) | **55 min + 30 de cardio** | ~52 |

**Validado no navegador a 390×844** (app de verdade, "Refazer meu treino" com o
perfil salvo): plano regerado com A Peito e tríceps (7 exercícios, ~55 min + 30
de cardio), B Inferior completo (75 min, **sem cardio** — a modalidade evita o
dia de perna), C e D com cardio. Tela do dia mostra papel e RIR em cada linha
("Supino máquina · Peito · 4 × 6-10 · 150s · RIR 1-2 · Principal · +2
aproximações") e o cardio como "30 min · Zona 2". Executor mostra o chip
`RIR 1-2` e o aviso de aproximação só no principal; tocar o número da série
alterna para aquecimento e renumera as séries valendo. Zero erro de console
além do WakeLock do `expo-keep-awake` com aba oculta (ambiente de dev, já
documentado).

**Não validado no navegador:** gravar uma série de aquecimento de ponta a ponta
— o teclado numérico do executor não responde a evento sintético no pane (é
limitação do harness, não do app; o mesmo teclado funciona no toque real). A
exclusão do aquecimento de volume, PR e histórico continua garantida pelas
queries que já existiam (`tipo <> 'aquecimento'` em 4 pontos + `registrarSerie`
pulando `detectarPRs`), e nenhuma delas foi tocada. **Conferir no celular.**

## Validação de G1 (03/08/2026)

Working tree, sem commit. `tsc --noEmit` limpo. `testar:gerador` e
`testar:migracao` 100%.

**O gate cumprido, na ordem.** Os testes novos foram escritos primeiro e
rodados contra o código defeituoso: **34 falhas**, incluindo a reprodução exata
do print do celular (8 exercícios de peito, 5 no padrão `reto`, 26 séries
fracionadas na sessão, peito 1× na semana). Depois da correção, 0 falhas.

**O dia A, antes e depois** (mesmo perfil: 4 dias, foco peito, iniciante,
academia, preferência máquina, 90 min, recomposição):

| | antes | depois |
|---|---|---|
| Exercícios de peito na sessão | 8 | 3 |
| Séries fracionadas de peito | 26 | 12 |
| Exercícios no padrão mais concorrido | 5 | 1 |
| Padrões distintos / exercícios | 5 em 10 | 5 em 5 |
| Peito por semana | 1× | 2× |
| Duração | 87 min | 47 min |

**Validado no navegador a 390×844** (onboarding completo → "Refazer meu treino"
com o perfil do bug → plano gerado pelo app de verdade): a divisão saiu
`Superior / Inferior` com A Peito e tríceps (6 itens, ~47 min), B Inferior
completo, C Costas e bíceps, D Superior misto — idêntico ao que o harness
prevê. Rotinas antigas continuam no banco com `ativa = 0` (a tela mostra
"nada é apagado" e o histórico segue intacto). Zero erro de console.

## Correção do cross-review de G1 (03/08/2026)

O qa reprovou 3 achados em `ee543d2`, já em produção. Corrigidos na working tree.

**ALTO-1 — a correção trocou redundância de padrão por empilhamento de série.**
Recusar exercício redundante encolheu `quantos`, e `base = floor(naSessao /
quantos)` continuou dividindo o mesmo volume entre menos exercícios. Numa grade
de 1.350 perfis, exercício com 5+ séries foi de **497 (pré-G1) para 1.272**
(2,6×) — pior que antes de G1. Corrigido em três pontos, porque cada um cria
série por um caminho diferente: montagem, `consolidar` (que chegava a colapsar
um grupo em UM exercício de 10 séries) e o passo final. Amplificador estrutural
também corrigido: `posterior` e `gluteo` tinham 2 padrões cada contra 5 do
quadríceps, o que dava teto efetivo de 4 exercícios por sessão e concentrava o
empilhamento no dia de perna. Agora 6 e 5 padrões. De quebra, `coice` estava
classificado como abdução — é extensão de quadril.
**Medido: 1.272 → 0 (pré-G1 era 497).**

**ALTO-2 — o teste prometia garantia que a função não dava.** `aparaUmaVezNaSessao`
exigia que a remoção resolvesse o excesso inteiro (`excesso <= ultimo.series`) e
desistia com 6 séries diretas na mesa. Escolhida a saída (a): **corte parcial** —
remove o último exercício mesmo sem zerar o excesso, em passos, nunca abaixo de
um exercício. A asserção declara a ÚNICA exceção que sobra e que o código de
fato entrega: grupo com um exercício só, no piso de 2 séries. A exceção anterior
(`if (!diretas[g]) continue`) presumia justamente a condição que o código não
cumpria. **Medido: 4 → 0 sessões acima do teto fora da exceção.**

**MÉDIO-1 — grupo grande sumindo da semana sem ninguém dizer.** `avisarExcessoIndireto`
rodava ANTES do corte por tempo e por isso mentia: um perfil de 30 min terminava
com zero série direta de ombro e o aviso dizia "ombro (27, sendo 12 diretas) —
passa do alvo". Movido para o fim do pipeline, junto com um aviso novo que nomeia
o grupo apagado pelo relógio. O dia D do split com foco superior também passou a
abrir com ombro (é o grupo cuja segunda dose só existe ali). **A garantia não é
"nunca some"** — com 30 min não cabe tudo, e prometer o contrário seria mentir de
novo: a garantia é que, quando some, o plano diz.

**O gate, de novo — e ele pegou o próprio remendo.** As asserções novas foram
rodadas contra `ee543d2` e **passaram**, porque rodavam só nos 9 cenários
nomeados: exatamente a crítica do qa. Foi preciso levar os invariantes para uma
**grade de 1.350 perfis** (seção 16) e trazer os 4 perfis do qa para a lista
nomeada. Só então falharam contra produção — **9 falhas** — e passaram com a
correção. Nenhuma asserção existente foi afrouxada.

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

De G3 (04/08 — achados medidos durante a implementação, NÃO corrigidos):

41. **A rotação de âncora entre blocos tem UM passo de memória, e oscila A-B-A-B.**
    `escolherPrincipalDoBloco` recebe só a âncora do bloco anterior, então com 3+
    exercícios no mesmo padrão ela alterna entre dois e nunca chega no terceiro.
    Medido: **1.252 de 1.252** transições voltam ao exercício do bloco 1 no bloco
    3. Não é errado (o padrão é preservado e a quebra é declarada nas duas
    pontas), e tem até um efeito bom não intencional — voltar a A rejunta a curva
    de A, que continua no banco. Fechar de verdade exige ler as N últimas rotinas
    arquivadas, o que o schema já permite (nada é apagado).
42. **`tecnicasDaSessao` não sabe se a sessão está apertada no relógio.**
    `apertadoNoTempo` existe, tem o teto de 2 ligado nele, e **ninguém passa
    `true`** — a informação existe em `estimarDuracao` vs `minutosPorDia` e não
    chega até aqui. Consequência: a segunda aplicação de B7 é inalcançável hoje,
    do mesmo jeito que os 180 s eram antes de A5. O invariante mede o teto, não a
    segunda aplicação, então ele passa nos dois mundos.
43. **`quebrasDeAncoraSalvas` compara a rotina ativa com a ÚLTIMA arquivada por
    data.** Quem regerou o treino três vezes no mesmo dia tem três rotinas com
    `criado_em` próximos, e a "anterior" é a penúltima regeração, não o bloco
    anterior de verdade. O efeito é uma quebra a mais no gráfico, nunca uma a
    menos. Fechar exige distinguir "bloco novo" de "regerei porque errei uma
    resposta" — que é uma decisão de produto, não de código.
44. **Nenhuma tela de G3 foi vista rodando no navegador.** Ver a seção de
    validação: sem perfil o app redireciona tudo para `/onboarding`, e o
    onboarding não foi dirigido de ponta a ponta. As asserções de fonte provam
    que o fio está ligado; não provam layout, contraste nem alvo de toque das
    linhas novas.

De G1 (03/08 — achados encontrados durante a implementação, nenhum virou código):

12. **A tela do dia e o gerador discordam sobre ORDEM — precisa do Leonardo.**
    `desordenado` (`app/dia/[id].tsx:114-117`) e `reordenarPorPrioridade`
    (`src/features/treino/api.ts:394`) usam prioridade GLOBAL; o gerador, por
    A4, ordena por papel **dentro de cada bloco de grupo**, preservando o
    agrupamento. Consequência: todo plano gerado nasce com o aviso "A ordem
    pode render mais", e o botão "Reordenar pela ciência" espalharia o peito em
    dois pontos da sessão (supinos no começo, crossover depois do ombro) — que
    é exatamente o que A4 proíbe. O aviso **já aparecia antes de G1** (o plano
    defeituoso também o disparava), então não é regressão; é conflito de duas
    definições de "ordem certa" que G1 tornou visível em todo plano. Mudar o
    diagnóstico é mexer em comportamento que roda em produção: decisão do dono,
    não da fase. B10 resolve sozinho quando A9 tirar o desenvolvimento pesado
    do dia de empurrar.
13. **`divisaoDe(4)` mente quando existe foco**: diz "Duas sessões de tronco e
    duas de perna: cada grupo 2× na semana" e o split com foco superior é 3 de
    tronco + 1 de perna. Pré-existente (o split antigo também era 3+1), e agora
    fica ao lado do texto correto sobre frequência.
14. ~~**Peito repete os mesmos 3 exercícios nos dias A e D.**~~ — **feito em
    G3** (B8 nível 2). `variarEntreSessoes` roda o acessório DENTRO do padrão
    trocando o perfil de resistência. Medido na grade com a régua que desconta
    dor: **0 de 1.027 pares** repetem. O critério de aceite registrado foi
    cumprido no dia do print: inclinado máquina → barra, crossover na polia →
    crucifixo com halteres, com o `Supino máquina` intacto como âncora.
15. **Panturrilha some do plano inteiro** com foco inferior em 3 dias (1 → 0
    aparições, por corte de tempo). Achado do teste de frequência; o teste
    restringe a asserção a grupo grande justamente por isso.
16. ~~**Uniarticulares ainda em `COMPOSTOS` além do crossover**~~ — **feito em
    G2**, por um caminho diferente do proposto. Tirá-los da lista jogaria hip
    thrust para o fim da sessão e daria a âncora do glúteo ao agachamento
    ajoelhado. `COMPOSTOS` passou a declarar o que sempre foi de fato —
    **demanda sistêmica**, quem abre a sessão — e `articulacoesDe` (em
    `papel.ts`) virou o atributo explícito de B3. Os cinco respondem "mono"
    onde importa: não podem ser complementar nem finalizador, e o descanso
    deles agora sai do papel, não da lista.

Dos DOIS cross-reviews de G2 (03/08 — o que ficou fora, com número):

27. ~~**Variedade semanal de padrão só é garantida nas COSTAS.**~~ — **feita em
    G2.1**: 114 → 0 na régua corrigida (a de G2 contava 168 porque não
    descontava dor nem saturação de A9). A troca da semana passou a consultar
    `padroesSaturados` do dia e por isso pôde rodar depois da cobertura.
28. ~~**M1 — dois tetos para a mesma pergunta.**~~ — **feita em G2.1**: uma
    constante em `periodizacao.ts`, teto do pequeno 14 → 18, e o gerador
    declara quando passa. Efeito medido na grade. **O 3+2 de tríceps NÃO veio**
    — o bloqueio é `aparExcesso` (achado 22), não o teto.
29. ~~**M2 — cardio incompleto em 3 dos 4 objetivos.**~~ — **feita em G2.1**:
    os 4 objetivos recebem a dose da constante e o que não cabe é declarado na
    semana. Sessões de cardio por perfil na grade: 1,35 → 1,71.
30. ~~**M3 — o card do deload ainda imprime número, não direção.**~~ — **feita
    em G2.1**, e em duas telas: o chip do executor (`RIR 3-4` / `RIR 4-5`) e a
    tag da tela do programa (`parar a 3 da falha`), que era o mesmo defeito
    ainda não catalogado.
34. **`textFaint` continua reprovando AA fora da tela de sessão.** O token
    (`#5C6373`) dá **3,00:1** sobre `surface`, **3,30:1** sobre `bg` e
    **2,73:1** sobre `surfaceAlt`, e é o padrão de `type.label` — ou seja, todo
    rótulo de seção do app. A fase 4 trocou os usos INFORMATIVOS da sessão para
    `textDim`; subir o token em si não foi feito porque não resolve com um
    valor só: `#6E7688` (a sugestão da auditoria) mede **4,32:1** sobre `bg` —
    ainda reprova — e para passar sobre `surfaceAlt` seria preciso luminância
    relativa ≥ 0,237, que é praticamente `textDim`. Ou o token vira `textDim`
    (e a hierarquia de 3 níveis do design system vira 2), ou cada fundo ganha o
    seu. É decisão de design system, não de tela, e muda 49 arquivos.
35. **O executor conclui a série mas não pode concluí-la pelo teclado.** Testado
    e descartado nesta fase: confirmar as repetições gravaria a série, o que
    tiraria mais 1 toque do caminho de edição (4 → 3). Não entrou porque o
    teclado também é usado para PREPARAR a próxima série durante o descanso
    ("na próxima ponho 85") — gravaria uma série que ninguém fez. Se um dia
    entrar, precisa de rótulo próprio no botão, não do "Confirmar" genérico.
36. **A coluna "Anterior" das linhas de aproximação mostra a série anterior da
    posição, não a do exercício.** Com 2 aproximações no topo, a linha de
    aquecimento 1 exibe o "80 × 8" que era da série 1 valendo. Pré-existente
    (`anteriores[i]` é indexado por posição da linha), sem efeito no que se
    grava — a aproximação não entra em volume nem PR. Some se `anteriores`
    passar a ser indexado pelas linhas VALENDO.
31. ~~**Regra por PADRÃO para dor, em vez de lista nominal**~~ (F5) — **feita na
    fase 5**: `contraindicacao.ts` deriva de cargas mecânicas e `REGIOES_DOR.
    evitar` virou `exemplos`. Sobrou um reforço nominal declarado (`Hack
    machine`), com o motivo mecânico por escrito e cobrado pelo harness.

Da fase 5 (04/08 — achados medidos durante a implementação, NÃO corrigidos):

37. **`padroesQueCobre` atribui o hinge carregado a quem não faz hinge.**
    `Agachamento livre sem peso` e `Ponte de glúteo` listam `posterior` como
    secundário e caem no DEFAULT `quadril` de `padraoDe`, que é stiff/romeno/bom
    dia. Nenhum dos dois carrega o isquiotibial por flexão de quadril com carga
    externa, e mesmo assim os dois SATURAM esse padrão no dia — foi o que fez
    uma semana inteira ficar só com a flexão nórdica quando a dor no joelho
    tirou os agachamentos com carga de uma casa com halteres. Corrigir na
    origem (`return []` quando o nome não é hinge) fecha o caso **e move a
    composição de outros dias em cascata**: testado, um perfil de 6 dias passou
    a receber desenvolvimento militar num dia de empurrar, quebrando (b). Trocar
    um defeito de 1 perfil por outro de 1 perfil, num pipeline que a fase 5 não
    veio auditar, é como as correções de meio de pipeline se desfizeram antes.
    Ficou um **fallback declarado** em `diversificarNaSemana` (sem candidato
    fora dos saturados, aceita um saturado — `cabe` e `naoEstoura` continuam
    valendo), e o achado fica aqui com a conta pronta.
38. **Proteína de hipertrofia e manutenção continua sobre o PESO TOTAL** — e em
    corpo com gordura alta isso chega a **4,2 g/kg de massa magra** (o pior caso
    da grade de 672 corpos, 50 de 672 em hipertrofia e 46 em manutenção acima de
    3,1). N3 fala de emagrecimento e é só isso que a fase mudou; estender a
    massa magra ao ganho muda a prescrição de quem está em superávit, o que é
    decisão do dono. O invariante (f) mede os dois lados com a régua de cada um
    (déficit: 1,6-3,1 g/kg MM; ganho: 1,4-2,0 g/kg de peso), então a mudança —
    se vier — já nasce medida.
39. **O piso absoluto por gênero (1.200 F / 1.500 M) é prática comum sem
    citação.** Está declarado assim no código. O piso que morde de verdade nos
    cálculos automáticos é o metabolismo basal; o absoluto é rede para meta
    manual. Se virar argumento de produto, precisa de fonte aberta antes.
40. **`avisosDaMeta` não distingue meta manual antiga de meta manual escolhida
    hoje.** Uma meta salva à mão há três meses passa a exibir o aviso de piso
    quando o peso muda — correto — mas o texto não diz "você escolheu isto em
    DD/MM". `nutrition_targets.valid_from` e `origem` já existem para isso.

De G2 (03/08 — achados durante a implementação, nenhum virou código):

21. **O piso de A7 perde para o teto da sessão, e isso é decisão.** Com 6,5
    fracionadas de indireto vindas dos supinos, um tríceps de 2 exercícios × 2
    séries fecha em 10,5 num teto de 10. O teto ganha (é garantia testada desde
    G1) e o plano DECLARA o grupo que ficou com um exercício só. Na grade isso
    acontece em perfis de casa sem equipamento (não existe isolador de tríceps
    com peso corporal) e em sessões de 30 min. Resolver de verdade exige mexer
    no teto do grupo pequeno ou no volume de peito da sessão — nenhum dos dois
    cabia aqui.
22. **B10 pede 5 séries diretas de tríceps no dia A; G2 entrega 4** — e G2.1
    também, com o mecanismo agora isolado. O piso monta 3+2 e `aparExcesso`
    corta para 2+2 porque compara o total **fracionado** do tríceps (~16, quase
    todo indireto dos supinos) com um alvo que significa trabalho **direto**
    (6). Subir o teto do pequeno para 18 (M1) não resolve: o teto governa
    `preencherTempo`, o aparador roda antes. **Testado em G2.1** medindo
    `porDireto = emFoco || PEQUENOS`: o dia A perdeu a elevação lateral (7
    exercícios → 6), o tríceps continuou 2+2 e o invariante (b) quebrou, com
    desenvolvimento militar voltando a um dia de empurrar — porque o volume que
    o pequeno passa a guardar desloca o corte por tempo, e é o corte por tempo
    que escolhe o ombro do dia. Revertido. Precisa de rodada própria, medida.
32. **Duas telas ainda dizem número de RIR em prosa.** `BLOCO[0].o_que_fazer`
    ("umas 3 repetições ainda no tanque") e `BLOCO[5]` ("chegar a 1 repetição da
    falha"). A tag estruturada foi corrigida em G2.1; a prosa ficou porque na
    semana 1 ela é instrução de CALIBRAÇÃO (achar a carga), não prescrição por
    exercício. Vale reescrever quando G3 tocar no texto do bloco.
33. **O log de `normalizar` só aparece no console.** "papel e esforço (RIR)
    preenchidos em N exercício(s)" e "descanso corrigido em N de M" são
    `console.log` — ninguém no celular vê. Quando um backfill mexer em algo que
    o usuário reconheça na tela, ele precisa de aviso visível, não de log.
34. **Reps de linha acrescentada à mão não são recalculadas depois.** A linha
    nova recebe a faixa do papel dela no INSERT; se um acréscimo posterior a
    demover de finalizador para isolador, ela fica com 12-20 e RIR 0-2. Papel,
    RIR e descanso acompanham; a repetição não, de propósito — ela é editável na
    tela e sobrescrevê-la a cada recálculo apagaria escolha do usuário. Fechar
    de verdade exige distinguir "faixa que o app pôs" de "faixa que a pessoa
    escolheu", que é uma coluna a mais.
35. **9,9% das sessões estouram o tempo pedido, e isso é anterior a tudo.**
    1.864 de 18.900 na grade, idêntico em `63c716b` e em `bb6babf` — não é
    regressão de fase nenhuma. Vem de `cortarParaCaber` parar quando só sobram
    compostos pesados (o laço pula `ehPesado`) ou quando o piso de 3 exercícios
    é atingido. Ou o corte aprende a tirar SÉRIE em vez de exercício quando só
    sobra pesado, ou o plano declara "não cabe em X min" com o número real.
36. **A queda de −3 séries no grupo de FOCO em 10 perfis.** Preço medido do teto
    do grupo pequeno em 18 (M1). O foco continua muito acima do piso de 10 e a
    ênfase já ganha o desempate em `preencherTempo`, mas quem pediu peito e
    recebe 18 em vez de 21 não sabe por quê. Um aviso nomeando a troca fecharia.
23. **Peito fecha em 12 diretas no dia A, contra 10 de B10.** Não é defeito: é
    o teto de sessão (12) sendo usado inteiro porque sobra tempo. B10 chegou a
    10 porque também gastava tempo com o 4º e 5º exercício que G2 não tem.
24. **`quantosExercicios` e o piso de 2 séries continuam sendo convenção.**
    O achado 18 do qa segue aberto: o piso de A7 cria exercício com 2 séries,
    e nada garante que ele não caia para 1 num corte futuro.
25. ~~**A grade de 1.350 perfis testa 3 locais, não 5.**~~ — **feito na correção
    do cross-review de G2.1**, e não era "sem custo": com as chaves reais o
    invariante de variedade semanal que G2.1 declarou como 0 dava 3, e o número
    de 114 que ele reportou como baseline era inflado pela academia repetida
    quatro vezes. `equipamentosDe` deixou de cair calado e o harness ficou
    estrito. Estava neste arquivo como candidato desde G2 — três fases medindo
    sobre a mesma academia.
26. ~~**O cabeçalho da tela do dia conta o cardio como exercício.**~~ — **feito
    na correção do cross-review de G2.1**, junto com M2: a linha passou a
    mostrar também o tempo, com o cardio somado e nomeado.

Do cross-review do qa (03/08 — deixados fora da correção de propósito):

17. **O aviso de sobra atribui à recuperação o que é limite estrutural** (M2):
    "todo grupo já está no volume que a recuperação acompanha" também sai quando
    o que travou foi o teto por padrão ou a falta de exercício no local — ou
    seja, limite de catálogo/estrutura, não de fisiologia. O texto precisa
    distinguir os dois casos; hoje ele afirma o mais tranquilizador dos dois.
18. **Piso de 2 séries por exercício não é garantido** (M3): o teto de 4 virou
    regra dura no passo final, o piso de 2 continua sendo só convenção de quem
    cria série. B2 pede os dois lados ("nunca de 1-2, nunca de 5+").
19. **O rename desiste se já existir `Supino na polia`** (B1): `renomearExercicios`
    pula quando o nome novo já está no banco, para não fundir históricos. Quem
    tiver criado um exercício com esse nome na mão fica com os dois. Conservador
    de propósito, mas o usuário não é avisado.
20. **Estabilidade de `Array.prototype.sort` no Hermes não foi verificada** (B2):
    `ordenarPorPapelNoDia` depende de sort estável para manter o composto
    principal na posição 1 do bloco. É garantido pela spec desde ES2019 e
    verificado no V8 (web), não no Hermes do build nativo. Se o app for para
    build nativo, conferir antes.
