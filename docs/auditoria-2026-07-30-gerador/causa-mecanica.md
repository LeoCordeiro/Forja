# Por que o gerador produziu 7 exercícios de peito — causa mecânica

> 30/07/2026 · a partir do treino real no celular do Leonardo (dia "A — Peito e
> tríceps", 11 itens). Complementa `prescricao-alvo.md` (o que DEVIA sair).

## A saída

| # | Exercício | Grupo | Séries | Reps | Descanso | Padrão (`padraoDe`) |
|---|-----------|-------|--------|------|----------|---------------------|
| 1 | Supino máquina | peito | 4 | 8-12 | 150s | reto |
| 2 | Supino inclinado máquina | peito | 3 | 8-12 | 150s | inclinado |
| 3 | Crossover na polia baixa | peito | 3 | 8-12 | 150s | abertura |
| 4 | Supino máquina no smith | peito | 3 | 8-12 | 150s | **reto** |
| 5 | Supino reto com barra | peito | 3 | 8-12 | 150s | **reto** |
| 6 | Flexão de braço | peito | 3 | 8-12 | 150s | **reto** |
| 7 | Supino inclinado com barra | peito | 3 | 8-12 | 150s | **inclinado** |
| 8 | Mergulho entre bancos | tríceps | 4 | 8-12 | 150s | composto |
| 9 | Desenvolvimento militar | ombro | 3 | 8-12 | 150s | desenvolvimento |
| 10 | Face pull | ombro | 3 | 10-15 | 60s | posterior |
| 11 | Esteira | cardio | 1 | 1200-1200 | 0s | — |

**22 séries de peito numa sessão. 4 delas no padrão `reto`, 2 no `inclinado`.**
O dia se chama "peito e tríceps" e tem 1 exercício de tríceps contra 7 de peito.

## Causa 0 — a raiz: peito aparece 1× na semana (achado A2 do `prescricao-alvo.md`)

Escrito depois, quando a auditoria da saída achou o degrau acima de tudo que
está neste arquivo. Com `focos=['peito']` e 4 dias, `SPLITS_FOCO.superior[4]` dá
**peito 1× e costas 1× por semana** — e `ceil(alvo_semanal / aparicoes)` com
`aparicoes = 1` derrama o orçamento da semana inteira numa sessão só.

O comentário em `gerador.ts:176-178` garante que "nenhuma delas deixa um grupo
grande com menos de 2 aparições na semana" — mas fala da tabela `SPLITS`, e
`SPLITS_FOCO` é outra tabela, que não herda o critério. E o aviso de frequência
(`gerador.ts:774-791`) só examina a região **preterida**: com foco superior ele
olha perna, avisa sobre perna, e nunca percebe que o grupo **enfatizado** caiu
para 1×.

Ou seja: quem pediu ênfase em peito recebeu a pior frequência disponível para
peito, em silêncio. As causas 1-5 abaixo continuam válidas e continuam
precisando de correção — mas sem corrigir esta, elas se reapresentam.

## Causa 1 — o fallback que anula a diversificação (`gerador.ts:1361`)

```ts
const cand = livres.find((e) => !padroesNoDia.has(padraoDe(e.nome, g))) ?? livres[0];
```

`preencherTempo` chama isto em laço (até 40 voltas por dia) para ocupar o tempo
livre da sessão. A busca por padrão ausente está correta — mas quando todos os
padrões do grupo já estão no dia, `find` devolve `undefined` e o `?? livres[0]`
pega **qualquer** exercício do grupo. A partir daí cada volta do laço adiciona
mais um exercício do mesmo padrão.

O comentário acima da linha descreve o caso de costas que motivou a regra
("quarta puxada vertical em vez da remada que faltava"). A regra resolve o
primeiro caso e o fallback reabre o segundo.

## Causa 2 — só 3 padrões de peito (`classificacao.ts:289-293`)

```ts
if (grupo === 'peito') {
  if (/crucifixo|voador|crossover/.test(n)) return 'abertura';
  if (/inclinad/.test(n)) return 'inclinado';
  return 'reto';
}
```

`reto` é o balde do resto: supino máquina, supino no smith, supino reto com
barra e flexão de braço são **o mesmo padrão** para o algoritmo. Com 3 padrões
possíveis, qualquer sessão que precise de mais de 3 exercícios de peito repete
padrão por construção — e não existe teto de exercícios POR padrão em lugar
nenhum.

Falta também a distinção de **perfil de resistência / posição de alongamento**
(barra vs. halter vs. cabo vs. máquina mudam onde o músculo recebe mais carga),
que é o que justificaria de fato ter dois exercícios do mesmo padrão.

## Causa 3 — o teto por sessão não vale no preenchimento

`TETO_SERIES_SESSAO = 10` (`gerador.ts:149`) é aplicado só na montagem inicial
(linhas 809 e 1230). `preencherTempo` valida contra `tetoDe(grupo)`, que é o
alvo **semanal**. Grupo com ênfase e frequência 1×/semana → todo o alvo semanal
pode cair numa sessão só. Foi o que aconteceu: 22 séries num teto de sessão que
diz 10.

## Causa 4 — a faixa 8-12 mata o tier de 180s

```ts
if (ehPesado(nome)) return repsAlvo <= 8 ? 180 : 150;
```

`descansoCorreto` recebe `repsAlvo = rmax`. Como `repsDe` devolve 8-12 para
quase tudo, `rmax = 12 > 8` e **todo composto pesado cai em 150s** — o tier de
180s está morto na prática para este perfil. Por isso "Supino reto com barra"
aparece com o mesmo descanso de um acessório.

Efeito colateral do mesmo achatamento: o crossover (uniarticular) aparece com
150s, ou seja, está classificado como composto — se confirma, é erro de lista
em `COMPOSTOS`.

## Causa 5 — reps indiferenciadas

A sessão inteira é 8-12, exceto face pull (10-15). Não há faixa por papel
(principal pesado 5-8, complementar 8-12, isolador 12-15+), o que torna
impossível diferenciar intensidade — e alimenta a causa 4.

## Correções que decorrem daqui

1. Remover o `?? livres[0]`: sem padrão novo disponível, **parar de acrescentar
   exercício** — a sobra vira série no que já existe (o laço já sabe fazer isso)
   ou tempo livre declarado.
2. Teto explícito de exercícios por padrão por sessão (1, com exceção
   justificada por perfil de resistência distinto) e teto de exercícios por
   grupo por sessão.
3. Aplicar `TETO_SERIES_SESSAO` também em `preencherTempo`.
4. Ampliar `padraoDe` de peito e revisar os demais grupos; separar padrão de
   movimento de perfil de resistência.
5. Faixa de reps e descanso derivados do **papel** do exercício, não de um
   default por grupo — e `descansoCorreto` usando o piso da faixa (`rmin`) ou o
   papel, não o topo.
6. Verificar `COMPOSTOS` para uniarticulares (crossover e afins).
7. Cardio: `1 × 1200-1200` é o segundo em `reps` vazando na tela — exibir como
   duração.

## O teste do gerador passa — e é por isso que isso chegou ao celular

`npm run testar:gerador` devolve "Tudo passou" com o código que gerou o treino
acima. Rodado em 31/07 para confirmar. Os dois testes que deveriam ter pego têm
o escopo errado por um degrau:

| Teste atual | Por que não pega |
|---|---|
| "nenhum grupo acima de 22 séries DIRETAS/semana" | Mede **semana**. As 22 séries de peito caíram numa **sessão** só — passa raspando no teto semanal e ninguém olha a distribuição por dia |
| "nenhum dia repete exercício" (seção 7) | Compara **nome de exercício entre dias**. Quatro supinos diferentes no mesmo dia são quatro nomes distintos: passa |

Os testes que faltam, e que G1 tem que adicionar **antes** da correção (têm que
falhar contra o código de hoje):

1. Nenhuma sessão acima de `TETO_SERIES_SESSAO` séries diretas por grupo
2. Nenhuma sessão com mais de N exercícios do mesmo `padraoDe` (N=1, com exceção
   declarada por perfil de resistência distinto)
3. Nenhuma sessão com mais de N exercícios do mesmo grupo
4. Descanso coerente com a classificação — hoje o tier de 180s nunca aparece
5. Faixas de reps distintas dentro da sessão (a de hoje é 8-12 em 10 de 11 itens)

## Lição de processo

A auditoria de 29/07 (`../auditoria-2026-07-29/fitness.md`) **validou** "ordem
de exercícios" e a seleção do gerador lendo o código, e listou as correções
recentes como completas. A saída real contradiz a validação: as regras existem,
mas um fallback e um teto não aplicado as anulam em runtime.

Auditar código não substitui auditar a saída. Todo agente que valida um gerador
precisa rodar o gerador — `scripts/testar-gerador.mjs` já entra pelo
`montarPlano` com catálogo do seed e era o caminho para pegar isto.
