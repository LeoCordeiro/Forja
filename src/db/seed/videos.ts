/**
 * Shorts de execução por exercício.
 *
 * GERADO POR `node scripts/videos.mjs`. Não editar à mão sem necessidade:
 * a próxima execução preserva o que já está aqui, então um ID corrigido
 * manualmente sobrevive.
 *
 * Todo item aqui passou por três testes na coleta:
 * · o YouTube o classifica como Short (`WEB_PAGE_TYPE_SHORTS`);
 * · a miniatura é vertical de verdade (altura > largura), porque tela de
 *   celular é vertical e vídeo deitado aparece do tamanho de um selo;
 * · o vídeo é público e permite ser embutido (oEmbed responde 200) — vídeo com
 *   embed bloqueado aparece na busca e só falha dentro do app.
 *
 * Exercício sem Short bom fica sem vídeo: o app cai na demonstração em imagens,
 * que serve melhor que o vídeo errado.
 */

export interface VideoExercicio {
  id: string;
  /** Duração em segundos — vira o selo na miniatura. */
  seg: number;
}

export const VIDEOS: Record<string, VideoExercicio> = {
  'Abdominal infra': { id: 'jqyHNUeAIQU', seg: 73 },
  'Abdominal na polia': { id: 'jXu-yJq9m3s', seg: 29 },
  'Abdominal supra': { id: '8wEofUHsYvA', seg: 60 },
  'Abdução na máquina': { id: 'bdF3z3K9Hn4', seg: 25 },
  'Afundo com barra': { id: 'bql6kvcoT5o', seg: 29 },
  'Afundo com halteres': { id: 'w8Ar4bgxizw', seg: 28 },
  'Afundo com rotação': { id: '33np73VU8HY', seg: 16 },
  'Agachamento com peso corporal': { id: 'jZKcrf5oowY', seg: 15 },
  'Agachamento frontal': { id: 'pYIpBFnong0', seg: 38 },
  'Agachamento livre': { id: '3vTRFnzCMaA', seg: 49 },
  'Agachamento profundo segurado': { id: 'Vdibrs0ZGfo', seg: 60 },
  'Alongamento pós-treino': { id: 'qDoihsLgIXY', seg: 27 },
  'Aquecimento antes do treino': { id: '8fEtSkNaQQM', seg: 48 },
  'Balanço de perna': { id: 'YmhhMMOmlB4', seg: 35 },
  'Barra fixa': { id: 'qT_6_B4trdo', seg: 30 },
  'Barra fixa supinada': { id: 'M-eZFcSyuP0', seg: 15 },
  'Bicicleta ergométrica': { id: 'RKi8h4aL75E', seg: 33 },
  'Cadeira extensora': { id: 'McDlS16kwhI', seg: 58 },
  'Cadeira flexora': { id: 'vWqi5uAnEu4', seg: 25 },
  'Círculos de escápula': { id: '1OeNIs8sDXo', seg: 21 },
  'Coice na polia': { id: 'uXIy5SYdS84', seg: 74 },
  'Coluna de quem passa o dia sentado': { id: '2DMutDMZ--U', seg: 60 },
  'Crossover na polia': { id: 'nuTuKjcQRHg', seg: 52 },
  'Crucifixo com halteres': { id: 'pU80usRU99Y', seg: 59 },
  'Crucifixo inclinado': { id: 'BNBsJFYBpqk', seg: 28 },
  'Crucifixo inverso': { id: 'C9Q9so5Fqws', seg: 20 },
  'Desenvolvimento Arnold': { id: 'CF0rkkvNh3g', seg: 27 },
  'Desenvolvimento com halteres': { id: 'zoXE8hI9zoI', seg: 48 },
  'Desenvolvimento militar': { id: 'fFYwiqIQ6yY', seg: 33 },
  'Deslize na parede': { id: 'Hl7dGcEHyzs', seg: 25 },
  'Dorsal suspenso': { id: 'mXaWQvlGTQg', seg: 17 },
  'Elevação de pernas na barra': { id: 'AkcAg5suq6Y', seg: 46 },
  'Elevação frontal': { id: '4obmVkoKQkA', seg: 55 },
  'Elevação lateral': { id: 'AXyz3LONUkY', seg: 49 },
  'Elevação pélvica com barra': { id: 'RbGXlJjAf3I', seg: 18 },
  'Elíptico': { id: 'KjoCtuZfew4', seg: 82 },
  'Encolhimento': { id: 'xYk3w0V3GWM', seg: 20 },
  'Escalador': { id: 'Fia12izRfAc', seg: 30 },
  'Esteira': { id: '10sfKL6X9WQ', seg: 31 },
  'Face pull': { id: 'ej70jhGdow4', seg: 38 },
  'Flexão de braço': { id: 'IfZ0N3KeZuc', seg: 33 },
  'Flexor do quadril (afundo)': { id: '8AcVi3aLHWk', seg: 46 },
  'Gato e camelo': { id: 'g5r6WGVasCw', seg: 38 },
  'Hack machine': { id: 'lQo21In1LZs', seg: 60 },
  'Hiperextensão lombar': { id: 'TxCo5HttW_s', seg: 55 },
  'Leg press': { id: 'c74ubBbL3zU', seg: 49 },
  'Levantamento terra': { id: 'dta3aMVe9qA', seg: 35 },
  'Levantamento terra romeno': { id: 'dta3aMVe9qA', seg: 35 },
  'Mergulho no paralelo': { id: 'p_DeBmkbCUc', seg: 15 },
  'Mesa flexora': { id: 'bA5gbGtltFs', seg: 49 },
  'Mobilidade de ombro': { id: '_uDUcmsbaJQ', seg: 31 },
  'Mobilidade de quadril': { id: 'd55z6suktuo', seg: 37 },
  'Movimento livre': { id: 'GB5upCs4phI', seg: 25 },
  'Panturrilha em pé': { id: 'kj2GgzdRXTU', seg: 19 },
  'Panturrilha na parede': { id: 'UwZql3MUeX0', seg: 19 },
  'Panturrilha no leg press': { id: 'ClGPnxuKXNQ', seg: 33 },
  'Panturrilha sentado': { id: '6eJ9EVwazXk', seg: 53 },
  'Peitoral na parede': { id: 'RFC4QLB5eY0', seg: 53 },
  'Ponte de glúteo': { id: '0u3-WOO611Q', seg: 22 },
  'Posterior de coxa sentado': { id: 'XYMba96VI-Y', seg: 40 },
  'Prancha': { id: 'Zex85qTPc4s', seg: 15 },
  'Prancha lateral': { id: 'hfswPJ3cucY', seg: 34 },
  'Pular corda': { id: 'emnAsCf66vQ', seg: 24 },
  'Puxada frontal na polia': { id: 'hTaY3y09eLc', seg: 38 },
  'Puxada supinada': { id: 'xd_f-tE9l3M', seg: 31 },
  'Quadríceps em pé': { id: 'HQXoF0pXtsU', seg: 19 },
  'Remada alta': { id: 'KABahQZ_9FQ', seg: 43 },
  'Remada baixa na polia': { id: '9lLn49UFMFk', seg: 21 },
  'Remada cavalinho': { id: 'A-7jq3U-Qmg', seg: 34 },
  'Remada curvada com barra': { id: 'acDyeZn_Jug', seg: 46 },
  'Remada unilateral com halter': { id: 'eeg6REnybpI', seg: 84 },
  'Remo ergômetro': { id: 'yaxveBJGoy8', seg: 45 },
  'Rosca alternada com halteres': { id: '1LpnsHK6uMw', seg: 51 },
  'Rosca concentrada': { id: 'YxkxWJtOv24', seg: 25 },
  'Rosca direta com barra': { id: 'Yp-SuCCqui8', seg: 74 },
  'Rosca inversa': { id: 'VMCHKbBjLwQ', seg: 72 },
  'Rosca martelo': { id: 'RejYUX31uVo', seg: 75 },
  'Rosca na polia alta': { id: 'Yisx-zzaHL8', seg: 20 },
  'Rosca scott': { id: 'BaLyD_0Qi9Y', seg: 43 },
  'Rotação de quadril': { id: '5nzzndnJZT8', seg: 16 },
  'Rotação de tronco': { id: 'IfHmkw9uK6g', seg: 16 },
  'Russian twist': { id: '_d5cpAre7_w', seg: 26 },
  'Série de aproximação': { id: 'eUlXrAGEDMw', seg: 37 },
  'Stiff': { id: 'Vjtn6n_-sXo', seg: 53 },
  'Supino fechado': { id: 'AgAjzg3AMwc', seg: 59 },
  'Supino inclinado com barra': { id: 'GWe3Pcl3oH0', seg: 30 },
  'Supino inclinado com halteres': { id: 'Fa-X2ByLHaY', seg: 38 },
  'Supino reto com barra': { id: '6jBx5YwAb7E', seg: 15 },
  'Supino reto com halteres': { id: 'amHMMhNbqUg', seg: 38 },
  'Tríceps coice': { id: 'XnTXknZ7srQ', seg: 46 },
  'Tríceps francês': { id: 'jCY6bkVLOzE', seg: 54 },
  'Tríceps na polia com barra': { id: 'CVrp2m_rBfs', seg: 20 },
  'Tríceps na polia com corda': { id: 'IoawExktILM', seg: 18 },
  'Tríceps testa': { id: '0jMF0o0DdbA', seg: 32 },
  'Voador (peck deck)': { id: 'Tq0LwCOVl4M', seg: 43 },
};

/**
 * Miniatura vertical. `frame0.jpg` sai na proporção original do vídeo; o
 * `hqdefault.jpg` é sempre 480x360 e enfia tarja preta dos dois lados.
 */
export function thumb(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/frame0.jpg`;
}

export function duracaoCurta(seg: number): string {
  return `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`;
}
