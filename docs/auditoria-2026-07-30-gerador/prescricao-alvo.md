# Auditoria da SAÍDA do gerador — dia "A — Peito e tríceps"

> fitness-scientist · 2026-08-03 · escopo: o treino que chegou ao usuário, não o código.
> Leitura prévia: `docs/auditoria-2026-07-29/fitness.md` e `consolidado-cto.md`.
> Nenhum arquivo de código editado. Complementa `causa-mecanica.md`.

## Fontes abertas via WebFetch NESTA sessão (únicas citadas como evidência)

1. [Schoenfeld et al. 2016 — descanso 1 vs 3 min, RCT, n=21 treinados, 8 sem](https://pubmed.ncbi.nlm.nih.gov/26605807/)
2. [Schoenfeld, Ogborn, Krieger 2016 — frequência, meta-análise, 10 estudos](https://pubmed.ncbi.nlm.nih.gov/27102172/)
3. [Pelland et al. — dose-resposta de volume SEMANAL, 67 estudos, n=2.058](https://pubmed.ncbi.nlm.nih.gov/41343037/)
4. [Remmert, Pelland, Robinson, Hinson, Zourdos 2025 — volume POR SESSÃO](https://sportrxiv.org/index.php/server/preprint/view/537) — **preprint, não revisado por pares**
5. [Robinson et al. 2024 — RIR / proximidade da falha, meta-regressões](https://sportrxiv.org/index.php/server/preprint/view/295)
6. [Refalo et al. 2023 — proximidade da falha, revisão sistemática, 15 estudos](https://pmc.ncbi.nlm.nih.gov/articles/PMC9935748/)
7. [Schoenfeld et al. 2017 — carga baixa vs alta, meta-análise, 21 estudos](https://pubmed.ncbi.nlm.nih.gov/28834797/)
8. [Nunes et al. 2021 — ordem dos exercícios, meta-análise, 11 estudos](https://pubmed.ncbi.nlm.nih.gov/32077380/)
9. [Lundberg et al. 2022 — treino concorrente e fibra, 15 estudos, n=300](https://pmc.ncbi.nlm.nih.gov/articles/PMC9474354/)
10. [Sødal et al. 2023 — drop sets, meta-análise, 6 estudos, n=142](https://pubmed.ncbi.nlm.nih.gov/37523092/)
11. [Krzysztofik et al. 2019 — técnicas avançadas, revisão sistemática](https://pmc.ncbi.nlm.nih.gov/articles/PMC6950543/)
12. [ACSM 2009 — Position Stand, Progression Models in Resistance Training](https://pubmed.ncbi.nlm.nih.gov/19204579/)
13. [Chaves et al. 2020 — supino horizontal vs inclinado, RCT, n=47 destreinados](https://digitalcommons.wku.edu/ijes/vol13/iss6/12)
14. [Docking & Cook 2019 — adaptação do tendão, revisão narrativa](https://pmc.ncbi.nlm.nih.gov/articles/PMC6737558/)
15. [Frontiers in Nutrition 2025 — memória muscular, revisão](https://www.frontiersin.org/journals/nutrition/articles/10.3389/fnut.2025.1701520/full)

**Tentei e NÃO consegui abrir** (portanto não citados como evidência): Kassiano et al. 2022
sobre variação de exercícios (JSCR, HTTP 402) e o RCT de seleção de exercício em hipertrofia
regional (Taylor & Francis, HTTP 403). Onde seriam usados, está escrito **prática comum,
sem citação**.

## Perfil reconstruído a partir da saída

A saída é reproduzível e determina os parâmetros: `dias=4`, `focos=['peito']` (região resolvida
como superior), `experiencia='iniciante'`, `local='academia'`, `preferenciaEquipamento='maquina'`,
`minutos=90`, `barraFixaReps<6`, `objetivo='recomposicao'`. Confirmado pela aritmética: alvo de
peito 14 (10 base + bônus 4), 1 aparição na semana, `naSessao = min(10, 14) = 10`, `quantos = 3`,
distribuição 4/3/3 — exatamente os três primeiros itens da lista.

---

# PARTE A — o que está errado nesta saída

## A1 — CRÍTICO. 22 séries diretas de peito numa sessão; o teto de sessão (10) foi burlado

**Problema.** 4+3+3+3+3+3+3 = **22 séries diretas** num único treino, mais 2 fracionadas do
mergulho = **24 séries fracionadas de peito numa sessão**.

**Causa.** `TETO_SERIES_SESSAO = 10` é aplicado só na montagem inicial (`gerador.ts:809`, que
corretamente parou em 10). Depois, `preencherTempo` (`gerador.ts:1249-1296`) acrescenta
exercícios e séries verificando **apenas o teto SEMANAL** (`tetoDe`, 28 para grupo em foco) — o
teto por sessão não é reavaliado em nenhum ponto do pipeline pós-montagem. Como o peito aparece
1× na semana (A2), semanal e por sessão viraram a mesma coisa.

**Impacto.** **87 minutos estimados** pela fórmula do próprio app (982 s de execução + 3.120 s de
descanso + 1.140 s de transição = 5.242 s) mais 20 min de esteira = **107 minutos reais**, com
**59,5% do tempo parado**. As 12 últimas séries custam ~32 min por semana.

**Evidência.** [Remmert et al. 2025](https://sportrxiv.org/index.php/server/preprint/view/537)
localiza o *point of undetectable outcome superiority* (PUOS) em **≈11 séries fracionadas por
sessão** para hipertrofia. A saída entrega 24. **Ressalva explícita:** os autores dizem que "há
dados insuficientes com volumes por sessão muito altos" e que não se sabe se volumes muito altos
atenuam a adaptação. Não é lícito dizer "22 séries te machucam"; é lícito dizer que o benefício
das séries 12 a 22 é indetectável na melhor evidência disponível e o custo (32 min/semana,
fadiga, adesão) é certo. É preprint sem revisão por pares — pesa menos que os itens 1-3 e 7-9.
O uso alternativo desses 32 min tem evidência mais forte:
[Schoenfeld, Ogborn, Krieger 2016](https://pubmed.ncbi.nlm.nih.gov/27102172/) achou 2×/semana
superior a 1× com volume equalizado (ES 0,49 ± 0,08 vs 0,30 ± 0,07; P = 0,002).

**Solução.** Reaplicar o teto por sessão como **última etapa do pipeline**, depois de
`preencherTempo` e `consolidar`, sobre o total **fracionado**. Teto: 10-12 fracionadas/sessão
para grupo grande.

## A2 — CRÍTICO. Quem pediu ênfase em peito recebeu peito 1× por semana, sem aviso

**Problema.** No split de 4 dias com foco superior (`SPLITS_FOCO.superior[4]`), peito aparece 1×
e costas 1×. São os dois maiores grupos do tronco, num programa cuja proposta é priorizar o tronco.

**Causa.** O modelo é A=peito/tríceps/ombro, B=costas/bíceps/trapézio, C=inferior,
D=ombro/tríceps/bíceps/abdômen. O comentário em `gerador.ts:176-178` afirma sobre `SPLITS` que
"nenhuma delas deixa um grupo grande com menos de 2 aparições na semana" — mas `SPLITS_FOCO` é
tabela separada e não herda o critério. Pior: o aviso de frequência (`gerador.ts:774-791`) só
examina a região **preterida**. Com foco superior ele olha perna, avisa sobre perna, e nunca
percebe que peito e costas caíram para 1×.

**Impacto.** É a causa mecânica de A1: com 1 aparição, `ceil(alvo/aparicoes)` joga o orçamento
semanal inteiro numa sessão. E o efeito é o oposto do pedido — o usuário marcou peito e recebeu a
pior estrutura de frequência disponível para peito, em silêncio.

**Evidência.** [Schoenfeld, Ogborn, Krieger 2016](https://pubmed.ncbi.nlm.nih.gov/27102172/):
2× > 1× com volume equalizado. [Pelland et al.](https://pubmed.ncbi.nlm.nih.gov/41343037/) acha
efeito negligenciável da frequência quando o volume é modelado — o que não contradiz: a
frequência importa como *veículo* do volume, e é exatamente o problema aqui, porque 22 séries não
cabem numa sessão dentro do PUOS. [ACSM 2009](https://pubmed.ncbi.nlm.nih.gov/19204579/)
recomenda 3-4 dias/semana para intermediários.

**Solução.** `aparicoes(grupo_grande) >= 2` como **restrição dura** na escolha do split, não
aviso. Split que viola é inválido. Ênfase = mais séries por semana **e/ou** mais aparições; nunca
menos aparições.

## A3 — ALTO. 4 dos 7 exercícios de peito são o mesmo padrão; 91% da sessão é empurrar

| Padrão | Exercícios | Séries |
|---|---|---|
| Empurrar horizontal | Supino máquina, Supino no smith, Supino reto com barra, Flexão | **13** |
| Empurrar inclinado | Supino inclinado máquina, Supino inclinado com barra | 6 |
| Abrir/fly (nominal) | Crossover na polia baixa | 3 |
| Mergulho / extensão de cotovelo c/ peso corporal | Mergulho entre bancos | 4 |
| Empurrar vertical | Desenvolvimento militar | 3 |
| Abdução horizontal / rotação externa | Face pull | 3 |

6 padrões nominais em 10 exercícios — **5 se o crossover for o que a demonstração mostra (A8)**.
**29 das 32 séries (91%) são empurrão com extensão de cotovelo.** Ausentes: extensão de cotovelo
isolada, abdução lateral, qualquer trabalho em posição alongada que não seja um supino.

**Causa.** `diversificar` roda **só na seleção inicial**. `exercicioParaAcrescentar` tenta cobrir
padrão faltante, mas o peito só tem 3 padrões em `padraoDe` e os três já estavam cobertos desde o
começo — então o `?? livres[0]` assume e o gerador desce uma lista de supinos.

**Evidência.** Direta e forte para "quantos padrões por sessão" não existe — dito explicitamente.
O que sustenta: (a) [Remmert 2025](https://sportrxiv.org/index.php/server/preprint/view/537) — o
orçamento por sessão é finito, séries redundantes o consomem; (b)
[Chaves et al. 2020](https://digitalcommons.wku.edu/ijes/vol13/iss6/12) — inclinado cresceu mais
que horizontal no 2º espaço intercostal, **mas só em 1 de 3 sítios, em destreinados, 1×/semana**;
evidência fraca, e é dita como fraca: justifica *incluir* um inclinado, não *quatro* horizontais.
"Variação sistemática ajuda, aleatória atrapalha" é **prática comum, sem citação** (Kassiano 2022
não abriu).

**Solução.** Teto por padrão: **máx. 2 exercícios e 8 séries por padrão por sessão**, verificado
no mesmo passo final do teto por sessão. Sem padrão faltante disponível, o gerador **não
acrescenta exercício** — devolve o tempo (B2).

## A4 — ALTO. A ordem está quebrada: compostos pesados nas posições 4 e 5, após isolador na 3

A auditoria de 29/07 validou "composto pesado abre, isolador fecha". A saída real: **Crossover em
3º**, **Supino no smith (pesado) em 4º**, **Supino reto com barra (pesado) em 5º**, Flexão em 6º,
Supino inclinado com barra em 7º.

**Causa.** `porPapel` só é aplicado ao bloco inicial (`gerador.ts:860`). O que `preencherTempo`
acrescenta entra via `posicaoPara` (`gerador.ts:1385-1391`), que insere **depois do último do
mesmo grupo**, na ordem de inserção, sem reordenar por papel. Ninguém roda `porPapel` no fim. A
auditoria anterior leu `porPapel` e concluiu que a regra estava viva — ela está viva na montagem
e morta no resultado.

**Impacto.** O supino reto com barra — único movimento livre da sessão e o mais comparável entre
semanas — é executado depois de 10 séries de empurrão. É onde ele vai progredir menos. E é
exatamente o exercício que a regra do projeto (`gerador.ts:819-828`, "o primeiro fica fixo na
semana inteira, é comparando a carga dele que se enxerga progresso") precisa que seja limpo.

**Evidência.** [Nunes et al. 2021](https://pubmed.ncbi.nlm.nih.gov/32077380/), 11 estudos: ganho
de força maior nos exercícios feitos **no início** (multiarticular primeiro: ES = 0,32;
monoarticular primeiro: ES = −0,58). Para **hipertrofia** a mesma meta não achou efeito de ordem —
então aqui é problema de **progressão mensurável e segurança**, não de crescimento. A distinção
muda a prioridade, por isso está dita.

**Solução.** Rodar a ordenação por papel **uma vez, no fim**, sobre a lista final de cada dia,
preservando o agrupamento por grupo muscular.

## A5 — ALTO. Descanso 150 s em tudo; zero 180 s no plano inteiro

9 dos 10 exercícios de força com 150 s, o décimo com 60 s. Nenhum 180 s, nenhum 90 s.

- **Crossover na polia baixa (abertura, monoarticular na intenção): 150 s.** O nome está em
  `COMPOSTOS` (`classificacao.ts:72`) → `descansoCorreto` cai em `ehComposto → 150`. Ao mesmo
  tempo `padraoDe` o classifica como `'abertura'` — **duas classificações internas discordam
  sobre o mesmo exercício na mesma sessão**.
- **Supino reto com barra (pesado): 150 s, não 180 s.** `ehPesado(nome) ? (repsAlvo <= 8 ? 180 :
  150)`. `repsDe` devolve `[8,12]` para pesado quando `experiencia === 'iniciante'` (e `[5,8]`
  caso contrário). Com iniciante, `rmax = 12 > 8` → **150 s**. O ramo dos 180 s é **inalcançável
  para qualquer perfil marcado como iniciante, no programa inteiro**.

**Evidência.** [Schoenfeld et al. 2016](https://pubmed.ncbi.nlm.nih.gov/26605807/), RCT n=21, 8
semanas: 3 min produziram mais força (1RM agachamento e supino) e mais hipertrofia (coxa
anterior; tríceps p = 0,06) que 1 min. RCT único com n=21 — evidência real, não robusta; a
meta-análise de intervalos não foi aberta, então não é citada.
[ACSM 2009](https://pubmed.ncbi.nlm.nih.gov/19204579/) recomenda 3-5 min nas cargas pesadas.

**Solução.** Inverter a chave: **o descanso sai do PAPEL, não das repetições.** Papel primeiro
(principal pesado → 180 s; principal/complementar → 150 s; isolador → 90 s); reps só desempatam
**dentro** do isolador (≥15 reps → 60 s). E tirar `Crossover na polia baixa` de `COMPOSTOS`.

## A6 — ALTO. Uma faixa só (8-12) e nenhum RIR: um campo do questionário apagou a zona pesada

9 de 10 exercícios com **8-12 reps**, do supino com barra ao mergulho. Nenhuma prescrição de
esforço (RIR). Nenhuma série de aproximação.

**Causa.** `repsDe` só produz `[5,8]` quando `experiencia !== 'iniciante'`. Marcado como
iniciante, o perfil perde a faixa 5-8 em **todos** os compostos pesados de **todos** os dias — e,
em cascata, perde os 180 s (A5). Leonardo saiu de 96,4 kg para 84,3 kg treinando e voltou após 2
meses parado: é **intermediário destreinado**, não iniciante. Uma resposta de questionário
reescreveu a prescrição inteira sem dizer.

**Evidência.** [Schoenfeld et al. 2017](https://pubmed.ncbi.nlm.nih.gov/28834797/), 21 estudos:
hipertrofia semelhante entre carga alta e baixa, mas **ganho de 1RM significativamente maior com
carga alta** — argumento para diferenciar por papel, não por experiência.
[Robinson et al. 2024](https://sportrxiv.org/index.php/server/preprint/view/295): hipertrofia
**aumenta** conforme as séries se aproximam da falha; **força é praticamente indiferente ao RIR**
(IC contendo o nulo em todos os modelos de força). Consequência prática e não intuitiva: no
exercício cuja função é força, treinar longe da falha custa pouco; no exercício cuja função é
hipertrofia, é a proximidade da falha que paga.

**Solução.** Reps e RIR derivados do **papel** (tabela em B5); a classificação de experiência
deixa de ser a chave de tudo. Adicionar 2 séries de aproximação no principal (40% e 65%) — o
schema já suporta (`set_logs.tipo = 'aquecimento'`) e o gerador nunca cria.

## A7 — ALTO. "Peito e tríceps" sem uma única extensão de cotovelo isolada

O tríceps recebeu **1 exercício, 4 séries: mergulho entre bancos** — peso corporal,
multiarticular, ombro em extensão. Zero monoarticular. Zero trabalho com a cabeça longa alongada.
O catálogo tem 6 isoladores de tríceps disponíveis.

**Causa.** (1) `focos=['peito']` deixa tríceps fora do bônus e ainda leva o desconto → alvo
semanal cai para 6; (2) com 2 aparições, `naSessao = 3` e `quantosExercicios(3) = 1`; (3)
`ordenar` põe composto antes de isolador, e `Mergulho entre bancos` está no topo da fila global
porque entrou como troca de força relativa (`gerador.ts:749-764` empurra as trocas para a frente
da lista inteira).

**Impacto.** Contagem fracionada do próprio app: **4 diretas + 11 indiretas = 15 fracionadas**,
acima do PUOS, com apenas 4 diretas e nenhuma na posição alongada. O músculo que dá nome ao dia é
o mais sobrecarregado por trabalho indireto e o menos endereçado por trabalho específico.

**Solução.** Grupo pequeno em dia que leva o nome dele recebe **piso de 2 exercícios**, sendo ao
menos 1 monoarticular na posição alongada. `quantosExercicios` não pode ser a única trava: com
5-6 séries, 2 exercícios de 3+2 rendem mais que 1 de 5.

## A8 — MÉDIO. "Crossover na polia baixa" tem três identidades conflitantes

Nome de crucifixo (crossover), demonstração de supino (`Cable_Chest_Press`, `exercicios.ts:421`),
instruções de junção das mãos à frente do peito, classificação de **composto**
(`classificacao.ts:72`) e padrão de **abertura**. Prescrição resultante: 8-12 reps, 150 s. E
existe no catálogo, ao lado, `Crossover na polia` (`exercicios.ts:62`) — **não** listado em
`COMPOSTOS`, logo isolador com 10-15 reps e 90 s.

**Impacto.** Dois exercícios de nome quase idêntico com prescrições opostas na mesma tela, e a
demonstração mostra movimento diferente do nome. Se o exercício é de fato um supino na polia, os
"3 padrões distintos de peito" viram 2 e A3 piora.

**Solução.** Decidir o que o exercício é (o `Cable_Chest_Press` do free-exercise-db é supino na
polia) e alinhar nome, imagem, classificação e padrão.

## A9 — MÉDIO. 17,5 séries fracionadas de ombro num dia que não é de ombro, com composição invertida

3 diretas (militar) + 3 diretas (face pull) + 11,5 indiretas = **17,5 fracionadas**. O deltoide
**anterior** recebe praticamente todas as indiretas mais as 3 do militar; o **medial** recebe
**zero**; o **posterior**, só as 3 do face pull.

**Causa.** O modelo do dia inclui `ombro`, e `ordenar` põe o `Desenvolvimento militar` (composto
pesado) em primeiro dentro do grupo — justamente o padrão **redundante** com as 19 séries de
supino anteriores.

**Solução.** Em dia de empurrar: **zero desenvolvimento pesado**; o ombro entra com 2 isoladores
não-anteriores (abdução lateral + abdução horizontal/rotação externa), 5-6 séries. Regra genérica
possível: quando o volume **indireto** de um grupo na sessão passa de 60% do alvo, o trabalho
direto fica restrito a padrões **não cobertos** pelo indireto.

## A10 — MÉDIO. O cardio contradiz a constante do próprio app em três eixos

Saída: **Esteira, 20 min, em todo dia de treino**. `CARDIO.porObjetivo.recomposicao`
(`periodizacao.ts:187`): **3 sessões, 30 minutos, "Zona 2 (bicicleta, elíptico ou caminhada
inclinada)"**. E `CARDIO.regras[1]`: "Bicicleta e elíptico interferem menos que corrida".

**Causa.** Modalidade — `gerador.ts:882` pega o **primeiro do catálogo**, que é a `Esteira`
(`exercicios.ts:269`); duração — `gerador.ts:886` faz `objetivo === 'emagrecimento' ? 30 : 20`;
frequência — anexado a **todo** dia gerado (achado 9 de 29/07, confirmado na saída).

**Impacto.** A esteira é a pior escolha **neste split**: a perna treina 1× por semana, então é
justamente a musculatura com menos oportunidade de adaptação que recebe o dano excêntrico
repetido. E os 20 min são invisíveis para `estimarDuracao` (`duracao.ts:73` filtra cardio) — o app
mostra 87 min e o usuário passa 107 na academia.

**Evidência.** [Lundberg et al. 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC9474354/), 15
estudos, n=300: efeito negativo pequeno do concorrente sobre hipertrofia de fibra, e
**especificamente** "efeito negativo observado para fibras tipo I quando o aeróbio foi feito
correndo, mas não pedalando". A mesma meta **não** achou diferença por ordem dentro da sessão, o
que valida a regra conservadora do app sem exigi-la.

## A11 — MENOR. O tempo que sobra vira série, e essa premissa produz tudo acima

`preencherTempo` trata folga de agenda como sinal de que falta volume. O problema que motivou a
regra é real ("quem dizia ter 1h30 recebia sessões de 44 minutos"), mas a correção escolhida é a
causa direta de A1, A3 e A4. **22 séries de peito não foram prescritas por critério fisiológico
nenhum — foram prescritas porque havia 90 minutos na agenda.** Tempo disponível é teto, não meta.

---

## Áreas checadas nesta rodada e validadas

- **Contagem fracionada (indireta = 0,5):** correta, e é o instrumento que revela A7 e A9.
  [Pelland](https://pubmed.ncbi.nlm.nih.gov/41343037/) destaca que a quantificação fracionada foi
  essencial para a acurácia do modelo. Validado.
- **`TETO_SERIES_SESSAO = 10` como NÚMERO:** quase exatamente onde a evidência põe o PUOS (≈11).
  Validado como constante, **reprovado como garantia** — ele é contornado.
- **Tabela 180/150/90/60:** os quatro valores são defensáveis. O defeito é a chave de entrada
  (reps em vez de papel). Tabela validada.
- **Cardio depois da musculação:** [Lundberg 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC9474354/)
  não achou diferença por ordem — a regra não custa nada e é conservadora na direção certa.
- **Face pull, 3×10-15, 60 s:** única linha da saída em que nome, classificação, faixa e descanso
  batem com a regra do projeto de ponta a ponta.
- **Composto pesado na posição 1 (Supino máquina):** correta. É da 3ª em diante que a ordem quebra.

**Não reexaminado nesta rodada** (não confundir com validado): streak com freeze (achado 7 de
29/07), substituição em sessão e contraindicações por dor (F5), motor de progressão e e1RM
(F3/F4, endereçados na fase 2), mobilidade.

---

# PARTE B — a prescrição-alvo

Premissas: 88 kg, ~27% de gordura, recomposição, retorno de 2 meses de pausa, academia completa,
4 dias × 90 min, ênfase em peito, preferência por máquina. **Classificação correta: intermediário
destreinado** — a carga caiu, o padrão motor e a tolerância técnica não.

## B1 — A estrutura da semana vem antes de qualquer conta de séries

**Restrição dura:** `aparicoes(grupo_grande) >= 2` por semana. Split que viola é inválido.

Para 4 dias com ênfase superior: **A** = Superior empurrar (ênfase peito) · **B** = Inferior ·
**C** = Superior puxar · **D** = Superior misto (2ª dose de peito + ombro + braços). Peito 2×,
costas 2×, ombro 2×, tríceps 2×, perna 1× — e **perna em 1× é o custo declarado da ênfase**, que
é o aviso que já existe e funciona.

Consequência aritmética que resolve metade da Parte A: com peito 2×, `alvo/aparicoes` = 14/2 = 7
séries por sessão, e o teto por sessão deixa de ser sequer alcançado.

## B2 — Quantos exercícios e quantas séries por grupo, com o critério

```
series_diretas(grupo, sessao) = clamp(
    ceil(alvo_semanal(grupo) / aparicoes(grupo)),
    piso = 4,                    // abaixo de 4 o grupo não paga a viagem no dia
    teto = teto_sessao(grupo)
)

teto_sessao(grupo) = 12 fracionadas para grupo grande
                     10 fracionadas para grupo pequeno

// fracionadas = diretas + 0,5 × (séries de todo exercício com o grupo como secundário)
// verificado como ÚLTIMA etapa do pipeline, depois de preencherTempo e consolidar

exercicios(grupo, sessao) = clamp(round(series_diretas / 3,5), 1, 4)
    // 3-4 séries por exercício; nunca exercício de 1-2 séries, nunca de 5+
```

**Critério do teto (não é número mágico):**
[Remmert 2025](https://sportrxiv.org/index.php/server/preprint/view/537) põe o PUOS em ≈11 séries
fracionadas por sessão. 12 é o PUOS mais margem de erro de medição. **Ressalva:** preprint, e os
autores dizem que faltam dados em volumes muito altos — o teto é "onde o benefício deixa de ser
detectável", não "onde começa o dano".

**Escada do tempo que sobra** — em ordem, e "mais uma série" nem aparece:
1. Séries de aproximação no principal (40% e 65% da carga alvo)
2. Descanso completo onde a regra pede 180 s
3. Cardio Zona 2 na dose da constante (30 min), nos 3 dias da semana
4. Mobilidade (as 6 rotinas que o app já tem)
5. Sobra declarada: "sobra de propósito — todo grupo já está no volume que a recuperação acompanha"

## B3 — Papéis e a regra que decide o papel

O papel **não** é lista nominal. É derivado de três atributos:

| Atributo | Valores |
|---|---|
| `articulacoes` | multi / mono |
| `demanda_estabilizacao` | alta (barra livre, em pé, peso corporal) / média (halter, smith, apoiado) / baixa (máquina, cabo) |
| `pico_de_tensao` | alongado / meio / encurtado |

| Papel | Condição | Quantidade |
|---|---|---|
| **Principal** | multi + estabilização média/alta + carga comparável semana a semana | **exatamente 1 por grupo por sessão** |
| **Complementar** | multi, em padrão **diferente** do principal | 0-2 — só entra se acrescenta padrão |
| **Isolador** | mono, escolhido para cobrir o `pico_de_tensao` que os compostos não cobrem | 0-2 |
| **Finalizador** | mono + estabilização baixa, última posição da sessão | **máximo 1 por sessão** |

Regra dura: **nunca dois principais no mesmo padrão**; complementar que não acrescenta padrão não
entra (correção direta de A3).

Justificativa do "principal": [Nunes 2021](https://pubmed.ncbi.nlm.nih.gov/32077380/) — se a
medida de progresso do bloco é a carga de um exercício, ele tem que ser o primeiro e sempre o
mesmo. Justificativa do "finalizador":
[Refalo 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC9935748/) recomenda que a falha, quando
usada, seja enviesada para "exercícios de baixa complexidade e baixa fadiga associada
(ex.: monoarticular vs multiarticular)".

## B4 — Padrões de movimento por sessão e o teto por padrão

Padrões reais num dia de empurrar: (1) empurrar horizontal, (2) empurrar inclinado 30-45°,
(3) abrir/adução horizontal isolada, (4) empurrar vertical/overhead, (5) abdução lateral,
(6) abdução horizontal/rotação externa, (7) extensão de cotovelo **acima da cabeça**,
(8) extensão de cotovelo neutra/polia.

**Alvo: 6 a 8 padrões distintos por sessão, em 7 a 9 exercícios.**
**Teto por padrão: máx. 2 exercícios E máx. 8 séries (grupo grande) / 6 (grupo pequeno).**

Evidência: nenhuma fonte aberta prescreve "N padrões por sessão" — **dito explicitamente**. O que
a evidência sustenta é a restrição de teto (orçamento por sessão finito → redundância tem custo de
oportunidade) e a inclusão de um inclinado
([Chaves 2020](https://digitalcommons.wku.edu/ijes/vol13/iss6/12), **evidência fraca**). O resto
da lista é **prática comum, sem citação**.

## B5 — Faixa de repetições e RIR por papel

| Papel | Reps | RIR — acúmulo | RIR — readaptação (sem. 1-3) |
|---|---|---|---|
| Principal, estabilização alta (barra livre) | **5-8** | 2-3 | **3-4** |
| Principal, estabilização média/baixa (máquina, smith) | **6-10** | 1-2 | 3 |
| Complementar | **8-12** | 1-2 | 2-3 |
| Isolador | **10-15** | 0-2 | 2 |
| Finalizador | **12-20** | 0-1 ou falha | **não usar** |

**Por que por papel e não por experiência.**
[Schoenfeld 2017](https://pubmed.ncbi.nlm.nih.gov/28834797/): hipertrofia semelhante numa faixa
larga de cargas, mas 1RM sobe mais com carga alta — logo carga alta é o que o **principal** existe
para entregar, e o **isolador** pode ser leve sem custo de hipertrofia.
**Por que o RIR também é por papel.**
[Robinson 2024](https://sportrxiv.org/index.php/server/preprint/view/295): hipertrofia melhora
perto da falha; força é indiferente ao RIR. Manter RIR 2-3 no principal custa quase nada em força
e economiza fadiga; apertar o RIR no isolador é onde o ganho de tamanho está.
[Refalo 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC9935748/): falha momentânea **não** é
superior à não-falha. **Evidência dividida** sobre o ponto ideal exato — por isso as faixas acima
são faixas, não pontos.

## B6 — Descanso por papel

| Papel | Descanso |
|---|---|
| Principal, estabilização alta, ≤8 reps | **180 s** |
| Principal, estabilização média/baixa, 9-12 reps | **150 s** |
| Complementar | **120-150 s** |
| Isolador | **90 s** |
| Finalizador / série ≥15 reps | **60 s** |

Chave: **papel primeiro; reps só desempatam dentro do isolador.** É a inversão de
`descansoCorreto`, que hoje consulta reps antes e por isso apaga o ramo dos 180 s inteiro (A5).

## B7 — Técnicas de intensidade: onde sim, onde não

**Regras duras, nesta ordem:**
1. Só em **isolador** ou **finalizador**. Nunca em principal ou complementar.
2. Só na **última série** do exercício.
3. Máximo **2 aplicações por sessão**.
4. **Zero técnicas durante a readaptação** (semanas 1-3) e durante o deload.

| Técnica | Onde faz sentido | Onde NÃO | Evidência aberta |
|---|---|---|---|
| Falha momentânea | Isolador/finalizador mono | Composto pesado, principal | [Refalo 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC9935748/): falha **não** é superior; se usar, enviesar para baixa complexidade. A evidência é contra o uso indiscriminado, não a favor |
| Drop set | Finalizador, e **quando falta tempo** | Composto pesado; como "estímulo extra" | [Sødal 2023](https://pubmed.ncbi.nlm.nih.gov/37523092/): **sem diferença** vs tradicional (p = 0,392), mas metade a um terço do tempo. O ganho é tempo, não hipertrofia |
| Rest-pause | Finalizador, sob restrição de tempo | Principal | **Sem evidência verificada; prática comum** |
| Myo-reps | — | — | **Nenhuma fonte aberta. Não prescrever como se tivesse evidência** |
| Pré-exaustão | **Em lugar nenhum deste dia** | Antes de qualquer multiarticular | [Krzysztofik 2019](https://pmc.ncbi.nlm.nih.gov/articles/PMC6950543/): reduz o volume total no multiarticular seguinte, **sem vantagem de hipertrofia**. Contraindicação explícita |
| Negativa lenta / tempo excêntrico | É **cadência**, não técnica de intensidade | Como substituto de carga | [Krzysztofik 2019](https://pmc.ncbi.nlm.nih.gov/articles/PMC6950543/): 0,5 a 8 s produzem hipertrofia semelhante; ~2 s é o mais eficiente em tempo |
| Excêntrico acentuado (AEL) | Só com parceiro ou weight releaser | Sozinho; retorno de pausa | Hipertrofia **igual** à carga alta tradicional com volume equalizado; custa tempo de recarga |
| Isometria, parciais | — | — | **Prática comum, sem citação** |
| BFR | Membros, 20-30% 1RM | Tronco (não funciona) | Hipertrofia comparável à carga alta em membros; exige conhecer a pressão de oclusão (40-80% AOP) |

**Por que zero técnicas na readaptação.**
[Docking & Cook 2019](https://pmc.ncbi.nlm.nih.gov/articles/PMC6737558/): o turnover de colágeno
em tendão maduro é da ordem de **0,25% ao ano**; o tecido responde a um limiar de tração e não
acompanha a velocidade de adaptação do músculo. No retorno de pausa a carga sobe rápido
(recuperação neural), e é aí que a defasagem músculo-tendão fica maior.
**Sobre "memória muscular a favor":** a
[revisão de 2025](https://www.frontiersin.org/journals/nutrition/articles/10.3389/fnut.2025.1701520/full)
diz que a resposta aumentada no retreino era esperada pela teoria da permanência de mionúcleos mas
**"esses achados não se traduziram"** com clareza em humanos, e que há conflito sobre a permanência
dos mionúcleos. **Evidência dividida** — planejar o retorno contando com memória muscular é apostar
em algo não estabelecido. A assimetria músculo-tendão, essa não é.

## B8 — Variar o estímulo entre ciclos sem perder comparabilidade

- **Nível 0 — âncora. Não muda dentro do bloco (6-8 semanas).** O **principal** de cada grupo,
  na **posição 1**, com o **mesmo nome** e a **mesma faixa de reps** o bloco inteiro. É a única
  série cuja carga alimenta o gráfico e o e1RM. Preserva integralmente `gerador.ts:819-828`.
- **Nível 1 — muda entre blocos.** No bloco novo o principal pode trocar **dentro do mesmo
  padrão**. Quando isso acontece o app **quebra a série do gráfico explicitamente**: nova âncora,
  nova linha de base, duas curvas separadas. Fingir continuidade entre exercícios diferentes é
  pior que admitir a quebra.
- **Nível 2 — muda entre sessões dentro do bloco.** Só complementares e isoladores, rodízio
  **dentro do mesmo padrão**, nunca criando nem eliminando um padrão da sessão. É o `rodar()` que
  já existe, com uma restrição a mais: rodar por padrão, não pela lista.

A comparabilidade mora inteira no nível 0; a variedade mora nos níveis 1 e 2, que não entram no
gráfico. Os dois objetivos deixam de competir.

## B9 — "Peito e tríceps" deve levar ombro? Sim, mas só o que o supino não treina

**Resposta: sim, e o volume certo é 2 exercícios / 5-6 séries, nenhuma de deltoide anterior.**

- Saída atual: deltoide = 6 diretas + 11,5 indiretas = **17,5 fracionadas**, anterior levando
  quase tudo, medial em **zero**.
- Alvo: com 10 séries de peito em vez de 22, o indireto cai para ~5. Somando 6 diretas de
  medial/posterior = **11 fracionadas**, no PUOS e com a composição invertida no sentido certo.

**Regra:** em dia de empurrar, **zero desenvolvimento pesado** — o overhead é redundante com o
inclinado (mesmo deltoide anterior, mesmo tríceps, mesmo padrão de extensão de cotovelo) e, na
posição 9, é composto pesado com o músculo exausto. O desenvolvimento vai para o dia D, onde é o
**principal** e é feito descansado.

## B10 — O dia A reescrito

| # | Exercício | Papel | Padrão | Séries | Reps | RIR | Descanso |
|---|---|---|---|---|---|---|---|
| 0 | Aproximação no #1 | aquecimento | — | 2 (40% e 65%) | 8 e 5 | — | 60-90 s |
| 1 | **Supino reto com barra** — **âncora do bloco** | principal | empurrar horizontal | 4 | 5-8 | 2-3 (3-4 nas sem. 1-3) | **180 s** |
| 2 | Supino inclinado com halteres 30-45° | complementar | empurrar inclinado | 3 | 8-12 | 1-2 | 150 s |
| 3 | Crossover na polia (ou voador) | isolador | abrir / alongado | 3 | 10-15 | 0-2 | 90 s |
| 4 | Elevação lateral com halteres | isolador | abdução lateral | 3 | 12-15 | 0-1 | 75 s |
| 5 | Face pull na polia | isolador | abdução horizontal / rot. externa | 3 | 12-20 | 1-2 | 60 s |
| 6 | Tríceps testa (ou francês) | isolador | extensão de cotovelo **alongada** | 3 | 8-12 | 1-2 | 90 s |
| 7 | Tríceps na polia com corda | finalizador | extensão de cotovelo neutra | 2 | 12-15 | 0-1 (drop set só fora da readaptação) | 60 s |
| — | Cardio | — | — | só em 3 dos 4 dias, 30 min Zona 2, bicicleta ou elíptico | | | |

Se a preferência por máquina for respeitada na âncora, `#1` vira **Supino máquina** com 6-10 reps
e 150 s — e o supino com barra sai do dia. É escolha legítima do usuário; o que não pode é os dois
estarem na mesma sessão, como está hoje.

**Contas de verificação:**

- Peito: **10 diretas**, 3 padrões, **1 exercício por padrão**. Fracionado = 10, dentro do teto de 12.
- Tríceps: **5 diretas** + ~3,5 fracionadas dos supinos = **8,5**, dentro do teto de 10, agora com
  um exercício alongado e outro neutro.
- Ombro: **6 diretas**, nenhuma anterior, + ~5 fracionadas = **11**, no PUOS com a composição certa.
- Padrões distintos: **7** em 7 exercícios.
- Duração por `estimarDuracao`: ~717 s de execução + ~1.530 s de descanso + 870 s de transição ≈
  **52 minutos**, contra 87 da saída atual. Sobram ~38 min de 90, consumidos pela escada do B2.

**Comparação direta:** 32 → 20 séries de força; 29 → 10 séries de empurrão; 6 → 7 padrões; 4 → 1
exercício no padrão mais concorrido; 0 → 1 exercício a 180 s; 0 → 2 isoladores de tríceps; 0 → 1
abdução lateral; 87 → 52 min. **O único número que sobe é a quantidade de padrões cobertos.**

## B11 — Readaptação e deload aplicados sobre esta estrutura

**Semanas 1-3 de volta:** mesma estrutura, mesmos exercícios, mesmos padrões. Muda: **−1 série por
exercício** (não −50% linear) e **RIR +1 a +2**. Zero técnicas de intensidade. Carga do principal
em rampa 67% → 80% → 90% da pré-pausa.

Por que não cortar 50% linear: o que precisa ser reduzido no retorno é a **proximidade da falha e
a carga absoluta**, não a cobertura de padrões — cortar séries pela metade tira justamente os
isoladores do fim, que são os de menor demanda articular. Cortar 1 de cada mantém a estrutura que
o usuário está aprendendo e reduz a mesma fadiga.

---

## Prioridade sugerida

1. **A2** (peito 1×/semana com ênfase em peito) — causa-raiz de A1, destrava o resto sozinho.
2. **A1 + A11** (teto por sessão no fim do pipeline; folga deixa de virar série).
3. **A5 + A6** (descanso e reps derivados do papel — desbloqueia 180 s e a faixa 5-8 no programa inteiro).
4. **A4** (`porPapel` no fim do pipeline) e **A3** (teto por padrão).
5. **A7 + A9** (piso de isolador em grupo pequeno; ombro não-anterior no dia de empurrar).
6. **A10 + A8** (modalidade e dose de cardio pela constante; desambiguar os dois crossovers).

**Arquivos que produzem os achados** (nenhum editado):
`src/features/treino/gerador.ts` (235-258 `SPLITS_FOCO`, 586-592 `repsDe`, 774-791 aviso de
frequência, 809 e 846-876 montagem, 881-897 cardio, 1249-1296 `preencherTempo`, 1335-1391
`exercicioParaAcrescentar`/`posicaoPara`) · `classificacao.ts` (72 `Crossover na polia baixa` em
`COMPOSTOS`, 118-123 `descansoCorreto`, 282-355 `padraoDe`/`diversificar`) · `duracao.ts` (73:
cardio fora da estimativa) · `periodizacao.ts` (179-191 `CARDIO`) · `db/seed/exercicios.ts`
(62, 269, 421).
