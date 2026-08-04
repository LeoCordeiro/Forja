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
| G2.1 | Sobras do G2 | ALTO-3 (backfill de papel) + M1 M2 M3-texto + variedade semanal | **feita, não commitada** — gate: **23 falhas no gerador + 5 na migração contra `63c716b`, 0 depois**. Ver "Validação de G2.1" |
| G3 | Treinador que explica e varia | execução detalhada, técnicas de intensidade, objetivo do exercício, variação entre ciclos | pendente |
| 4 | Série em 1 toque | U1 U2 U5 U6 U7 | pendente — validar no celular, não só navegador |
| 5 | Segurança e nutrição | F5 N3 N6 N8 U8 | pendente |
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
14. **Peito repete os mesmos 3 exercícios nos dias A e D.** O rodízio (`rodar`)
    funciona no nível dos candidatos, mas com preferência "máquina" o melhor de
    cada padrão é o mesmo nos dois dias, e o teto por padrão fecha a porta para
    o resto. É o **nível 2 de B8** (rodízio DENTRO do padrão entre sessões), que
    é G3 — anotado, não implementado.
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
31. **Regra por PADRÃO para dor, em vez de lista nominal** (F5). `Remada alta`
    entrou na lista de dor no ombro como correção mínima; a correção boa é
    derivar de padrão + atributos, e isso é fase 5.

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
23. **Peito fecha em 12 diretas no dia A, contra 10 de B10.** Não é defeito: é
    o teto de sessão (12) sendo usado inteiro porque sobra tempo. B10 chegou a
    10 porque também gastava tempo com o 4º e 5º exercício que G2 não tem.
24. **`quantosExercicios` e o piso de 2 séries continuam sendo convenção.**
    O achado 18 do qa segue aberto: o piso de A7 cria exercício com 2 séries,
    e nada garante que ele não caia para 1 num corte futuro.
25. **A grade de 1.350 perfis testa 3 locais, não 5.** `academia_rede`,
    `academia_simples` e `casa_halteres` não existem em `LOCAIS` e caem no
    fallback de `equipamentosDe` (academia completa). Os locais reais são
    `academia`, `smart_fit`, `academia_basica`, `casa_equipada`,
    `casa_simples`. Pré-existente de G1; corrigir amplia a cobertura sem custo.
26. **O cabeçalho da tela do dia conta o cardio como exercício** ("8
    exercícios" num dia de 7 + bicicleta). `diasComTempo` já separa; a tela do
    dia usa `dados.exs.length` direto.

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
