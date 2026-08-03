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
| **G1** | **Estrutura e seleção** | A2, A1+A11, A4, A3, A8 | **feita e no ar** — 03/08. Testes novos (seções 9-13 de `testar-gerador.mjs`) escritos ANTES e comprovadamente falhando. Gate reverificado pelo Claude com `git stash push -- src/`: **32 falhas contra o código antigo, 0 com o novo**. Ver "Validação de G1" |
| G2 | Prescrição com papel | causa 5 + F8 (aquecimento) | pendente |
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
16. **Uniarticulares ainda em `COMPOSTOS` além do crossover**: hip thrust,
    ponte de glúteo, elevação pélvica, pull through e flexão nórdica movem uma
    articulação só e estão listados como compostos (hip thrust também em
    `COMPOSTOS_PESADOS`). Diferente do crossover, aqui não há conflito interno
    de classificação — a lista e o `padraoDe` concordam. Mexer muda descanso e
    ordem no programa inteiro: é decisão de prescrição, cabe em G2 junto da
    inversão de `descansoCorreto`, com teste de descanso no mesmo commit.

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
