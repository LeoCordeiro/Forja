export type Genero = 'masculino' | 'feminino' | 'outro';
export type Objetivo = 'hipertrofia' | 'emagrecimento' | 'manutencao' | 'recomposicao';
export type Experiencia = 'iniciante' | 'intermediario' | 'avancado';
export type Papel = 'aluno' | 'personal';
export type NivelAtividade = 'sedentario' | 'leve' | 'moderado' | 'intenso' | 'atleta';
export type TipoCarga = 'peso_reps' | 'peso_corporal' | 'tempo' | 'distancia';
export type TipoSerie = 'normal' | 'aquecimento' | 'drop' | 'falha';
export type TipoPR = 'carga_max' | 'reps_max' | 'volume_serie' | 'e1rm';
export type TipoRefeicao =
  | 'cafe'
  | 'lanche_manha'
  | 'almoco'
  | 'lanche_tarde'
  | 'jantar'
  | 'ceia';
export type Tier = 'bronze' | 'prata' | 'ouro' | 'diamante';

export interface Profile {
  id: 1;
  nome: string;
  data_nascimento: string;
  genero: Genero;
  altura_cm: number;
  nivel_atividade: NivelAtividade;
  objetivo: Objetivo;
  peso_meta_kg: number | null;
  onboarding_completo: number;
  criado_em: number;
  /** TMB da bioimpedância. Quando existe, vale mais que a estimativa por fórmula. */
  tmb_medido_kcal: number | null;
  usa_tmb_medido: number;
  meta_agua_ml: number | null;
  /** 'livre' | 'maquina' | 'ambos' — inclina a seleção, não filtra. */
  preferencia_equipamento: string | null;
  /** Diagnóstico — cada campo altera a prescrição. */
  incomodo: string | null;
  onde_acumula: string | null;
  desistencia: string | null;
  /** CSV de regiões com dor. */
  dores: string | null;
  minutos_sessao: number | null;
  passos_alvo: number | null;
  cardio_sessoes: number | null;
  /** CSV de 7 números, domingo a sábado, em minutos. */
  minutos_por_dia: string | null;
  lembretes_ativos: number;
  lembrete_medida: number;
  gordura_meta_pct: number | null;
  experiencia: Experiencia;
  dias_treino_semana: number;
  /** Data em que voltou a treinar — âncora do plano de readaptação. */
  retomou_em: string | null;
  meses_parado: number;
  papel: Papel;
  /** Horário do treino: define o timing das refeições. */
  horario_treino: string;
  hora_acorda: string;
  hora_dorme: string;
  hora_treino: string | null;
  /** Onde treina — decide quais exercícios sequer entram no plano. */
  local_treino: string;
  /** CSV de índices de dia da semana (0 = domingo) que a pessoa consegue treinar. */
  dias_disponiveis: string | null;
  /** Grupo muscular a priorizar. Acrescenta séries, nunca tira de outro. */
  enfase: string | null;
}

export interface BodyMetric {
  id: number;
  medido_em: string;
  peso_kg: number | null;
  gordura_pct: number | null;
  cintura_cm: number | null;
  peito_cm: number | null;
  quadril_cm: number | null;
  braco_cm: number | null;
  coxa_cm: number | null;
  foto_uri: string | null;
  criado_em: number;
  /** Campos que só a bioimpedância fornece. */
  gordura_visceral: number | null;
  musculo_pct: number | null;
  idade_corporal: number | null;
  tmb_kcal: number | null;
  agua_pct: number | null;
  origem: string;
}

export interface FoodPref {
  id: number;
  tipo: 'gosta' | 'evita' | 'alergia';
  categoria: string | null;
  termo: string;
}

export interface DietConfig {
  id: 1;
  restricao: string;
  tempo_max_preparo: number;
  refeicoes_por_dia: number;
  cozinha_de_verdade: number;
  atualizado_em: number;
  /** maxima | marmita | equilibrado | gosto_cozinhar */
  praticidade: string;
  /** apertado | medio | confortavel */
  orcamento: string;
  faz_marmita: number;
  dias_marmita: number;
}

export interface Perfil {
  id: number;
  nome: string;
  emoji: string;
  papel: Papel;
  ativo: number;
  criado_em: number;
}

export interface NutritionTarget {
  id: number;
  valid_from: string;
  kcal: number;
  proteina_g: number;
  carbo_g: number;
  gordura_g: number;
  origem: string;
}

export interface Exercise {
  id: number;
  nome: string;
  grupo_primario: string;
  grupos_secundarios: string;
  equipamento: string | null;
  tipo_carga: TipoCarga;
  media_url: string | null;
  instrucoes: string | null;
  dica: string | null;
  is_custom: number;
  favorito: number;
}

export interface Routine {
  id: number;
  nome: string;
  descricao: string | null;
  ativa: number;
  criado_em: number;
}

export interface RoutineDay {
  id: number;
  routine_id: number;
  nome: string;
  cor: string | null;
  ordem: number;
  /** Dia da semana marcado, 0 = domingo. Nulo = ainda sem dia. */
  dia_semana: number | null;
  tipo: string;
  foco: string | null;
}

export interface RoutineExercise {
  id: number;
  routine_day_id: number;
  exercise_id: number;
  ordem: number;
  series_alvo: number;
  reps_min: number | null;
  reps_max: number | null;
  descanso_seg: number;
  superset_grupo: number | null;
  observacao: string | null;
}

/** routine_exercises + os campos do exercício, como a tela de execução precisa. */
export interface RoutineExerciseFull extends RoutineExercise {
  nome: string;
  grupo_primario: string;
  equipamento: string | null;
  tipo_carga: TipoCarga;
  media_url: string | null;
  instrucoes: string | null;
  dica: string | null;
}

export interface WorkoutSession {
  id: number;
  routine_day_id: number | null;
  nome: string;
  iniciado_em: number;
  finalizado_em: number | null;
  volume_total_kg: number;
  sensacao: number | null;
  notas: string | null;
}

export interface SetLog {
  id: number;
  session_id: number;
  exercise_id: number;
  ordem_exercicio: number;
  serie_index: number;
  peso_kg: number | null;
  reps: number | null;
  duracao_seg: number | null;
  distancia_m: number | null;
  rpe: number | null;
  tipo: TipoSerie;
  concluida: number;
  registrado_em: number;
}

export interface PersonalRecord {
  id: number;
  exercise_id: number;
  tipo: TipoPR;
  valor: number;
  valor_anterior: number | null;
  peso_kg: number | null;
  reps: number | null;
  set_log_id: number | null;
  session_id: number | null;
  atingido_em: number;
  celebrado: number;
}

export interface Food {
  id: number;
  nome: string;
  marca: string | null;
  fonte: string;
  barcode: string | null;
  porcao_base_g: number;
  kcal: number;
  proteina_g: number;
  carbo_g: number;
  gordura_g: number;
  fibra_g: number | null;
  categoria: string | null;
  medida_caseira: string | null;
  g_por_medida: number | null;
}

export interface Recipe {
  id: number;
  nome: string;
  rendimento_porcoes: number;
  tempo_preparo_min: number | null;
  dificuldade: number | null;
  foto_uri: string | null;
  is_custom: number;
}

export interface RecipeStep {
  id: number;
  recipe_id: number;
  ordem: number;
  texto: string;
  tempo_seg: number | null;
}

export interface RecipeIngredientFull {
  id: number;
  recipe_id: number;
  food_id: number;
  quantidade: number;
  unidade: string;
  observacao: string | null;
  nome: string;
  kcal: number;
  proteina_g: number;
  carbo_g: number;
  gordura_g: number;
  categoria: string | null;
}

export interface PlanMeal {
  id: number;
  diet_plan_id: number;
  dia_semana: number;
  tipo: TipoRefeicao;
  horario: string | null;
}

export interface MealLog {
  id: number;
  data: string;
  tipo: TipoRefeicao;
  plan_meal_id: number | null;
  registrado_em: number;
}

export interface MealLogItem {
  id: number;
  meal_log_id: number;
  food_id: number | null;
  recipe_id: number | null;
  nome_snap: string;
  quantidade: number;
  unidade: string;
  kcal_snap: number;
  prot_snap: number;
  carb_snap: number;
  gord_snap: number;
}

export interface AchievementDef {
  code: string;
  nome: string;
  descricao: string;
  icone: string;
  tier: Tier;
  pontos: number;
  criterio: string;
}

export interface AchievementFull extends AchievementDef {
  progresso: number;
  meta: number;
  desbloqueado_em: number | null;
  celebrado: number;
}

export interface UserStats {
  id: 1;
  xp_total: number;
  nivel: number;
  streak_atual: number;
  maior_streak: number;
  ultima_atividade: string | null;
  freezes_disponiveis: number;
}

export interface ShoppingListItem {
  id: number;
  lista_id: number;
  food_id: number | null;
  nome: string;
  quantidade_total: number;
  unidade: string;
  categoria: string | null;
  comprado: number;
}

/** Macros agregados — usado em várias telas, sempre a mesma forma. */
export interface Macros {
  kcal: number;
  proteina_g: number;
  carbo_g: number;
  gordura_g: number;
}
