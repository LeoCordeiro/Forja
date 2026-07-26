/**
 * Medalhas.
 *
 * `criterio` é JSON de propósito: dá pra inventar medalha nova mexendo só
 * aqui, sem tocar em nenhuma tela. O avaliador vive em features/gamificacao.
 *
 * Tipos de critério suportados:
 *   treinos_total | prs_total | streak | volume_sessao | volume_total
 *   dieta_dias | medidas_total | nivel | exercicios_distintos | horario_antes
 *   horario_depois
 */

/** [code, nome, descrição, emoji, tier, pontos, criterio] */
type A = [string, string, string, string, 'bronze' | 'prata' | 'ouro' | 'diamante', number, object];

export const CONQUISTAS: A[] = [
  // ── BRONZE — as primeiras horas de uso ──────────────────────────────────
  ['primeiro_treino', 'Primeira Forjada', 'Conclua seu primeiro treino', '🔨', 'bronze', 25,
    { tipo: 'treinos_total', meta: 1 }],
  ['primeira_medida', 'Ponto de Partida', 'Registre seu peso pela primeira vez', '📍', 'bronze', 15,
    { tipo: 'medidas_total', meta: 1 }],
  ['primeiro_pr', 'Marca Registrada', 'Bata seu primeiro recorde pessoal', '🎯', 'bronze', 30,
    { tipo: 'prs_total', meta: 1 }],
  ['streak_3', 'Pegando o Ritmo', 'Treine 3 dias seguidos', '🔥', 'bronze', 25,
    { tipo: 'streak', meta: 3 }],
  ['dieta_1', 'Dieta em Dia', 'Bata sua meta de calorias em um dia', '🥗', 'bronze', 20,
    { tipo: 'dieta_dias', meta: 1 }],
  ['exercicios_10', 'Explorador', 'Execute 10 exercícios diferentes', '🧭', 'bronze', 25,
    { tipo: 'exercicios_distintos', meta: 10 }],
  ['treinos_10', 'Constante', 'Conclua 10 treinos', '💪', 'bronze', 40,
    { tipo: 'treinos_total', meta: 10 }],

  // ── PRATA — o hábito se formando ────────────────────────────────────────
  ['streak_7', 'Semana Cheia', 'Treine 7 dias seguidos', '🔥', 'prata', 70,
    { tipo: 'streak', meta: 7 }],
  ['treinos_25', 'Disciplinado', 'Conclua 25 treinos', '🏋️', 'prata', 75,
    { tipo: 'treinos_total', meta: 25 }],
  ['prs_10', 'Quebrador', 'Bata 10 recordes pessoais', '⚡', 'prata', 80,
    { tipo: 'prs_total', meta: 10 }],
  ['volume_5t', 'Cinco Toneladas', 'Levante 5.000 kg num único treino', '🗿', 'prata', 70,
    { tipo: 'volume_sessao', meta: 5000 }],
  ['dieta_7', 'Semana Limpa', 'Bata sua meta de calorias por 7 dias', '🥦', 'prata', 70,
    { tipo: 'dieta_dias', meta: 7 }],
  ['madrugador', 'Antes do Sol', 'Comece um treino antes das 7h', '🌅', 'prata', 50,
    { tipo: 'horario_antes', meta: 7 }],
  ['noturno', 'Turno da Noite', 'Comece um treino depois das 22h', '🌙', 'prata', 50,
    { tipo: 'horario_depois', meta: 22 }],
  ['medidas_5', 'Sob Controle', 'Registre suas medidas 5 vezes', '📏', 'prata', 45,
    { tipo: 'medidas_total', meta: 5 }],
  ['nivel_5', 'Nível 5', 'Alcance o nível 5', '⭐', 'prata', 50,
    { tipo: 'nivel', meta: 5 }],

  // ── OURO — já é estilo de vida ──────────────────────────────────────────
  ['treinos_50', 'Meio Século', 'Conclua 50 treinos', '🏅', 'ouro', 150,
    { tipo: 'treinos_total', meta: 50 }],
  ['streak_30', 'Mês Inteiro', 'Treine 30 dias seguidos', '🔥', 'ouro', 200,
    { tipo: 'streak', meta: 30 }],
  ['prs_25', 'Máquina de Recorde', 'Bata 25 recordes pessoais', '🚀', 'ouro', 180,
    { tipo: 'prs_total', meta: 25 }],
  ['volume_10t', 'Dez Toneladas', 'Levante 10.000 kg num único treino', '🦾', 'ouro', 150,
    { tipo: 'volume_sessao', meta: 10000 }],
  ['dieta_30', 'Mês Limpo', 'Bata sua meta de calorias por 30 dias', '🍽️', 'ouro', 180,
    { tipo: 'dieta_dias', meta: 30 }],
  ['volume_100t', 'Cem Toneladas', 'Acumule 100.000 kg levantados', '⛰️', 'ouro', 200,
    { tipo: 'volume_total', meta: 100000 }],
  ['nivel_10', 'Nível 10', 'Alcance o nível 10', '🌟', 'ouro', 150,
    { tipo: 'nivel', meta: 10 }],

  // ── DIAMANTE — pouca gente chega ────────────────────────────────────────
  ['treinos_100', 'Centenário', 'Conclua 100 treinos', '💎', 'diamante', 400,
    { tipo: 'treinos_total', meta: 100 }],
  ['streak_100', 'Inabalável', 'Treine 100 dias seguidos', '🧊', 'diamante', 500,
    { tipo: 'streak', meta: 100 }],
  ['volume_500t', 'Meio Milhão', 'Acumule 500.000 kg levantados', '🌋', 'diamante', 500,
    { tipo: 'volume_total', meta: 500000 }],
  ['nivel_20', 'Forjado no Fogo', 'Alcance o nível 20', '👑', 'diamante', 500,
    { tipo: 'nivel', meta: 20 }],
];

/** Rotinas prontas para não começar com o app vazio. */
export const ROTINAS_PADRAO = [
  {
    nome: 'Push / Pull / Legs',
    descricao: 'Clássico de 3 dias. Empurrar, puxar, pernas.',
    dias: [
      {
        // Ordem: composto pesado → composto → isolador → cardio no fim.
        nome: 'A — Peito, Ombro e Tríceps',
        cor: '#FF5A1F',
        exercicios: [
          ['Supino reto com barra', 4, 6, 10, 180],
          ['Supino inclinado com halteres', 3, 8, 12, 150],
          ['Desenvolvimento com halteres', 3, 8, 12, 150],
          ['Crossover na polia', 3, 12, 15, 90],
          ['Elevação lateral', 4, 12, 15, 60],
          ['Tríceps na polia com corda', 3, 10, 15, 90],
          ['Tríceps francês', 3, 10, 12, 90],
          ['Bicicleta ergométrica', 1, 0, 0, 0],
        ],
      },
      {
        nome: 'B — Costas e Bíceps',
        cor: '#3B9EFF',
        exercicios: [
          ['Barra fixa', 4, 6, 10, 180],
          ['Remada curvada com barra', 4, 8, 10, 150],
          ['Puxada frontal na polia', 3, 10, 12, 150],
          ['Remada baixa na polia', 3, 10, 12, 150],
          ['Face pull', 3, 15, 20, 60],
          ['Rosca direta com barra', 3, 8, 12, 90],
          ['Rosca martelo', 3, 10, 12, 90],
          ['Elíptico', 1, 0, 0, 0],
        ],
      },
      {
        nome: 'C — Pernas completo',
        cor: '#00D68F',
        exercicios: [
          ['Agachamento livre', 4, 6, 10, 180],
          ['Leg press', 3, 10, 15, 180],
          ['Levantamento terra romeno', 3, 8, 12, 180],
          ['Cadeira extensora', 3, 12, 15, 90],
          ['Mesa flexora', 3, 10, 15, 90],
          ['Panturrilha em pé', 4, 12, 20, 60],
          ['Prancha', 3, 0, 0, 60],
        ],
      },
    ],
  },
  {
    nome: 'Retomada — 3 dias',
    descricao: 'Full body para voltar depois de uma pausa. Volume menor, corpo todo 3× na semana.',
    dias: [
      {
        nome: 'A — Corpo todo',
        cor: '#00D68F',
        exercicios: [
          ['Agachamento livre', 3, 8, 12, 150],
          ['Supino reto com halteres', 3, 8, 12, 120],
          ['Remada curvada com barra', 3, 8, 12, 120],
          ['Desenvolvimento com halteres', 2, 10, 12, 90],
          ['Rosca direta com barra', 2, 10, 12, 60],
          ['Prancha', 3, 0, 0, 60],
          ['Bicicleta ergométrica', 1, 0, 0, 0],
        ],
      },
      {
        nome: 'B — Corpo todo',
        cor: '#3B9EFF',
        exercicios: [
          ['Leg press', 3, 10, 15, 150],
          ['Puxada frontal na polia', 3, 8, 12, 120],
          ['Supino inclinado com halteres', 3, 8, 12, 120],
          ['Elevação lateral', 3, 12, 15, 60],
          ['Tríceps na polia com corda', 2, 10, 15, 60],
          ['Mesa flexora', 3, 10, 15, 90],
          ['Esteira', 1, 0, 0, 0],
        ],
      },
      {
        nome: 'C — Corpo todo',
        cor: '#A97BFF',
        exercicios: [
          ['Levantamento terra romeno', 3, 8, 12, 150],
          ['Remada baixa na polia', 3, 10, 12, 120],
          ['Crossover na polia', 3, 12, 15, 90],
          ['Cadeira extensora', 3, 12, 15, 60],
          ['Rosca martelo', 2, 10, 12, 60],
          ['Panturrilha em pé', 3, 12, 20, 45],
          ['Elíptico', 1, 0, 0, 0],
        ],
      },
    ],
  },
  {
    nome: 'Cardio e condicionamento',
    descricao: 'Sessões de cardio separadas, para fazer em dia alternado ao treino de força.',
    dias: [
      {
        nome: 'Zona 2 — 35 min',
        cor: '#FFB020',
        exercicios: [
          ['Bicicleta ergométrica', 1, 0, 0, 0],
          ['Prancha', 3, 0, 0, 60],
          ['Prancha lateral', 2, 0, 0, 45],
        ],
      },
      {
        nome: 'Intervalado — 20 min',
        cor: '#FF4757',
        exercicios: [
          ['Esteira', 1, 0, 0, 0],
          ['Escalador', 4, 0, 0, 60],
          ['Abdominal supra', 3, 15, 20, 45],
        ],
      },
    ],
  },
  {
    nome: 'Upper / Lower',
    descricao: 'Quatro dias. Superiores e inferiores alternados.',
    dias: [
      {
        nome: 'A — Superiores (força)',
        cor: '#A97BFF',
        exercicios: [
          ['Supino reto com barra', 5, 4, 6, 180],
          ['Remada curvada com barra', 4, 5, 8, 180],
          ['Desenvolvimento militar', 4, 5, 8, 180],
          ['Barra fixa', 3, 6, 10, 180],
          ['Supino fechado', 3, 8, 10, 150],
          ['Rosca direta com barra', 3, 8, 10, 90],
        ],
      },
      {
        nome: 'B — Inferiores (força)',
        cor: '#FFB020',
        exercicios: [
          ['Agachamento livre', 5, 4, 6, 210],
          ['Levantamento terra', 3, 4, 6, 210],
          ['Afundo com halteres', 3, 10, 12, 120],
          ['Mesa flexora', 3, 10, 12, 90],
          ['Panturrilha em pé', 4, 12, 15, 60],
        ],
      },
    ],
  },
];
