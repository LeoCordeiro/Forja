import { all, first, run } from '@/db/client';
import { hoje } from '@/shared/utils/date';
import type { BodyMetric } from '@/db/types';

/**
 * Foto de progresso.
 *
 * ── Por que foto, e não a balança ────────────────────────────────────────
 *
 * Recomposição — perder gordura e ganhar músculo ao mesmo tempo — é justamente
 * o caso em que a balança mente. Músculo e gordura têm densidades diferentes:
 * trocar 3 kg de um pelo outro muda o corpo inteiro e não move o ponteiro. Some
 * a isso a variação diária de água, glicogênio e intestino, que é maior que a
 * mudança real de uma semana inteira, e a balança vira ruído com aparência de
 * dado.
 *
 * Foto e fita métrica medem o que a balança não vê. E entre as duas, a foto é a
 * que a pessoa acredita — número na tela não convence ninguém que está se
 * olhando no espelho todo dia e não percebendo diferença.
 *
 * ── Por que 4 semanas, e não toda semana ─────────────────────────────────
 *
 * Perda de gordura sustentável fica em 0,5 % a 1 % do peso por semana. Para
 * quem tem 90 kg, é meio quilo. Meio quilo distribuído no corpo inteiro é
 * invisível numa foto — e fica soterrado por luz, ângulo, postura e o quanto se
 * bebeu de água.
 *
 * Comparar fotos de 7 dias ensina que nada funciona. Comparar de 28 dias mostra
 * o que de fato aconteceu. A cadência não é preguiça: é a distância mínima em
 * que o sinal fica maior que o ruído.
 *
 * ── Por que as condições importam mais que a câmera ──────────────────────
 *
 * Duas fotos tiradas em luzes diferentes comparam luz, não corpo. Luz de cima
 * cria sombra no abdômen e inventa definição; luz de frente apaga. Por isso o
 * app guarda o enquadramento anterior e o mostra por cima da câmera: alinhar a
 * silhueta resolve distância, altura e postura de uma vez.
 *
 * ── Onde as fotos ficam ──────────────────────────────────────────────────
 *
 * No aparelho, dentro do banco do app. Não sobem para servidor nenhum, não vão
 * para a liga, não entram em compartilhamento. A liga manda apelido, data e
 * pontos — nada além disso.
 */

/** Intervalo entre registros. Menos que isso compara ruído. */
export const INTERVALO_DIAS = 28;

/** Altura máxima em pixels. 1280 mostra tudo que a comparação precisa. */
const ALTURA_MAX = 1280;
/** Compressão. 0,6 mantém contorno e corta ~70 % do tamanho. */
export const QUALIDADE = 0.6;

export interface Angulo {
  chave: 'frente' | 'lado' | 'costas';
  titulo: string;
  emoji: string;
  /** O que este ângulo mostra que os outros não mostram. */
  mostra: string;
  comoPosar: string;
}

export const ANGULOS: Angulo[] = [
  {
    chave: 'frente',
    titulo: 'De frente',
    emoji: '🧍',
    mostra: 'Largura do ombro contra a da cintura — o formato que mais muda com treino de força.',
    comoPosar: 'Braços soltos ao lado do corpo, pés na largura do quadril, ombro relaxado.',
  },
  {
    chave: 'lado',
    titulo: 'De lado',
    emoji: '🧍‍♂️',
    mostra: 'Abdômen de perfil. É aqui que a barriga aparece de verdade, e onde a gordura visceral dá as caras.',
    comoPosar: 'Perfil completo, braços atrás ou soltos. Postura normal — nem estufando, nem encolhendo.',
  },
  {
    chave: 'costas',
    titulo: 'De costas',
    emoji: '🔙',
    mostra: 'Dorsal e a forma em V. Costas é o grupo que mais cresce sem a pessoa perceber, porque ninguém se vê de costas.',
    comoPosar: 'Braços soltos, ombro para trás sem forçar.',
  },
];

/**
 * As condições que fazem a comparação valer.
 *
 * Não é preciosismo: é o que separa "medir o corpo" de "medir a iluminação da
 * cozinha".
 */
export const CONDICOES = [
  {
    titulo: 'Mesma hora do dia',
    detalhe: 'De manhã, em jejum, antes de beber água. À noite todo mundo está mais inchado.',
  },
  {
    titulo: 'Mesmo lugar e mesma luz',
    detalhe: 'Luz de cima cria sombra no abdômen e inventa definição que não existe.',
  },
  {
    titulo: 'Relaxado, nunca contraído',
    detalhe: 'Contração varia com o esforço do dia. Relaxado é reprodutível — e é o corpo que você tem.',
  },
  {
    titulo: 'Mesma roupa',
    detalhe: 'Roupa que não esconde a cintura. Trocar a peça muda o contorno e você compara o tecido.',
  },
];

export interface FotoProgresso {
  id: number;
  data: string;
  angulo: string;
  imagem: string;
  largura: number | null;
  altura: number | null;
  criado_em: number;
}

// ── Captura ───────────────────────────────────────────────────────────────

/**
 * Reduz a imagem antes de guardar.
 *
 * Uma foto de celular moderna tem 12 MP e passa de 3 MB. Trinta fotos assim são
 * 100 MB dentro do banco, e o banco é justamente o que precisa caber num
 * backup. Em 1280 px de altura ainda dá para ver contorno de abdômen e ombro,
 * que é tudo que a comparação usa.
 */
export async function reduzir(uri: string): Promise<{ base64: string; largura: number; altura: number } | null> {
  try {
    const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');
    const r = await manipulateAsync(uri, [{ resize: { height: ALTURA_MAX } }], {
      compress: QUALIDADE,
      format: SaveFormat.JPEG,
      base64: true,
    });
    if (!r.base64) return null;
    return { base64: `data:image/jpeg;base64,${r.base64}`, largura: r.width, altura: r.height };
  } catch {
    return null;
  }
}

/**
 * Escolher uma foto que já existe na galeria — serve para trazer o "antes".
 *
 * Tenta abrir direto antes de pedir permissão: no Android 13 em diante o
 * seletor do sistema não exige acesso à galeria inteira, e pedir por hábito
 * mostraria uma caixa de permissão desnecessária — que é como se ensina alguém
 * a negar tudo sem ler.
 */
export async function escolherDaGaleria(): Promise<string | null> {
  const ImagePicker = await import('expo-image-picker');

  const abrir = () =>
    ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      allowsMultipleSelection: false,
    });

  try {
    const r = await abrir();
    if (r.canceled || !r.assets?.length) return null;
    return r.assets[0].uri;
  } catch {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return null;
      const r = await abrir();
      if (r.canceled || !r.assets?.length) return null;
      return r.assets[0].uri;
    } catch {
      return null;
    }
  }
}

// ── Persistência ──────────────────────────────────────────────────────────

export async function salvarFoto(
  angulo: string,
  imagem: string,
  dim?: { largura: number; altura: number },
  data = hoje()
) {
  await run(
    `INSERT INTO fotos_progresso (data, angulo, imagem, largura, altura, criado_em)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT(data, angulo) DO UPDATE SET
       imagem = excluded.imagem,
       largura = excluded.largura,
       altura = excluded.altura,
       criado_em = excluded.criado_em`,
    [data, angulo, imagem, dim?.largura ?? null, dim?.altura ?? null, Date.now()]
  );
}

export async function apagarFoto(id: number) {
  await run('DELETE FROM fotos_progresso WHERE id = ?', [id]);
}

export async function fotosDoAngulo(angulo: string): Promise<FotoProgresso[]> {
  return all<FotoProgresso>(
    'SELECT * FROM fotos_progresso WHERE angulo = ? ORDER BY data DESC',
    [angulo]
  );
}

export async function ultimaDoAngulo(angulo: string): Promise<FotoProgresso | null> {
  return first<FotoProgresso>(
    'SELECT * FROM fotos_progresso WHERE angulo = ? ORDER BY data DESC LIMIT 1',
    [angulo]
  );
}

export async function contarFotos(): Promise<number> {
  const r = await first<{ n: number }>('SELECT COUNT(*) AS n FROM fotos_progresso');
  return r?.n ?? 0;
}

/** Datas distintas com pelo menos uma foto, da mais nova para a mais velha. */
export async function datasComFoto(): Promise<string[]> {
  const r = await all<{ data: string }>(
    'SELECT DISTINCT data FROM fotos_progresso ORDER BY data DESC'
  );
  return r.map((x) => x.data);
}

export async function fotosDaData(data: string): Promise<FotoProgresso[]> {
  return all<FotoProgresso>('SELECT * FROM fotos_progresso WHERE data = ?', [data]);
}

// ── Cadência ──────────────────────────────────────────────────────────────

export interface EstadoCadencia {
  temFoto: boolean;
  ultimaData: string | null;
  diasDesde: number;
  /** Já passou o intervalo — vale registrar. */
  naHora: boolean;
  diasFaltando: number;
  mensagem: string;
}

export async function estadoDaCadencia(): Promise<EstadoCadencia> {
  const datas = await datasComFoto();
  if (!datas.length) {
    return {
      temFoto: false,
      ultimaData: null,
      diasDesde: 0,
      naHora: true,
      diasFaltando: 0,
      mensagem:
        'A primeira foto é a mais importante e a que ninguém quer tirar. Ela não é para mostrar ' +
        'para alguém — é o ponto zero contra o qual todas as outras vão valer alguma coisa.',
    };
  }

  const ultima = datas[0];
  const dias = Math.floor((Date.now() - new Date(`${ultima}T12:00:00`).getTime()) / 86400000);
  const naHora = dias >= INTERVALO_DIAS;

  return {
    temFoto: true,
    ultimaData: ultima,
    diasDesde: dias,
    naHora,
    diasFaltando: Math.max(0, INTERVALO_DIAS - dias),
    mensagem: naHora
      ? `Faz ${dias} dias desde a última. Já dá para comparar de verdade.`
      : `Última foi há ${dias} dia${dias === 1 ? '' : 's'}. Faltam ${INTERVALO_DIAS - dias} para a diferença ` +
        `sair do ruído — antes disso você compara luz e postura, não corpo.`,
  };
}

// ── Comparação ────────────────────────────────────────────────────────────

export interface Comparacao {
  angulo: string;
  antes: FotoProgresso;
  depois: FotoProgresso;
  semanas: number;
  deltaPeso: number | null;
  deltaCintura: number | null;
  /** Leitura honesta do que os números dizem em conjunto. */
  leitura: string;
}

/**
 * Encontra a medida mais próxima da data da foto.
 *
 * Janela de 7 dias: ninguém se pesa exatamente no dia da foto, e medida de duas
 * semanas antes já não descreve aquele corpo.
 */
function maisProxima(medidas: BodyMetric[], data: string): BodyMetric | null {
  const alvo = new Date(`${data}T12:00:00`).getTime();
  let melhor: BodyMetric | null = null;
  let menor = Infinity;
  for (const m of medidas) {
    const d = Math.abs(new Date(`${m.medido_em}T12:00:00`).getTime() - alvo);
    if (d < menor && d <= 7 * 86400000) {
      menor = d;
      melhor = m;
    }
  }
  return melhor;
}

/**
 * Lê peso e cintura juntos.
 *
 * Separados, cada um engana. Peso parado com cintura caindo é exatamente o que
 * recomposição parece — e é o cenário em que a pessoa desiste achando que
 * falhou, porque só olhou a balança.
 */
/** Número em português: vírgula decimal. */
const n1 = (v: number) => Math.abs(v).toFixed(1).replace('.', ',');

function lerNumeros(dPeso: number | null, dCintura: number | null, semanas: number): string {
  const p = dPeso ?? 0;
  const c = dCintura ?? 0;
  const temPeso = dPeso !== null;
  const temCintura = dCintura !== null;

  if (!temPeso && !temCintura) {
    return `${semanas} semanas entre as duas fotos. Registrar peso e cintura junto com a foto dá o número por trás do que você está vendo.`;
  }

  if (temCintura && c <= -1.5 && temPeso && Math.abs(p) < 1) {
    return `Cintura ${n1(c)} cm menor com o peso praticamente igual. Isso é recomposição — e é o resultado que a balança sozinha teria chamado de fracasso.`;
  }
  if (temCintura && c <= -1.5 && temPeso && p > 0) {
    return `Você ganhou ${n1(p)} kg e perdeu ${n1(c)} cm de cintura. Peso subindo com cintura descendo é músculo entrando enquanto gordura sai.`;
  }
  if (temPeso && p <= -1.5 && temCintura && c > -0.5) {
    return `Peso caiu ${n1(p)} kg mas a cintura ficou igual. Vale conferir proteína e volume de treino: perder peso sem perder cintura costuma significar que parte do que saiu era massa magra.`;
  }
  if (temPeso && p <= -1.5) {
    return `${n1(p)} kg a menos${temCintura ? ` e ${n1(c)} cm de cintura` : ''} em ${semanas} semanas. Ritmo dentro do sustentável.`;
  }
  if (temCintura && c <= -1) {
    return `${n1(c)} cm de cintura em ${semanas} semanas.`;
  }
  return `${semanas} semanas. Os números mudaram pouco — a foto diz se o formato mudou, que é a parte que eles não capturam.`;
}

export async function compararAngulo(angulo: string): Promise<Comparacao | null> {
  const fotos = await fotosDoAngulo(angulo);
  if (fotos.length < 2) return null;

  const depois = fotos[0];
  const antes = fotos[fotos.length - 1];

  const medidas = await all<BodyMetric>('SELECT * FROM body_metrics ORDER BY medido_em');
  const mA = maisProxima(medidas, antes.data);
  const mD = maisProxima(medidas, depois.data);

  const dias = Math.round(
    (new Date(`${depois.data}T12:00:00`).getTime() - new Date(`${antes.data}T12:00:00`).getTime()) /
      86400000
  );
  const semanas = Math.max(1, Math.round(dias / 7));

  const deltaPeso = mA?.peso_kg != null && mD?.peso_kg != null ? mD.peso_kg - mA.peso_kg : null;
  const deltaCintura =
    mA?.cintura_cm != null && mD?.cintura_cm != null ? mD.cintura_cm - mA.cintura_cm : null;

  return {
    angulo,
    antes,
    depois,
    semanas,
    deltaPeso,
    deltaCintura,
    leitura: lerNumeros(deltaPeso, deltaCintura, semanas),
  };
}

/**
 * Quanto as fotos ocupam. Aparece na tela porque o espaço é do usuário.
 *
 * Mostra em KB abaixo de 1 MB: arredondar 20 KB para "0 MB" faz o app parecer
 * quebrado justamente quando está sendo econômico.
 */
export async function espacoUsado(): Promise<{ fotos: number; mb: number; texto: string }> {
  const r = await first<{ n: number; bytes: number }>(
    'SELECT COUNT(*) AS n, COALESCE(SUM(LENGTH(imagem)), 0) AS bytes FROM fotos_progresso'
  );
  const bytes = r?.bytes ?? 0;
  const mb = Math.round((bytes / 1048576) * 10) / 10;
  const texto =
    bytes < 1048576
      ? `${Math.max(1, Math.round(bytes / 1024))} KB`
      : `${mb.toFixed(1).replace('.', ',')} MB`;
  return { fotos: r?.n ?? 0, mb, texto };
}
