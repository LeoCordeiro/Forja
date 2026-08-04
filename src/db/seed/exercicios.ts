/**
 * Catálogo de exercícios em português.
 *
 * As imagens vêm do free-exercise-db (licença MIT), servidas direto do GitHub.
 * Cada exercício tem 2 frames — início e fim do movimento — que o app alterna
 * para virar uma demonstração animada, sem hospedar vídeo nenhum.
 *
 * Para adicionar um exercício: copie uma linha e ajuste. `slug` pode ser null
 * (o app cai no ícone do grupo muscular). Nada quebra.
 */

export const MEDIA_BASE =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises';

export type GrupoMuscular =
  | 'peito'
  | 'costas'
  | 'ombro'
  | 'biceps'
  | 'triceps'
  | 'quadriceps'
  | 'posterior'
  | 'gluteo'
  | 'panturrilha'
  | 'abdomen'
  | 'antebraco'
  | 'trapezio'
  | 'cardio';

/** [nome, grupo, secundários(CSV), equipamento, tipoCarga, slug, instruções(|), dica] */
type L = [
  string,
  GrupoMuscular,
  string,
  string,
  'peso_reps' | 'peso_corporal' | 'tempo' | 'distancia',
  string | null,
  string,
  string,
];

export const EXERCICIOS: L[] = [
  // ── PEITO ───────────────────────────────────────────────────────────────
  ['Supino reto com barra','peito','triceps,ombro','barra','peso_reps','Barbell_Bench_Press_-_Medium_Grip',
   'Deite no banco com os pés firmes no chão e as escápulas retraídas.|Desça a barra até tocar de leve na linha do mamilo.|Empurre até estender os cotovelos sem travar.',
   'Não deixe o cotovelo abrir 90° em relação ao tronco — 45° protege o ombro.'],
  ['Supino inclinado com barra','peito','ombro,triceps','barra','peso_reps','Barbell_Incline_Bench_Press_-_Medium_Grip',
   'Ajuste o banco entre 30° e 45°.|Desça a barra na linha da clavícula.|Empurre em diagonal, sem jogar a barra pra frente.',
   'Acima de 45° o ombro assume o exercício e o peito para de trabalhar.'],
  ['Supino reto com halteres','peito','triceps,ombro','halter','peso_reps','Dumbbell_Bench_Press',
   'Deite segurando os halteres na altura do peito.|Empurre para cima aproximando-os sem bater.|Desça controlado até sentir alongar.',
   'Amplitude maior que a barra — use isso a seu favor, desça bem.'],
  ['Supino inclinado com halteres','peito','ombro,triceps','halter','peso_reps','Incline_Dumbbell_Press',
   'Banco a 30°, halteres na altura do peito superior.|Empurre para cima e levemente para dentro.|Desça controlado.',
   'Melhor exercício para peitoral superior. Não sacrifique amplitude por carga.'],
  ['Crucifixo com halteres','peito','ombro','halter','peso_reps','Dumbbell_Flyes',
   'Deite com os halteres acima do peito, cotovelos levemente flexionados.|Abra os braços em arco até a linha do ombro.|Feche contraindo o peito.',
   'Cotovelo fixo o tempo todo. Se dobrar, virou supino.'],
  ['Crucifixo inclinado','peito','ombro','halter','peso_reps','Incline_Dumbbell_Flyes',
   'Banco a 30°, mesma execução do crucifixo reto.|Abra em arco amplo.|Feche sem bater os halteres.',
   'Peso baixo. Aqui é alongamento e contração, não carga.'],
  ['Crossover na polia','peito','ombro','cabo','peso_reps','Cable_Crossover',
   'Polias altas, um passo à frente, tronco levemente inclinado.|Traga as mãos em arco até se cruzarem.|Volte controlando a tensão.',
   'Cruze as mãos no fim — sem isso você perde a contração máxima.'],
  ['Voador (peck deck)','peito','ombro','maquina','peso_reps','Butterfly',
   'Ajuste o banco para as alças ficarem na linha do peito.|Feche os braços contraindo o peito.|Volte devagar até alongar.',
   'Segure 1 segundo fechado. É onde o peito realmente trabalha.'],
  ['Flexão de braço','peito','triceps,abdomen','livre','peso_corporal','Pushups',
   'Mãos pouco além da largura dos ombros.|Corpo em linha reta da cabeça ao calcanhar.|Desça até o peito quase tocar o chão.',
   'Quadril caindo = abdômen desligado. Contraia o glúteo.'],
  ['Mergulho no paralelo','peito','triceps,ombro','livre','peso_corporal','Dips_-_Chest_Version',
   'Apoie-se nas barras com os braços estendidos.|Incline o tronco à frente e desça até 90°.|Suba empurrando.',
   'Tronco vertical foca tríceps; inclinado foca peito. Escolha de propósito.'],

  // ── COSTAS ──────────────────────────────────────────────────────────────
  ['Levantamento terra','costas','posterior,gluteo,trapezio','barra','peso_reps','Barbell_Deadlift',
   'Pés na largura do quadril, barra encostada na canela.|Coluna neutra, peito aberto, quadril acima do joelho.|Empurre o chão e suba estendendo quadril e joelho juntos.',
   'A barra sobe raspando a perna. Se afastar do corpo, a lombar paga a conta.'],
  ['Barra fixa','costas','biceps,ombro','livre','peso_corporal','Pullups',
   'Pegada pronada, pouco além da largura dos ombros.|Puxe levando o peito à barra, cotovelo pro bolso.|Desça até estender completo.',
   'Puxe com o cotovelo, não com a mão. Pense em "descer o cotovelo".'],
  ['Barra fixa supinada','costas','biceps','livre','peso_corporal','Chin-Up',
   'Pegada supinada na largura dos ombros.|Puxe até o queixo passar a barra.|Desça controlado.',
   'Mais fácil que a pronada e recruta muito bíceps — bom para progredir.'],
  ['Puxada frontal na polia','costas','biceps','maquina','peso_reps','Wide-Grip_Lat_Pulldown',
   'Pegada aberta, tronco levemente inclinado para trás.|Puxe a barra até a parte alta do peito.|Suba controlando.',
   'Nunca puxe atrás da nuca. Risco de ombro sem nenhum benefício extra.'],
  ['Puxada supinada','costas','biceps','maquina','peso_reps','Underhand_Cable_Pulldowns',
   'Pegada supinada na largura dos ombros.|Puxe até o peito, cotovelos rentes ao corpo.|Volte controlado.',
   'Pega mais a parte baixa do dorsal. Ótimo complemento da pegada aberta.'],
  ['Remada curvada com barra','costas','biceps,posterior','barra','peso_reps','Bent_Over_Barbell_Row',
   'Tronco a ~45°, coluna neutra, joelho levemente flexionado.|Puxe a barra até o umbigo.|Desça controlado sem arredondar as costas.',
   'Se precisar dar tranco pra subir, o peso está errado.'],
  ['Remada unilateral com halter','costas','biceps','halter','peso_reps','One-Arm_Dumbbell_Row',
   'Um joelho e uma mão no banco, coluna paralela ao chão.|Puxe o halter até a lateral do abdômen.|Desça alongando o dorsal.',
   'Não gire o tronco para ajudar. O ombro fica na mesma altura o tempo todo.'],
  ['Remada baixa na polia','costas','biceps','maquina','peso_reps','Seated_Cable_Rows',
   'Sentado, joelhos levemente flexionados, coluna ereta.|Puxe o triângulo até o abdômen.|Volte alongando sem curvar as costas.',
   'Peito estufado e escápulas se juntando no fim do movimento.'],
  ['Remada cavalinho','costas','biceps,trapezio','barra','peso_reps','Lying_T-Bar_Row',
   'Tronco inclinado, pegada firme na barra.|Puxe até o abdômen contraindo as escápulas.|Desça controlado.',
   'Excelente para espessura de costas. Amplitude completa importa mais que carga.'],
  ['Pulldown com braço estendido','costas','','cabo','peso_reps','Straight-Arm_Pulldown',
   'Em pé de frente à polia alta, braços estendidos.|Empurre a barra até a coxa mantendo o cotovelo fixo.|Volte controlado.',
   'Isolador de dorsal puro. Se o cotovelo dobrar, virou tríceps.'],
  ['Hiperextensão lombar','costas','posterior,gluteo','maquina','peso_corporal','Hyperextensions_Back_Extensions',
   'Quadril apoiado na almofada, pés travados.|Desça flexionando o quadril com a coluna neutra.|Suba até alinhar o tronco.',
   'Não hiperestenda no topo. Pare quando o corpo estiver reto.'],

  // ── OMBRO ───────────────────────────────────────────────────────────────
  ['Desenvolvimento militar','ombro','triceps','barra','peso_reps','Standing_Military_Press',
   'Em pé, barra na altura da clavícula, pegada pouco além dos ombros.|Empurre acima da cabeça.|Desça controlado até o queixo.',
   'Contraia glúteo e abdômen — sem isso a lombar arqueia e vira supino em pé.'],
  ['Desenvolvimento com halteres','ombro','triceps','halter','peso_reps','Dumbbell_Shoulder_Press',
   'Sentado com apoio, halteres na altura das orelhas.|Empurre para cima sem bater.|Desça até 90° no cotovelo.',
   'Amplitude maior que a barra e menos estresse no ombro.'],
  ['Desenvolvimento Arnold','ombro','triceps','halter','peso_reps','Arnold_Dumbbell_Press',
   'Comece com as palmas voltadas para você, halteres na frente.|Gire enquanto empurra para cima.|Volte fazendo o caminho inverso.',
   'A rotação recruta as três porções do deltoide. Vale usar menos peso.'],
  ['Elevação lateral','ombro','trapezio','halter','peso_reps','Side_Lateral_Raise',
   'Em pé, halteres ao lado do corpo, cotovelo levemente flexionado.|Suba até a linha do ombro.|Desça bem devagar.',
   'Erro nº1 é peso demais. Se o trapézio subir, diminua.'],
  ['Elevação frontal','ombro','','halter','peso_reps','Front_Dumbbell_Raise',
   'Halteres à frente das coxas.|Suba até a linha dos olhos.|Desça controlado.',
   'Ombro anterior já trabalha muito no supino. Volume baixo aqui basta.'],
  ['Crucifixo inverso','ombro','costas','halter','peso_reps','Reverse_Flyes',
   'Tronco inclinado à frente, halteres pendurados.|Abra os braços em arco até a linha do ombro.|Volte controlado.',
   'O deltoide posterior é o mais esquecido e o que mais melhora a postura.'],
  ['Remada alta','ombro','trapezio,biceps','barra','peso_reps','Upright_Barbell_Row',
   'Pegada na largura dos ombros.|Puxe a barra até a altura do peito, cotovelo acima da mão.|Desça controlado.',
   'Pegada muito fechada causa impacto no ombro. Mantenha na largura dos ombros.'],
  ['Encolhimento','trapezio','ombro','barra','peso_reps','Barbell_Shrug',
   'Em pé com a barra à frente das coxas, braços estendidos.|Eleve os ombros em direção às orelhas.|Desça controlado.',
   'Não gire os ombros. É movimento vertical, para cima e para baixo.'],
  ['Face pull','ombro','costas,trapezio','cabo','peso_reps','Face_Pull',
   'Polia na altura do rosto, corda com pegada neutra.|Puxe em direção à testa abrindo os cotovelos.|Volte controlado.',
   'O melhor seguro contra lesão de ombro. Faça toda semana.'],

  // ── BÍCEPS ──────────────────────────────────────────────────────────────
  ['Rosca direta com barra','biceps','antebraco','barra','peso_reps','Barbell_Curl',
   'Em pé, pegada supinada na largura dos ombros.|Flexione até a barra chegar perto do peito.|Desça até estender completo.',
   'Cotovelo colado no tronco. Se ele for pra frente, o ombro entrou.'],
  ['Rosca alternada com halteres','biceps','antebraco','halter','peso_reps','Dumbbell_Bicep_Curl',
   'Halteres ao lado do corpo, pegada neutra.|Suba girando o punho para supinado.|Desça controlado e alterne.',
   'A supinação no meio do caminho é o que ativa o bíceps por completo.'],
  ['Rosca martelo','biceps','antebraco','halter','peso_reps','Hammer_Curls',
   'Pegada neutra (palmas voltadas uma para a outra).|Flexione mantendo a pegada.|Desça controlado.',
   'Pega o braquial, que empurra o bíceps pra cima e engrossa o braço.'],
  ['Rosca scott','biceps','','maquina','peso_reps','Preacher_Curl',
   'Braços apoiados no banco inclinado, axila encostada.|Flexione até o topo.|Desça até quase estender.',
   'Não estenda 100% no banco scott — risco de lesão no tendão.'],
  ['Rosca concentrada','biceps','','halter','peso_reps','Concentration_Curls',
   'Sentado, cotovelo apoiado na parte interna da coxa.|Flexione concentrando no pico do bíceps.|Desça devagar.',
   'Maior ativação de bíceps entre todos os exercícios. Use no fim do treino.'],
  ['Rosca na polia alta','biceps','','cabo','peso_reps','High_Cable_Curls',
   'Polias altas dos dois lados, braços abertos na horizontal.|Flexione trazendo as mãos às orelhas.|Volte controlado.',
   'Tensão constante do começo ao fim, coisa que o halter não dá.'],
  ['Rosca inversa','antebraco','biceps','barra','peso_reps','Reverse_Barbell_Curl',
   'Pegada pronada na largura dos ombros.|Flexione até o peito.|Desça controlado.',
   'Antebraço forte melhora pegada em tudo, principalmente terra e remada.'],

  // ── TRÍCEPS ─────────────────────────────────────────────────────────────
  ['Tríceps testa','triceps','','barra','peso_reps','Lying_Triceps_Press',
   'Deitado, barra acima da testa, cotovelos apontados para cima.|Desça flexionando só o cotovelo.|Estenda sem travar.',
   'Cotovelo parado. Se ele abrir, o peso está alto demais.'],
  ['Tríceps na polia com corda','triceps','','cabo','peso_reps','Triceps_Pushdown_-_Rope_Attachment',
   'Corda na polia alta, cotovelos colados no tronco.|Estenda abrindo a corda no final.|Volte controlado.',
   'Abrir a corda no fim aumenta muito a contração da cabeça lateral.'],
  ['Tríceps na polia com barra','triceps','','cabo','peso_reps','Triceps_Pushdown',
   'Barra reta na polia alta, pegada pronada.|Estenda os cotovelos até embaixo.|Volte a 90°.',
   'Tronco parado. Se você se inclinar pra empurrar, virou peito.'],
  ['Tríceps francês','triceps','','halter','peso_reps','Standing_Dumbbell_Triceps_Extension',
   'Halter acima da cabeça com as duas mãos.|Desça atrás da nuca flexionando o cotovelo.|Estenda de volta.',
   'Melhor exercício para a cabeça longa do tríceps — a que dá volume ao braço.'],
  ['Mergulho entre bancos','triceps','peito,ombro','livre','peso_corporal','Bench_Dips',
   'Mãos no banco atrás do corpo, pés à frente.|Desça até 90° no cotovelo.|Suba empurrando.',
   'Não desça demais — sobrecarrega a cápsula do ombro.'],
  ['Supino fechado','triceps','peito,ombro','barra','peso_reps','Close-Grip_Barbell_Bench_Press',
   'Pegada na largura dos ombros.|Desça a barra até a base do peito, cotovelos rentes.|Empurre.',
   'Pegada fechada demais machuca o punho. Largura dos ombros já resolve.'],
  ['Tríceps coice','triceps','','halter','peso_reps','Tricep_Dumbbell_Kickback',
   'Tronco inclinado, braço colado ao corpo, cotovelo a 90°.|Estenda o antebraço para trás.|Volte controlado.',
   'Peso leve. O que conta aqui é segurar a contração no fim.'],

  // ── QUADRÍCEPS ──────────────────────────────────────────────────────────
  ['Agachamento livre','quadriceps','gluteo,posterior,abdomen','barra','peso_reps','Barbell_Squat',
   'Barra no trapézio, pés na largura dos ombros, pontas levemente para fora.|Desça empurrando o quadril para trás até a coxa passar do paralelo.|Suba empurrando o chão.',
   'Joelho segue a linha do pé. Se cair para dentro, reduza a carga.'],
  ['Agachamento frontal','quadriceps','gluteo,abdomen','barra','peso_reps','Front_Barbell_Squat',
   'Barra apoiada na frente dos ombros, cotovelos altos.|Desça mantendo o tronco vertical.|Suba.',
   'Cotovelo caiu, barra cai. Mantenha os cotovelos apontados para frente.'],
  ['Leg press','quadriceps','gluteo,posterior','maquina','peso_reps','Leg_Press',
   'Pés na plataforma na largura dos ombros.|Desça até 90° no joelho.|Empurre sem travar o joelho.',
   'Nunca deixe a lombar descolar do encosto. Se descolar, pare de descer.'],
  ['Cadeira extensora','quadriceps','','maquina','peso_reps','Leg_Extensions',
   'Sentado, tornozelo atrás da almofada.|Estenda até quase travar.|Desça controlado.',
   'Segure 1 segundo no topo. É onde o reto femoral trabalha de verdade.'],
  ['Afundo com halteres','quadriceps','gluteo,posterior','halter','peso_reps','Dumbbell_Lunges',
   'Halteres ao lado do corpo, um passo à frente.|Desça até o joelho de trás quase tocar o chão.|Empurre com a perna da frente.',
   'Tronco ereto. Inclinar pra frente transfere o trabalho pro glúteo.'],
  ['Afundo com barra','quadriceps','gluteo','barra','peso_reps','Barbell_Lunge',
   'Barra no trapézio, passo à frente.|Desça controlado até 90° nos dois joelhos.|Volte.',
   'Comece com halteres. Com barra o equilíbrio fica bem mais difícil.'],
  ['Hack machine','quadriceps','gluteo','maquina','peso_reps','Hack_Squat',
   'Costas apoiadas, pés no meio da plataforma.|Desça até a coxa passar do paralelo.|Suba.',
   'Pé mais alto pega glúteo; pé mais baixo pega quadríceps.'],

  // ── POSTERIOR / GLÚTEO ──────────────────────────────────────────────────
  ['Stiff','posterior','gluteo,costas','barra','peso_reps','Stiff-Legged_Barbell_Deadlift',
   'Barra à frente das coxas, joelho quase estendido.|Desça empurrando o quadril para trás até sentir alongar.|Suba contraindo o glúteo.',
   'Movimento é do quadril, não da coluna. Costas retas o tempo todo.'],
  ['Levantamento terra romeno','posterior','gluteo,costas','barra','peso_reps','Romanian_Deadlift',
   'Barra na coxa, joelhos levemente flexionados.|Desça a barra raspando a perna até a metade da canela.|Suba estendendo o quadril.',
   'Difere do stiff pelo joelho flexionado — pega mais glúteo.'],
  ['Mesa flexora','posterior','panturrilha','maquina','peso_reps','Lying_Leg_Curls',
   'Deitado de bruços, tornozelo sob a almofada.|Flexione o joelho até o máximo.|Desça controlado.',
   'Não levante o quadril pra ajudar. Se levantar, o peso está alto.'],
  ['Cadeira flexora','posterior','','maquina','peso_reps','Seated_Leg_Curl',
   'Sentado, almofada sobre a coxa, tornozelo atrás do rolo.|Flexione o joelho.|Volte controlado.',
   'A versão sentada alonga mais o isquiotibial que a deitada.'],
  ['Elevação pélvica com barra','gluteo','posterior','barra','peso_reps','Barbell_Glute_Bridge',
   'Costas apoiadas no banco, barra sobre o quadril.|Empurre o quadril para cima até alinhar tronco e coxa.|Desça controlado.',
   'Contraia o glúteo 1 segundo no topo. Sem isso o exercício não rende.'],
  ['Abdução na máquina','gluteo','','maquina','peso_reps','Thigh_Abductor',
   'Sentado, joelhos contra as almofadas.|Abra as pernas contra a resistência.|Volte controlado.',
   'Inclinar o tronco à frente pega mais glúteo médio.'],
  ['Coice na polia','gluteo','posterior','cabo','peso_reps','Glute_Kickback',
   'Tornozeleira na polia baixa, tronco inclinado à frente.|Estenda o quadril para trás.|Volte controlado.',
   'Não arqueie a lombar pra ganhar amplitude. O movimento é do quadril.'],

  // ── PANTURRILHA ─────────────────────────────────────────────────────────
  ['Panturrilha em pé','panturrilha','','maquina','peso_reps','Standing_Calf_Raises',
   'Ponta dos pés na plataforma, calcanhar livre.|Suba o máximo na ponta dos pés.|Desça alongando por completo.',
   'Amplitude total, sem quicar embaixo. Meia amplitude não desenvolve panturrilha.'],
  ['Panturrilha sentado','panturrilha','','maquina','peso_reps','Seated_Calf_Raise',
   'Sentado, almofada sobre os joelhos, ponta dos pés na plataforma.|Suba na ponta.|Desça alongando.',
   'A versão sentada foca o sóleo, que é a base do volume da panturrilha.'],
  ['Panturrilha no leg press','panturrilha','','maquina','peso_reps','Calf_Press_On_The_Leg_Press_Machine',
   'Ponta dos pés na base da plataforma.|Empurre estendendo o tornozelo.|Volte alongando.',
   'Trave a máquina antes. Só o tornozelo se move, o joelho fica parado.'],

  // ── ABDÔMEN ─────────────────────────────────────────────────────────────
  ['Abdominal supra','abdomen','','livre','peso_corporal','Crunches',
   'Deitado, joelhos flexionados, mãos na lateral da cabeça.|Suba o tronco contraindo o abdômen.|Desça controlado.',
   'Não puxe o pescoço. O queixo fica longe do peito, olhando pro teto.'],
  ['Prancha','abdomen','ombro','livre','tempo','Plank',
   'Apoio nos antebraços e pontas dos pés.|Corpo em linha reta da cabeça ao calcanhar.|Segure contraindo abdômen e glúteo.',
   'Se o quadril subir ou cair, o tempo não conta. Qualidade > segundos.'],
  ['Elevação de pernas na barra','abdomen','','livre','peso_corporal','Hanging_Leg_Raise',
   'Pendurado na barra, corpo estendido.|Eleve as pernas até a linha do quadril ou acima.|Desça controlado sem balançar.',
   'Se balançar, você está usando impulso. Reduza a amplitude e controle.'],
  ['Abdominal na polia','abdomen','','cabo','peso_reps','Cable_Crunch',
   'Ajoelhado de costas para a polia alta, corda ao lado da cabeça.|Flexione o tronco levando o cotovelo ao joelho.|Volte controlado.',
   'O único abdominal onde dá pra progredir carga de verdade.'],
  ['Prancha lateral','abdomen','','livre','tempo','Side_Bridge',
   'Apoio num antebraço, corpo de lado em linha reta.|Eleve o quadril e segure.|Repita do outro lado.',
   'Trabalha o oblíquo e estabiliza a lombar. Faça os dois lados igual.'],
  ['Abdominal infra','abdomen','','livre','peso_corporal','Flat_Bench_Lying_Leg_Raise',
   'Deitado no banco, mãos segurando a borda atrás da cabeça.|Eleve as pernas até a vertical.|Desça sem tocar o chão.',
   'Lombar colada no banco. Se descolar, diminua a amplitude.'],
  ['Russian twist','abdomen','','livre','peso_reps','Russian_Twist',
   'Sentado, tronco inclinado para trás, pés fora do chão.|Gire o tronco de um lado ao outro.|Mantenha o abdômen contraído.',
   'O giro vem do tronco, não dos braços.'],
  ['Escalador','abdomen','cardio','livre','tempo','Mountain_Climbers',
   'Posição de prancha alta.|Traga um joelho ao peito e alterne rapidamente.|Mantenha o quadril baixo.',
   'Serve como abdômen e como condicionamento. Ritmo alto.'],

  // ── CARDIO ──────────────────────────────────────────────────────────────
  ['Esteira','cardio','quadriceps,panturrilha','maquina','tempo','Running_Treadmill',
   'Ajuste velocidade e inclinação.|Mantenha o ritmo alvo.|Desaqueça nos últimos minutos.',
   'Inclinação de 3-5% queima mais e agride menos o joelho que velocidade alta.'],
  ['Bicicleta ergométrica','cardio','quadriceps','maquina','tempo','Bicycling_Stationary',
   'Ajuste o banco: joelho quase estendido embaixo.|Mantenha cadência constante.|Desaqueça no fim.',
   'Banco baixo demais destrói o joelho. Ajuste antes de começar.'],
  ['Elíptico','cardio','quadriceps,gluteo','maquina','tempo','Elliptical_Trainer',
   'Pés firmes nos pedais, postura ereta.|Use braços e pernas juntos.|Mantenha resistência constante.',
   'Menor impacto de todos. Boa opção em dia de perna pesada.'],
  ['Remo ergômetro','cardio','costas,posterior','maquina','tempo','Rowing_Stationary',
   'Sequência: pernas, tronco, braços.|Volte na ordem inversa.|Mantenha a coluna neutra.',
   'Cardio de corpo inteiro. A força vem 60% das pernas, não dos braços.'],
  ['Pular corda','cardio','panturrilha','livre','tempo','Rope_Jumping',
   'Cotovelos junto ao corpo, giro vem do punho.|Salto baixo, na ponta dos pés.|Ritmo constante.',
   'Salto alto cansa rápido e não rende. Mal saia do chão.'],

  // ══ EXPANSÃO: INFERIORES E PESO CORPORAL ══════════════════════════════════
  //
  // O catálogo nasceu com 44 exercícios de superior contra 17 de inferior, e
  // glúteo tinha três. Com isso, "foco em inferiores" não tinha como virar um
  // treino de verdade: o gerador repetia os mesmos três exercícios ou gastava
  // o volume em quadríceps. Era a causa concreta do treino que saiu confuso.
  //
  // Pior estava "em casa, sem equipamento": o filtro só libera `livre`, e não
  // existia UM exercício de perna com essa etiqueta. O plano saía sem nenhum
  // agachamento — e a pessoa não conclui que o app errou, conclui que não
  // consegue treinar.

  // ── GLÚTEO ──────────────────────────────────────────────────────────────
  ['Hip thrust com barra','gluteo','posterior,quadriceps','barra','peso_reps','Barbell_Hip_Thrust',
   'Apoie as escápulas na borda do banco, barra na dobra do quadril.|Suba até tronco e coxa formarem uma linha.|Segure um instante no topo e desça sem largar o peso no chão.',
   'Termine o movimento com o queixo pra dentro. Jogar a cabeça pra trás dá a sensação de subir mais, mas quem sobe é a lombar, não o glúteo.'],
  ['Agachamento ajoelhado com barra','gluteo','posterior','barra','peso_reps','Kneeling_Squat',
   'Ajoelhe no colchonete com a barra nas costas.|Sente até quase tocar os calcanhares.|Suba empurrando o quadril à frente.',
   'Tira o joelho e o tornozelo da conta: é glúteo quase puro. Boa saída para quem tem dor em agachamento.'],
  ['Pull through na polia','gluteo','posterior','cabo','peso_reps','Pull_Through',
   'De costas para a polia baixa, corda entre as pernas.|Jogue o quadril pra trás com o joelho quase reto.|Volte empurrando o quadril à frente, não puxando com o braço.',
   'Se você sentir nos braços, o peso está alto. O braço aqui é só corrente.'],
  ['Ponte de glúteo','gluteo','posterior','livre','peso_corporal','Butt_Lift_Bridge',
   'Deitado de costas, joelhos dobrados, pés na largura do quadril.|Suba o quadril apertando o glúteo no topo.|Desça sem encostar de vez no chão.',
   'Aproxime os calcanhares do bumbum até sentir que quem sobe é o glúteo, não o posterior.'],
  ['Elevação pélvica unilateral','gluteo','posterior','livre','peso_corporal','Single_Leg_Glute_Bridge',
   'Deitado, um pé no chão e a outra perna estendida.|Suba o quadril só com a perna apoiada.|Mantenha o quadril nivelado — sem cair pro lado livre.',
   'Uma perna de cada vez expõe a diferença entre os lados. Faça o lado fraco primeiro e iguale as repetições pelo pior.'],
  ['Coice no solo','gluteo','','livre','peso_corporal','Glute_Kickback',
   'Apoiado nas mãos e joelhos, coluna neutra.|Empurre um calcanhar pro teto sem passar da linha do tronco.|Volte controlando.',
   'Subir mais alto não é melhor: passou da linha do tronco, é lombar arqueando.'],
  ['Subida no banco','gluteo','quadriceps','livre','peso_corporal','Step-up_with_Knee_Raise',
   'Pé inteiro apoiado num banco na altura do joelho.|Suba empurrando com a perna de cima, sem impulso da de baixo.|Desça devagar.',
   'Quanto mais alto o banco, mais glúteo. Baixo demais vira exercício de panturrilha.'],

  // ── POSTERIOR ───────────────────────────────────────────────────────────
  ['Flexora em pé','posterior','panturrilha','maquina','peso_reps','Standing_Leg_Curl',
   'Uma perna de cada vez, quadril colado no apoio.|Flexione o joelho até o limite sem tirar o quadril.|Desça controlando.',
   'Unilateral, então serve para corrigir diferença entre as pernas — coisa que mesa flexora esconde.'],
  ['Stiff com halteres','posterior','gluteo','halter','peso_reps','Stiff-Legged_Dumbbell_Deadlift',
   'Halteres à frente das coxas, joelho levemente flexionado e fixo.|Empurre o quadril pra trás descendo os halteres rente à perna.|Suba contraindo o glúteo.',
   'Não é para chegar no chão. Desça só até onde o posterior estica sem a lombar arredondar.'],
  ['Bom dia com barra','posterior','gluteo','barra','peso_reps','Good_Morning',
   'Barra apoiada no trapézio, pés na largura do quadril.|Incline o tronco à frente jogando o quadril pra trás.|Volte com o glúteo, coluna sempre neutra.',
   'Comece com a barra vazia. É o exercício que mais pune carga adiantada.'],
  ['Flexão nórdica','posterior','gluteo','livre','peso_corporal','Natural_Glute_Ham_Raise',
   'Ajoelhado com os tornozelos presos ou apoiados.|Desça o tronco à frente segurando com o posterior o máximo que der.|Empurre o chão com as mãos para voltar.',
   'É o exercício com melhor evidência para prevenir lesão de posterior. Comece descendo pouco — é normal não segurar nem metade.'],
  ['Glute ham raise na máquina','posterior','gluteo','maquina','peso_reps','Glute_Ham_Raise',
   'Coxas apoiadas, tornozelos presos.|Desça o tronco até a linha do corpo.|Volte puxando com o posterior.',
   'Versão assistida da flexão nórdica: dá para dosar em vez de tudo ou nada.'],
  ['Hiperextensão inversa','posterior','gluteo','maquina','peso_reps','Reverse_Hyperextension',
   'Tronco apoiado no aparelho, pernas soltas.|Suba as pernas até a linha do tronco.|Desça sem balançar.',
   'Carrega posterior e glúteo sem comprimir a coluna. Boa escolha em dia de lombar cansada.'],

  // ── QUADRÍCEPS ──────────────────────────────────────────────────────────
  ['Agachamento livre sem peso','quadriceps','gluteo,posterior','livre','peso_corporal','Bodyweight_Squat',
   'Pés na largura do ombro, ponta levemente pra fora.|Desça como se fosse sentar, peito aberto.|Suba empurrando o chão com o pé inteiro.',
   'A progressão aqui não é peso, é profundidade e cadência. Descer em 3 segundos vale mais que somar repetição.'],
  ['Agachamento na cadeira','quadriceps','gluteo','livre','peso_corporal','Chair_Squat',
   'De pé, de costas para uma cadeira.|Desça até encostar de leve no assento.|Levante sem usar as mãos.',
   'Ponto de partida honesto para quem está começando ou voltando. A cadeira dá o limite e tira o medo de cair.'],
  ['Afundo caminhando','quadriceps','gluteo','livre','peso_corporal','Bodyweight_Walking_Lunge',
   'Passo à frente, desça até o joelho de trás quase tocar o chão.|Empurre com a perna da frente e traga a de trás.|Alterne as pernas a cada passo.',
   'Tronco reto. Inclinar pra frente transfere o trabalho pro glúteo e tira do quadríceps.'],
  ['Agachamento búlgaro','quadriceps','gluteo','halter','peso_reps','Split_Squat_with_Dumbbells',
   'Pé de trás apoiado num banco, pé da frente bem à frente.|Desça reto até o joelho de trás quase tocar.|Suba com a perna da frente.',
   'Quanto mais longe o pé da frente, mais glúteo. Perto demais e o joelho reclama.'],
  ['Agachamento goblet','quadriceps','gluteo','halter','peso_reps','Goblet_Squat',
   'Segure um halter na vertical junto ao peito.|Desça entre os joelhos mantendo o peito alto.|Suba empurrando o chão.',
   'O peso à frente força o tronco a ficar reto sozinho. É o melhor jeito de aprender a agachar fundo.'],
  ['Agachamento com halteres','quadriceps','gluteo','halter','peso_reps','Dumbbell_Squat',
   'Halteres ao lado do corpo, pés na largura do ombro.|Desça mantendo o peso no meio do pé.|Suba sem travar o joelho no topo.',
   'Substitui o agachamento livre quando não há barra ou quando a barra nas costas incomoda.'],
  ['Agachamento sumô com halter','quadriceps','gluteo','halter','peso_reps','Plie_Dumbbell_Squat',
   'Pés bem afastados, pontas pra fora, halter entre as pernas.|Desça reto, joelho na direção do pé.|Suba apertando o glúteo.',
   'A abertura joga a carga pra adutor e glúteo. Boa variação para quem já cansou de agachamento comum.'],
  ['Subida no banco com halteres','quadriceps','gluteo','halter','peso_reps','Dumbbell_Step_Ups',
   'Halteres nas mãos, pé inteiro no banco.|Suba sem dar impulso com a perna de baixo.|Desça controlando, sem pular.',
   'Se você precisa de impulso pra subir, o banco está alto demais.'],
  ['Afundo reverso com halteres','quadriceps','gluteo','halter','peso_reps','Dumbbell_Rear_Lunge',
   'Passo pra trás, desça até o joelho quase tocar.|Empurre com a perna da frente para voltar.|Alterne.',
   'Passo pra trás em vez de pra frente poupa o joelho. Primeira escolha para quem tem dor patelar.'],

  // ── PANTURRILHA ─────────────────────────────────────────────────────────
  ['Panturrilha com halteres','panturrilha','','halter','peso_reps','Standing_Dumbbell_Calf_Raise',
   'Ponta dos pés num degrau, halteres nas mãos.|Desça o calcanhar até esticar.|Suba o máximo e segure um instante.',
   'A amplitude embaixo vale mais que a carga. Calcanhar que não desce não treina panturrilha.'],
  ['Panturrilha no smith','panturrilha','','maquina','peso_reps','Smith_Machine_Calf_Raise',
   'Barra do smith no trapézio, ponta dos pés elevada.|Desça devagar.|Suba até o limite.',
   'O smith segura o equilíbrio, então dá pra usar carga alta sem cair.'],
  ['Burrinho','panturrilha','','maquina','peso_reps','Donkey_Calf_Raises',
   'Tronco inclinado à frente, apoio no aparelho.|Desça o calcanhar até esticar.|Suba contraindo.',
   'A inclinação do tronco alonga a panturrilha antes de contrair — pega a parte que a versão em pé deixa passar.'],
  ['Panturrilha no degrau','panturrilha','','livre','peso_corporal',null,
   'Ponta dos pés na quina de um degrau, calcanhar no ar.|Desça até esticar bem.|Suba na ponta e segure.',
   'Uma perna de cada vez quando as duas ficarem fáceis — é a progressão sem precisar de peso.'],

  // ── SUPERIORES SEM EQUIPAMENTO ──────────────────────────────────────────
  ['Flexão inclinada','peito','triceps,ombro','livre','peso_corporal','Incline_Push-Up',
   'Mãos apoiadas numa bancada ou mesa firme.|Desça o peito até quase encostar.|Empurre até esticar.',
   'Quanto mais alto o apoio, mais fácil. É assim que se chega na flexão no chão, não forçando a versão completa.'],
  ['Flexão com pés elevados','peito','ombro,triceps','livre','peso_corporal','Push-Ups_With_Feet_Elevated',
   'Pés num banco, mãos no chão pouco mais largas que o ombro.|Desça o peito até quase tocar.|Empurre sem deixar o quadril cair.',
   'A progressão da flexão quando o chão ficou fácil: sobe o pé, não a repetição.'],
  ['Remada invertida','costas','biceps,ombro','livre','peso_corporal','Inverted_Row',
   'Deite sob uma barra fixa baixa ou mesa firme, corpo reto.|Puxe o peito até a barra.|Desça controlando.',
   'Quanto mais horizontal o corpo, mais pesa. Andar com os pés pra frente é como aumentar carga.'],
  // ── CAMINHO PARA A BARRA FIXA ───────────────────────────────────────────
  //
  // Substituir barra fixa por puxada na polia resolve o treino de costas e
  // abandona o objetivo: puxada sentada não constrói barra fixa, porque nunca
  // exige sustentar o próprio peso. Estes dois exigem, com carga que dá para
  // dosar — são a ponte entre "faço 3" e "faço 8".
  ['Puxada assistida no graviton','costas','biceps','maquina','peso_reps','Band_Assisted_Pull-Up',
   'Ajuste o contrapeso: quanto MAIOR o peso escolhido, mais leve fica.|Joelhos no apoio, pegada pronada aberta.|Puxe até o peito na altura das mãos e desça até esticar.',
   'Comece com contrapeso que deixe fazer 8 boas e tire 5 kg por semana. Quando o contrapeso chegar a zero, é barra fixa.'],
  ['Barra fixa negativa','costas','biceps','livre','peso_reps','Pullups',
   'Suba com o banquinho ou com um pulo até o queixo passar a barra.|DESÇA em 5 segundos contados, sem soltar.|Volte ao banquinho e repita.',
   'A fase de descida aguenta mais carga que a de subida — é por isso que ela treina a barra fixa mesmo em quem ainda não sobe uma.'],

  // ── MÁQUINAS QUE FALTAVAM ───────────────────────────────────────────────
  //
  // "Prefiro máquinas" era uma preferência sem catálogo para atender: peito
  // tinha UM exercício de máquina (voador) e ombro tinha zero. Quem marcava a
  // opção recebia barra e halter do mesmo jeito, porque não havia alternativa
  // para oferecer. São todos aparelhos que existem em academia de rede.
  ['Supino máquina','peito','triceps,ombro','maquina','peso_reps','Leverage_Chest_Press',
   'Ajuste o banco para a pegada ficar na linha do meio do peito.|Empurre até quase estender.|Volte controlando, sem bater o peso.',
   'A trajetória é guiada, então dá para chegar perto da falha com segurança — é onde a máquina ganha do peso livre.'],
  ['Supino inclinado máquina','peito','ombro,triceps','maquina','peso_reps','Leverage_Incline_Chest_Press',
   'Encoste a lombar no apoio e mantenha os pés firmes.|Empurre em diagonal para cima.|Desça até sentir o peito abrir.',
   'Pega a parte de cima do peito, que é a que mais muda a aparência do tronco de camiseta.'],
  ['Supino máquina no smith','peito','triceps,ombro','maquina','peso_reps','Smith_Machine_Bench_Press',
   'Banco centralizado sob a barra guiada.|Desça até a linha do mamilo.|Empurre travando o quadril no banco.',
   'O smith segura o equilíbrio: bom substituto do supino livre quando não há quem observe a série.'],
  // Chamava-se "Crossover na polia baixa" e não era um crossover: a
  // demonstração (`Cable_Chest_Press`) é um SUPINO na polia, o cotovelo estende
  // e a classificação já dizia composto. Com o nome de crucifixo ele virava o
  // gêmeo confuso do "Crossover na polia" que existe logo acima — dois nomes
  // quase iguais, prescrições opostas, na mesma tela.
  ['Supino na polia','peito','triceps,ombro','cabo','peso_reps','Cable_Chest_Press',
   'Polias na altura do peito, um pé à frente para estabilizar.|Empurre as mãos para a frente até quase estender o cotovelo.|Volte devagar até sentir o peito alongar.',
   'A tensão não some no fim do movimento, coisa que barra e halter não fazem — é a vantagem do cabo sobre o supino comum.'],
  ['Desenvolvimento máquina','ombro','triceps','maquina','peso_reps','Leverage_Shoulder_Press',
   'Costas apoiadas, pegada na altura das orelhas.|Empurre para cima sem travar o cotovelo.|Desça até o cotovelo passar de 90°.',
   'Tira a estabilização do core da conta e deixa o ombro receber toda a carga.'],
  ['Desenvolvimento na polia','ombro','triceps','cabo','peso_reps','Seated_Cable_Shoulder_Press',
   'Sentado de frente para a polia alta ajustada baixa.|Empurre acima da cabeça.|Volte controlando.',
   'Alternativa quando a máquina de desenvolvimento está ocupada — a academia inteira usa uma, e o cabo quase sempre está livre.'],
  ['Crucifixo inverso na máquina','ombro','costas','maquina','peso_reps','Reverse_Machine_Flyes',
   'Peito apoiado, braços à frente na altura do ombro.|Abra para trás apertando as escápulas.|Volte sem deixar o peso cair.',
   'Ombro posterior é o que quase todo mundo esquece — e é ele que corrige postura de quem trabalha sentado.'],
  ['Remada máquina','costas','biceps','maquina','peso_reps','Leverage_Iso_Row',
   'Peito no apoio, pegada na largura do ombro.|Puxe levando o cotovelo para trás.|Solte até sentir a escápula abrir.',
   'Com o peito apoiado, a lombar sai da conta: dá para puxar pesado em dia de lombar cansada.'],
  ['Remada alta na máquina','costas','ombro','maquina','peso_reps','Leverage_High_Row',
   'Puxada em diagonal de cima para baixo, peito apoiado.|Leve o cotovelo para trás e para baixo.|Volte controlando.',
   'Ângulo entre puxada e remada — pega a parte do dorsal que nenhuma das duas cobre inteira.'],
  ['Rosca na máquina','biceps','antebraco','maquina','peso_reps','Machine_Bicep_Curl',
   'Braços apoiados no suporte, pegada supinada.|Flexione até o topo.|Desça devagar, sem deixar o peso puxar.',
   'O apoio impede roubar com o tronco, que é o erro mais comum de rosca com barra.'],
  ['Rosca scott na polia','biceps','antebraco','cabo','peso_reps','Cable_Preacher_Curl',
   'Braços sobre o banco inclinado, polia baixa à frente.|Flexione sem tirar o cotovelo do apoio.|Desça até esticar.',
   'Braço à frente do corpo encurta o bíceps no início: complementa a rosca em pé, não repete.'],
  ['Rosca martelo na corda','biceps','antebraco','cabo','peso_reps','Cable_Hammer_Curls_-_Rope_Attachment',
   'Corda na polia baixa, pegada neutra.|Flexione mantendo os punhos firmes.|Desça controlando.',
   'Pegada neutra pega o braquial, que empurra o bíceps para cima e engrossa o braço visto de frente.'],
  ['Tríceps na máquina','triceps','','maquina','peso_reps','Machine_Triceps_Extension',
   'Costas apoiadas, cotovelo alinhado com o eixo do aparelho.|Estenda até travar de leve.|Volte devagar.',
   'Boa para fechar o treino: dá para chegar perto da falha sem precisar de quem segure o peso.'],
  ['Encolhimento na polia','trapezio','','cabo','peso_reps','Cable_Shrugs',
   'Barra ou corda na polia baixa, braços estendidos.|Suba os ombros em direção às orelhas.|Desça devagar até esticar.',
   'A polia mantém tensão embaixo, onde o trapézio mais estica — halter alivia nessa parte.'],
  ['Agachamento no smith','quadriceps','gluteo','maquina','peso_reps','Smith_Machine_Squat',
   'Barra guiada nas costas, pés um pouco à frente.|Desça até a coxa passar da paralela.|Suba empurrando o chão.',
   'A guia tira o equilíbrio da conta e deixa descer mais fundo — bom para quem ainda não confia no agachamento livre.'],
  ['Cadeira adutora','quadriceps','gluteo','maquina','peso_reps','Thigh_Adductor',
   'Sentado, joelhos abertos contra os apoios.|Junte as pernas contraindo a parte interna.|Volte devagar.',
   'Adutor entra em toda passada e todo agachamento aberto — treiná-lo direto reduz lesão de virilha.'],

  ['Flexão pique','ombro','triceps','livre','peso_corporal',null,
   'Em V invertido, quadril alto, mãos e pés no chão.|Desça a cabeça em direção ao chão entre as mãos.|Empurre de volta.',
   'O único jeito honesto de treinar ombro sem nenhum equipamento. Quanto mais alto o quadril, mais vira ombro e menos peito.'],
];
