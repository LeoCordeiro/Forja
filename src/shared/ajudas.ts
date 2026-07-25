import type { ConteudoAjuda } from './ui/Ajuda';

/**
 * Textos de ajuda do app inteiro, num lugar só.
 *
 * Escritos para quem nunca fez: medida de fita feita em lugar diferente a cada
 * vez produz um gráfico que só mede o erro da medição, não o corpo.
 */
export const AJUDA: Record<string, ConteudoAjuda> = {
  cintura: {
    titulo: 'Como medir a cintura',
    resumo:
      'É a medida que melhor acompanha a gordura visceral em casa — mais confiável que a balança para saber se está indo bem.',
    passos: [
      'Fique de pé, em jejum ou pelo menos 2 horas após comer.',
      'Encontre o ponto entre a última costela e o topo do osso do quadril — normalmente na altura do umbigo.',
      'Passe a fita rente à pele, sem apertar nem deixar frouxa. Ela deve ficar paralela ao chão.',
      'Solte todo o ar dos pulmões e leia o número no fim da expiração, sem prender a barriga.',
    ],
    dica: 'Meça sempre no mesmo horário e no mesmo ponto. Marcar com caneta na primeira vez ajuda a repetir o local.',
    porque:
      'Homens acima de 94 cm e mulheres acima de 80 cm já têm risco metabólico aumentado, mesmo com IMC normal. A cintura cai antes do peso quando a dieta está funcionando.',
  },

  braco: {
    titulo: 'Como medir o braço',
    resumo: 'Medida clássica de progresso em hipertrofia. O detalhe está em repetir sempre do mesmo jeito.',
    passos: [
      'Braço relaxado ao lado do corpo, ou contraído a 90° — escolha um jeito e use SEMPRE o mesmo.',
      'Ache o ponto médio entre o ombro e o cotovelo.',
      'Passe a fita em volta, encostando na pele sem comprimir o músculo.',
      'Anote junto se foi relaxado ou contraído.',
    ],
    dica: 'Meça sempre o mesmo braço e antes de treinar. Depois do treino o músculo está inchado e a medida engana em 1 a 2 cm.',
    porque: 'Braço crescendo enquanto a cintura mantém ou cai é o sinal mais direto de que a recomposição está funcionando.',
  },

  peito: {
    titulo: 'Como medir o peito',
    resumo: 'Passe a fita na altura dos mamilos, com os braços relaxados ao lado do corpo.',
    passos: [
      'Fique em pé, ombros relaxados, sem estufar o peito.',
      'Passe a fita em volta do tronco na linha dos mamilos, paralela ao chão.',
      'Respire normalmente e leia no fim de uma expiração tranquila.',
    ],
    dica: 'Peça ajuda para conferir se a fita está reta nas costas — sozinho ela costuma escorregar para baixo.',
  },

  quadril: {
    titulo: 'Como medir o quadril',
    resumo: 'Mede na parte mais larga dos glúteos.',
    passos: [
      'Pés juntos, de pé, relaxado.',
      'Passe a fita na maior circunferência dos glúteos, paralela ao chão.',
      'Não aperte — a fita só encosta.',
    ],
    porque:
      'A relação cintura/quadril complementa a cintura sozinha: acima de 0,90 em homens e 0,85 em mulheres indica acúmulo de gordura abdominal.',
  },

  coxa: {
    titulo: 'Como medir a coxa',
    resumo: 'Meça no ponto médio entre a virilha e o joelho.',
    passos: [
      'Em pé, peso distribuído nas duas pernas.',
      'Ache o meio entre a dobra da virilha e a borda superior da patela.',
      'Passe a fita em volta, sem comprimir.',
    ],
    dica: 'Sempre a mesma perna. Diferença de 1 a 2 cm entre as pernas é normal.',
  },

  gorduraCorporal: {
    titulo: 'Percentual de gordura',
    resumo:
      'Quanto do seu peso é gordura. Diz muito mais sobre o corpo do que o número da balança — dá para perder gordura e ganhar músculo sem o peso se mexer.',
    passos: [
      'A forma mais acessível é a bioimpedância, disponível em farmácias e academias.',
      'Faça sempre nas mesmas condições: mesmo horário, hidratado, sem ter treinado antes e sem ter bebido álcool no dia anterior.',
      'Registre aqui no app para acompanhar a tendência.',
    ],
    dica: 'A bioimpedância erra alguns pontos percentuais no valor absoluto, mas acerta bem a TENDÊNCIA. Compare com você mesmo, não com a tabela.',
    porque:
      'Homens: 8–20% é a faixa saudável; abaixo de 15% já aparece definição. Mulheres: 21–33%. O objetivo é gordura caindo com massa magra mantida ou subindo.',
  },

  gorduraVisceral: {
    titulo: 'Gordura visceral',
    resumo:
      'É a gordura que envolve os órgãos internos, diferente da que você pega com a mão. É a que mais importa para saúde.',
    passos: [
      'Aparece na bioimpedância como um número de escala, não como percentual.',
      'Até 9 é faixa saudável. De 10 a 14 é alto. 15 ou mais é muito alto.',
      'Ela responde bem e rápido a déficit calórico com treino.',
    ],
    dica: 'Diferente da gordura subcutânea, a visceral é metabolicamente ativa: ela produz substâncias inflamatórias.',
    porque:
      'É a que se associa a resistência à insulina, diabetes tipo 2 e doença cardiovascular. Uma pessoa magra por fora pode ter visceral alta — e uma pessoa mais pesada pode ter visceral normal.',
  },

  musculoEsqueletico: {
    titulo: 'Músculo esquelético',
    resumo: 'O percentual do seu peso que é músculo voluntário — o que você treina na academia.',
    passos: [
      'Vem da bioimpedância junto com a gordura corporal.',
      'Homens saudáveis ficam entre 33% e 39%; acima de 44% é faixa atlética.',
      'Acompanhe junto com a gordura: os dois se movendo em direções opostas é exatamente o que você quer.',
    ],
    porque:
      'Músculo é o tecido que mais consome energia em repouso. Mais músculo significa metabolismo mais alto e maior facilidade para manter o peso depois.',
  },

  tmb: {
    titulo: 'Metabolismo basal (TMB)',
    resumo:
      'Quantas calorias seu corpo gasta em repouso absoluto, só para manter os órgãos funcionando. É a base de todo cálculo de dieta.',
    passos: [
      'O app estima pela fórmula de Mifflin-St Jeor, usando peso, altura, idade e sexo.',
      'Se você fez bioimpedância, ela mede o seu TMB real — que costuma ser mais preciso.',
      'Registrando o valor medido, o app passa a usá-lo no lugar da estimativa.',
    ],
    dica: 'O TMB muda quando você ganha músculo ou perde peso. Vale refazer a bioimpedância a cada 2 ou 3 meses.',
    porque:
      'A fórmula assume uma composição corporal média. Quem tem mais músculo que a média gasta mais do que ela prevê — e acaba comendo de menos sem saber.',
  },

  tdee: {
    titulo: 'Gasto diário total (TDEE)',
    resumo:
      'Seu metabolismo basal multiplicado pelo quanto você se movimenta. É quanto você gasta num dia real.',
    passos: [
      'O app multiplica o TMB pelo seu nível de atividade.',
      'Comer o TDEE mantém o peso. Comer abaixo emagrece, acima engorda.',
      'A referência mais confiável não é a fórmula: é o seu peso ao longo de 2 semanas.',
    ],
    dica: 'Se o peso não mudar em 2 semanas comendo a meta, a meta ESTÁ certa para manutenção — ajuste a partir daí.',
  },

  recomposicao: {
    titulo: 'Ganhar massa e perder gordura ao mesmo tempo',
    resumo:
      'Chamado de recomposição corporal. Durante anos se disse que era impossível; hoje se sabe que funciona bem em três situações específicas.',
    passos: [
      'Funciona para: quem está começando, quem está voltando de uma pausa, e quem tem percentual de gordura mais alto.',
      'Exige déficit LEVE (10 a 15%) — déficit agressivo derruba a recuperação e você perde músculo junto.',
      'Exige proteína alta: cerca de 3 g por kg de massa magra.',
      'Exige treino de força de verdade. Sem ele, o déficit consome músculo.',
    ],
    dica: 'A balança vai se mexer devagar, e isso é esperado. Acompanhe pela fita métrica, pelo espelho e pela carga que você levanta.',
    porque:
      'Você é candidato ideal: gordura corporal acima de 20%, voltando de uma pausa e com memória muscular a favor. Nessa janela dá para ganhar músculo mesmo comendo abaixo do gasto.',
  },

  rir: {
    titulo: 'RIR — repetições na reserva',
    resumo:
      'Quantas repetições você AINDA conseguiria fazer ao terminar a série. RIR 2 significa que pararia faltando 2.',
    passos: [
      'Ao terminar a série, pergunte: quantas eu ainda faria com boa técnica?',
      'Na readaptação, pare com 3 a 4 na reserva.',
      'Em fase normal, 2 a 3.',
      'Só nas últimas séries de um exercício vale chegar a 0 ou 1.',
    ],
    dica: 'Levar toda série até a falha não gera mais músculo e atrapalha a recuperação para o resto do treino.',
    porque:
      'Estudos mostram ganho equivalente parando 1 a 3 repetições antes da falha, com muito menos fadiga acumulada — o que permite mais volume total na semana, que é o que de fato constrói músculo.',
  },

  descanso: {
    titulo: 'Descanso entre séries',
    resumo:
      'Mais tempo de descanso gera MAIS músculo, não menos. É o oposto do que se ensinava.',
    passos: [
      'Exercícios compostos pesados (agachamento, terra, supino): 2 a 3 minutos.',
      'Compostos em geral: 2 a 2,5 minutos.',
      'Isoladores (rosca, elevação lateral): 60 a 90 segundos.',
    ],
    dica: 'Se você chega na próxima série ofegante e com muito menos carga, descansou pouco.',
    porque:
      'Schoenfeld (2016) comparou 1 min contra 3 min por 8 semanas: o grupo de 3 minutos ganhou mais força E mais músculo. Com mais descanso você mantém carga e repetições nas séries seguintes, e é esse volume acumulado que produz resultado.',
  },

  progressao: {
    titulo: 'Progressão de carga',
    resumo:
      'O músculo só cresce se o estímulo aumentar com o tempo. Fazer sempre o mesmo peso mantém, não constrói.',
    passos: [
      'Use dupla progressão: primeiro suba as repetições dentro da faixa (ex.: de 8 até 12).',
      'Quando fizer o topo da faixa em todas as séries, aumente a carga.',
      'Ao subir a carga, as repetições caem — e você recomeça o ciclo.',
    ],
    dica: 'Aumentos de 2,5 kg em superiores e 5 kg em inferiores são suficientes. Pular de 10 em 10 quebra a técnica.',
    porque:
      'O app mostra o peso da última sessão em cinza justamente para isso: você vê o que fez e supera por pouco, toda vez.',
  },

  agua: {
    titulo: 'Quanta água beber',
    resumo:
      'A conta é 35 ml por quilo de peso, mais a reposição do que você sua treinando.',
    passos: [
      'Base: 35 ml × seu peso. Com 88 kg, dá cerca de 3 litros.',
      'Some 500 a 1000 ml por hora de treino.',
      'Distribua ao longo do dia — beber tudo de uma vez não hidrata, só passa direto.',
    ],
    dica: 'Urina clara é bom sinal. Urina escura significa que você já está desidratado há um tempo.',
    porque:
      'Perder 2% do peso em água já derruba força e resistência de forma mensurável. E a sede só aparece DEPOIS desse ponto — por isso se bebe por horário, não por vontade.',
  },

  cardio: {
    titulo: 'Cardio sem perder músculo',
    resumo:
      'Cardio não mata os ganhos, desde que respeitadas algumas regras de programação.',
    passos: [
      'Faça depois da musculação, ou separado por pelo menos 3 horas.',
      'Prefira bicicleta ou elíptico: geram menos dano muscular que corrida.',
      'Zona 2 (aquela em que você consegue conversar) por 25 a 40 minutos.',
      'Evite cardio pesado de perna no dia anterior ao treino de perna.',
    ],
    dica: 'Zona 2 é o ponto em que dá para manter conversa, mas não cantar.',
    porque:
      'A meta-análise de 2022 com 43 estudos não achou prejuízo relevante do cardio sobre hipertrofia ou força máxima. Quem sofre de verdade é a potência explosiva.',
  },

  volumeSemanal: {
    titulo: 'Volume semanal',
    resumo:
      'Número de séries por grupo muscular na semana. É a variável que mais determina crescimento.',
    passos: [
      'Iniciante: 8 a 12 séries por grupo, por semana.',
      'Intermediário: 12 a 20.',
      'Divida em pelo menos 2 sessões — 2× por semana rende mais que tudo num dia só.',
    ],
    dica: 'Só contam séries próximas da falha. Aquecimento não entra na conta.',
    porque:
      'A meta-regressão de 2025 (67 estudos, 2.058 pessoas) mostrou ganho crescente com mais volume, mas com retorno decrescente claro. Abaixo de 10 séries o resultado é nitidamente pior; acima de 20, cada série extra rende pouco e cobra recuperação.',
  },

  checkin: {
    titulo: 'Check-in do treino',
    resumo:
      'Ao iniciar, o app registra hora, local e como você chegou. Leva 3 segundos e explica muito depois.',
    passos: [
      'Toque em iniciar treino e escolha como está sua energia.',
      'O treino passa a contar no seu calendário da semana.',
      'No histórico, dá para cruzar energia baixa com queda de desempenho.',
    ],
    porque:
      'Depois de algumas semanas fica visível o padrão: treinos ruins costumam ter causa — sono, comida ou intervalo curto demais desde a última sessão.',
  },

  imc: {
    titulo: 'IMC',
    resumo:
      'Peso dividido pela altura ao quadrado. Serve como triagem populacional, mas é limitado para quem treina.',
    passos: [
      'Abaixo de 18,5: baixo peso. De 18,5 a 24,9: normal. De 25 a 29,9: sobrepeso. 30 ou mais: obesidade.',
      'O IMC não distingue músculo de gordura.',
    ],
    dica: 'Se você treina, dê mais atenção ao percentual de gordura e à cintura do que ao IMC.',
    porque:
      'Uma pessoa musculosa pode aparecer como "sobrepeso" no IMC estando com gordura baixa. O contrário também existe: IMC normal com gordura visceral alta.',
  },
};
