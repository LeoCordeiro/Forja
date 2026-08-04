# Auditoria da SEMANA do Leonardo — 04/08/2026

> fitness-scientist · rodado contra `6be5a8d` com o **perfil real dele**, não sintético.
> Nenhum arquivo de código editado. Relatório integral no transcript da sessão.

## Como foi verificado

`npm run testar:gerador` **passou** — com o terra ancorando as costas, um agachamento
sem peso para 88 kg em academia completa e uma remada alta de barra a 5-8 como
principal de ombro. A suíte mede invariantes, não prescrição.

O que valeu: script próprio entrando por `montarPlano` com o catálogo do seed e o
perfil dele (4 dias, 90 min, recomposição, academia, **preferência máquina**, **dor no
joelho**, **1 barra fixa**), imprimindo grupo, padrão, papel, séries, reps, RIR,
descanso, cadência, equipamento e secundários. **8 variantes de perfil, 32 dias.**

## A tese

**As regras do gerador estão em grande parte certas; os dados sobre os quais elas
operam estão errados.** Os seis achados estruturais de 30/07 se sustentam na semana
real (todos confirmados como corrigidos). O que sobrou mora uma camada abaixo:
`grupo_primario`, `grupos_secundarios`, `padraoDe` e `PICO_POR_PADRAO`.

**O terra não é exceção — é o caso mais visível de um catálogo que atribuiu grupo por
associação.** E a causa-raiz é estrutural: **não existe grupo para os eretores da
espinha**. Seis exercícios os carregam (terra, hiperextensão lombar, hiperextensão
inversa, stiff, RDL, bom dia) e não há balde — dois foram parar em `costas`, um em
`posterior`, três aparecem como secundário `costas`.

---

## PARTE A — atribuição de grupo no catálogo (122 exercícios)

### A.1 — `grupo_primario` errado

| Exercício | Hoje | Deveria ser | Motivo mecânico |
|---|---|---|---|
| **Levantamento terra** | `costas` | `posterior`/`gluteo`; costas e trapézio como **secundários isométricos** | Motores: extensores de quadril e joelho. Eretores resistem isometricamente. **Dorsal e trapézio seguram a barra e não encurtam em ponto nenhum.** |
| **Cadeira adutora** | `quadriceps`, sec. `gluteo` | adutores; **remover `gluteo`** | Zero extensão de joelho. E glúteo médio/mínimo são **abdutores — antagonistas**, listados como sinergistas. |
| **Hiperextensão lombar** | `costas` | `posterior` | Motores: glúteo e isquiotibiais; eretores seguram. **`Hiperextensão inversa`, quase o mesmo movimento, já está em `posterior`.** |
| **Subida no banco** = `gluteo` vs **Subida no banco com halteres** = `quadriceps` | — | um dos dois | Segurar peso não troca o motor primário. |
| **Elevação pélvica com barra** vs **Hip thrust com barra** | ambos `gluteo`, padrão `ponte` | um só | As instruções da primeira **descrevem um hip thrust**. Duas linhas idênticas na tela. |

### A.2 — `grupos_secundarios` errados

| Exercício | Problema |
|---|---|
| Agachamento livre, **Leg press**, agachamentos | `posterior` como secundário. O isquiotibial é **biarticular**: encurta no quadril e alonga no joelho — fica quase isométrico. Co-contrator, não sinergista. |
| **Remada curvada / unilateral / baixa / máquina** | **Nenhuma lista `trapezio` nem `ombro`.** Remada é o principal exercício de trapézio médio, romboides e deltoide posterior. Efeito: o trapézio dele termina a semana com **0 séries diretas e 8 fracionadas — todas vindas do terra**. |
| Desenvolvimentos | Nenhum lista `trapezio`, que faz a rotação superior da escápula em todo overhead. |
| Hip thrust | `quadriceps` como secundário — ângulo de joelho fixo. |
| Encolhimento | `ombro` como secundário — o deltoide não eleva escápula. Falta `antebraco`. |
| Escalador | `cardio` como grupo secundário — **cardio não é músculo**. |

### A.3 — Dois grupos que faltam no vocabulário

**Eretores da espinha** (6 exercícios, nenhum balde — causa-raiz do terra) e
**adutores** (1 exercício, estacionado em `quadriceps`).

### A.4 — Nomes que a biomecânica desmente

- **`Remada alta na máquina`** — slug `Leverage_High_Row`, instruções de puxada em
  diagonal com peito apoiado: é uma **high row**, exercício de costas. A classificação
  está certa, **o nome está errado**. Em PT-BR "remada alta" é *upright row* — e existe
  outra entrada `Remada alta` em `ombro`. Dois nomes quase iguais, movimentos sem relação.
- **`Agachamento livre sem peso`** — "livre" em PT-BR significa barra livre. É
  `Bodyweight_Squat`. E existe `Agachamento livre` (com barra).

### A.5 — `PICO_POR_PADRAO`: quatro rótulos invertidos

| Chave | Hoje | Realidade |
|---|---|---|
| `panturrilha:joelho_fletido` (sentado) | **`alongado`** | **Invertido.** Joelho fletido **encurta** o gastrocnêmio. |
| `panturrilha:joelho_estendido` (em pé) | ausente → `meio` | É a posição **alongada**. |
| `biceps:alongada` | preenchida por `Rosca na polia alta` | A regex mirava a **rosca inclinada**, que o catálogo não tem. Sobrou o exercício com o ombro **flexionado** — cabeça longa **encurtada**. O slot "alongado" está preenchido pelo menos alongado do catálogo. |
| `biceps:apoiada` → `encurtado` | cobre `Rosca scott` **e** `Rosca concentrada` | São opostos: no scott o cotovelo chega à extensão máxima sob carga; na concentrada o pico é no encurtamento. |

`costas:lombar` também conta como padrão de costas — o dia dele **parece** ter 4
padrões cobertos e tem 3.

---

## PARTE B — a semana dele

Em **todos os 4 focos possíveis** o terra é o principal/âncora de costas e aparece
**2× por semana** — inclusive quando o foco marcado é `costas`.

| Métrica | Valor |
|---|---|
| Volume direto | peito 21, costas 21, ombro 13, quadríceps 12, tríceps 11, bíceps 10, panturrilha 8, posterior 6, glúteo 6, trapézio 4 |
| **Costas descontando o terra** | **15** — e destas, **3 são remada** |
| **Empurrar horizontal/inclinado : remar** | **14 : 3** |
| Padrões nunca cobertos | **empurrar vertical (0)**, rosca alongada de verdade (0) |
| Duração | A 62, B 80, C 60, **D 91** de 90 min |
| Cardio | bicicleta, 30 min, 3 sessões — **bate exatamente com a constante** ✓ |

### Achados, por severidade

**B1 — CRÍTICO. O terra é âncora de costas em 100% dos perfis, 29% do volume de costas.**
16 aparições em 8 semanas, sempre principal, 180 s, com aproximações. **O e1RM que o app
mostra como "progresso de costas" é um e1RM de levantamento terra.** Uma linha de dado
errada percorre cinco regras certas. O card admite na tela: *"força, não largura"* — e
mantém como âncora.
Evidência aberta: [revisão de 19 estudos de EMG do terra](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0229507)
— mediu bíceps femoral, glúteo, vasto lateral, eretores, semitendinoso, reto femoral,
oblíquo e gastrocnêmio. **Latíssimo e trapézio não foram analisados em nenhum dos 19.**

**B2 — CRÍTICO. `Agachamento livre sem peso`, 4×8-15, RIR 0-2, para 88 kg em academia
completa.** O bloqueio de joelho dispara em `grupo === quadriceps && padrao ===
agachamento && ajustavel` — remove **todo** agachamento com carga (incluindo smith e
goblet) e a isenção de peso corporal deixa passar exatamente o inútil. 88 kg agachando
sem peso não chega a RIR 0-2 em 15 reps, e o app cobra 120 s de descanso depois. O
próprio arquivo já sabe que o critério certo é **controle de amplitude**, não presença
de carga — é por isso que o leg press fica.
[Revisão de 79 estudos sobre extensores do joelho na dor femoropatelar](https://pmc.ncbi.nlm.nih.gov/articles/PMC12377044/):
evidência **incerta**; não sustenta proibir carga, sustenta controlar amplitude.

**B3 — ALTO. A panturrilha sentada é vendida como alongada; é a encurtada.** E a
variação melhor (em pé) sai como **finalizador**, por último, 60 s.
[Kinoshita 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10753835/), n=14, 12 semanas,
intra-sujeito: gastrocnêmio lateral **+12,4% em pé vs +1,7% sentado** (p=0,001); medial
+9,2% vs +0,6%; sóleo sem diferença. *Ressalva: n=14, destreinados, estudo único.*
E ele faz **16 séries semanais de panturrilha** — mais que costas (14), ombro (11) ou
tríceps (7).

**B4 — ALTO. A "rosca alongada" e a "encurtada" estão trocadas, e o card se contradiz.**
O texto diz *"braço atrás do tronco, com o bíceps alongado"*; as instruções do mesmo
card dizem *"braços abertos na horizontal"*.

**B5 — ALTO. `Remada alta` de barra, 2×5-8, 180 s, como principal de ombro** — para
quem prefere máquina. E **zero desenvolvimento em toda a semana** (0 ocorrências em 8
semanas). 2 séries de trabalho com 180 s = 12 min de sessão para 2 séries.
Evidência sobre o risco da remada alta: **dividida, sem citação aberta nesta sessão.**

**B6 — ALTO. Ele pediu máquina e as máquinas nunca aparecem.** Em 32 dias gerados,
**nunca apareceram**: `Voador (peck deck)`, `Remada máquina`, **`Puxada frontal na
polia`**, `Puxada supinada`, `Desenvolvimento máquina`, `Desenvolvimento na polia`,
`Supino na polia`, `Tríceps na polia com barra`, `Rosca scott na polia`, `Cadeira
flexora`, `Panturrilha no leg press`.
Três causas: (1) a ponte de força relativa é **ordenada à frente do catálogo inteiro**
(`gerador.ts:1248`), então graviton e barra negativa ocupam as duas vagas de vertical e
a puxada na polia nunca é alcançada; (2) `ordenar` trata `cabo` e `maquina` como empate;
(3) `variarEntreSessoes` não consulta a preferência — é por isso que o dia D é o "dia de
peso livre" de quem pediu máquina.
**A ponte assistida tem carga menos dosável que a puxada na polia** — a justificativa do
aviso é falsa no comparativo.

**B7 — ALTO. 14 séries de empurrar horizontal contra 3 de remar.** Consequência de B1 +
`lombar` contando como cobertura de costas. O volume total de costas (21) parece igual
ao de peito (21), então nenhum aviso dispara — o número está certo e o conteúdo não.

**B8 — MÉDIO. Com dor no joelho, todo o trabalho de isquiotibial vira flexão de
joelho** — inclusive o principal (`Glute ham raise`, o excêntrico mais agressivo do
catálogo, para quem voltou de 2 meses parado). Está invertido: dor no joelho deveria
empurrar **para** a dobradiça de quadril.

**B9 — MÉDIO. O aviso diz a ele para não treinar mais o que ele quase não treina.**
"tríceps, ombro, posterior, glúteo — o total semanal passa do alvo" — usando a contagem
fracionada inflada por A.2. Tríceps termina com 7 diretas contra 13 de bíceps.

**B10 — MÉDIO. `Prancha 4 × 0-0 · 60s` na tela.** `repsMin: porTempo ? 0 : reps[0]`, e o
render só tem caso especial para cardio. Quatro séries de zero segundo.

**B11 — MENOR.** `Tríceps coice` e `Rosca concentrada` num plano de academia completa,
escolhidos para preencher cobertura de padrão enquanto `Tríceps na polia com barra` e
`Tríceps na máquina` ficam sem uso.

---

## PARTE C — ordem em que ele veria

1. Terra no dia de costas *(já achado por ele)*
2. Puxada assistida no graviton em vez de puxada na polia *(já achado por ele)*
3. Agachamento sem peso, RIR 0-2, para 88 kg em academia completa
4. Um dia de costas com 3 séries de remada — e o dia D sem nenhuma
5. Remada alta de barra como principal de ombro; nenhum desenvolvimento na semana
6. Panturrilha (16) treinada mais que costas (14), ombro (11), tríceps (7)
7. Bíceps 13 contra tríceps 7 — o tríceps é ~2/3 do braço
8. `Prancha 4 × 0-0`
9. Dia D com 6 de 12 exercícios em barra/halter
10. `Rosca na polia alta` contradizendo as próprias instruções
11. O aviso que o desencoraja a treinar os quatro grupos mais magros da semana dele

E um que apareceria semanas depois: o aviso promete que aos 6 barras limpas ela volta
como primeiro exercício do dia de costas. Com 10 barras, a barra fixa volta — **mas o
primeiro exercício continua sendo o terra**. Promessa meio cumprida.

---

## O que foi checado e está CERTO

Todos verificados na **saída**, não por leitura de código.

- **Os 6 achados estruturais de 30/07 estão corrigidos na semana real:** teto por sessão
  (máx. 12,0 fracionadas, no limite exato), teto por padrão (máx. 4 séries e 2
  exercícios), ordem por papel (âncora abre o bloco nos 16 dias gerados), **180 s
  existem**, **faixa 5-8 existe**, frequência 2× em todo grupo grande exceto perna
  (custo declarado e avisado), **cardio batendo exatamente com a constante**.
- **Peito no dia A: 12 séries, 3 padrões, 1 exercício por padrão.** É a prescrição-alvo
  B10 entregue — o dia que a auditoria de 30/07 reprovou com 22 séries e 4 supinos.
- **Séries de aproximação** em todo principal, confirmado no objeto gerado.
- **`padraoDe` da panturrilha separa sóleo de gastrocnêmio** — a distinção é fina e
  certa; só o rótulo de pico está invertido. Quem escreveu sabia o que fazia.
- **`posterior:joelho_sentado` = alongado** — certo e sutil (quadril flexionado alonga o
  isquiotibial na cadeira flexora).
- **Contraindicação por carga mecânica** — a arquitetura está certa; o defeito de B2 é o
  valor de **um** atributo, não o desenho.
- **Epley limitado a ≤10 reps** — uso correto.
- **Fases e retorno pós-pausa** — precedência do plano de retorno, RIR 3-4, corte de
  1 série com piso de 2. *Não simulei uma semana 1 na tela: declarado como não
  reexaminado.*
- **Cadência derivada**, 4-0-1 nos excêntricos puros com RIR nulo (não é aferível em
  excêntrico assistido).

**Não reexaminado:** streak, substituição em sessão, mobilidade, progressão entre
semanas, tela de sessão.

---

## Prioridade

| # | Achado | Por quê |
|---|---|---|
| 1 | **B1** — terra → `posterior`; `lombar` sai da cobertura de costas | Reprovado por ele. Destrava B7 sozinho. 1 linha de dado. |
| 2 | **B2** — bloqueio de joelho por **amplitude**, não por carga | Entrega prescrição impossível hoje. |
| 3 | **B6** — ponte não passa na frente de alternativa ajustável; preferência no rodízio | Ele pediu máquina e recebe graviton, halter e barra. |
| 4 | **B3 + B4** — inverter os picos de panturrilha e bíceps | Card se contradiz na mesma dobra. |
| 5 | **B5** — remada alta não pode ser principal; devolver desenvolvimento em máquina | |
| 6 | **A.2 + B9** — secundários (remadas sem trapézio, agachamentos com posterior) | Sem isso o aviso continua desencorajando o que falta. |
| 7 | **B10** — `0-0` na prancha | Trivial e visível. |
| 8 | **A.1/A.3/A.4** — resto do catálogo | Não aparece na semana dele hoje, volta em outro perfil. |
