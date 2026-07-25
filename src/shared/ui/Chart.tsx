import { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop, Line, Rect } from 'react-native-svg';
import { colors, spacing } from '@/theme';
import { Txt } from './Txt';
import { num } from '../utils/format';

export interface Ponto {
  x: string; // rótulo (data curta)
  y: number;
}

interface Props {
  dados: Ponto[];
  cor?: string;
  altura?: number;
  sufixo?: string;
  /** Linha tracejada horizontal — meta de peso, por exemplo. */
  meta?: number;
  casas?: number;
}

/**
 * Gráfico de linha em SVG puro.
 *
 * Não usei lib de chart porque as boas puxam Skia (build pesado) e as leves
 * não deixam controlar a estética. Aqui são ~60 linhas e o visual é nosso.
 */
export function Linha({ dados, cor = colors.primary, altura = 180, sufixo = '', meta, casas = 1 }: Props) {
  const [w, setW] = useState(0);

  function medir(e: LayoutChangeEvent) {
    setW(e.nativeEvent.layout.width);
  }

  if (dados.length === 0) {
    return (
      <View style={[s.vazio, { height: altura }]}>
        <Txt v="small">Sem dados ainda</Txt>
      </View>
    );
  }

  const padY = 18;
  const h = altura - padY * 2;
  const valores = dados.map((d) => d.y);
  const candidatos = meta !== undefined ? [...valores, meta] : valores;
  let min = Math.min(...candidatos);
  let max = Math.max(...candidatos);
  // Sem folga, uma linha reta grudaria na borda e sumiria.
  if (max === min) {
    max += 1;
    min -= 1;
  } else {
    const folga = (max - min) * 0.15;
    max += folga;
    min -= folga;
  }

  const px = (i: number) =>
    dados.length === 1 ? w / 2 : (i / (dados.length - 1)) * (w - 8) + 4;
  const py = (v: number) => padY + h - ((v - min) / (max - min)) * h;

  const linha = dados.map((d, i) => `${i === 0 ? 'M' : 'L'} ${px(i)} ${py(d.y)}`).join(' ');
  const area = `${linha} L ${px(dados.length - 1)} ${altura} L ${px(0)} ${altura} Z`;

  const ultimo = dados[dados.length - 1];
  const primeiro = dados[0];
  const delta = ultimo.y - primeiro.y;

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={s.topo}>
        <View>
          <Txt v="h1">
            {num(ultimo.y, casas)}
            <Txt v="body" cor={colors.textDim}>
              {' '}
              {sufixo}
            </Txt>
          </Txt>
        </View>
        {dados.length > 1 ? (
          <View style={[s.delta, { backgroundColor: delta >= 0 ? colors.successSoft : colors.dangerSoft }]}>
            <Txt v="small" cor={delta >= 0 ? colors.success : colors.danger} bold>
              {delta >= 0 ? '+' : ''}
              {num(delta, casas)} {sufixo}
            </Txt>
          </View>
        ) : null}
      </View>

      <View onLayout={medir} style={{ height: altura }}>
        {w > 0 ? (
          <Svg width={w} height={altura}>
            <Defs>
              <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={cor} stopOpacity="0.28" />
                <Stop offset="1" stopColor={cor} stopOpacity="0" />
              </LinearGradient>
            </Defs>

            {[0, 0.5, 1].map((f) => (
              <Line
                key={f}
                x1={0}
                x2={w}
                y1={padY + h * f}
                y2={padY + h * f}
                stroke={colors.border}
                strokeWidth={1}
              />
            ))}

            {meta !== undefined ? (
              <Line
                x1={0}
                x2={w}
                y1={py(meta)}
                y2={py(meta)}
                stroke={colors.success}
                strokeWidth={1.5}
                strokeDasharray="5 5"
              />
            ) : null}

            <Path d={area} fill="url(#grad)" />
            <Path
              d={linha}
              stroke={cor}
              strokeWidth={2.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {dados.map((d, i) => (
              <Circle
                key={i}
                cx={px(i)}
                cy={py(d.y)}
                r={i === dados.length - 1 ? 5 : 3}
                fill={i === dados.length - 1 ? cor : colors.bg}
                stroke={cor}
                strokeWidth={2}
              />
            ))}
          </Svg>
        ) : null}
      </View>

      <View style={s.eixo}>
        <Txt v="small" cor={colors.textFaint}>
          {primeiro.x}
        </Txt>
        <Txt v="small" cor={colors.textFaint}>
          {ultimo.x}
        </Txt>
      </View>
    </View>
  );
}

/** Barras verticais — volume por semana, treinos por dia. */
export function Barras({
  dados,
  cor = colors.primary,
  altura = 140,
  sufixo = '',
}: {
  dados: Ponto[];
  cor?: string;
  altura?: number;
  sufixo?: string;
}) {
  const [w, setW] = useState(0);
  if (dados.length === 0) {
    return (
      <View style={[s.vazio, { height: altura }]}>
        <Txt v="small">Sem dados ainda</Txt>
      </View>
    );
  }

  const max = Math.max(...dados.map((d) => d.y), 1);
  const vao = 6;
  const larguraBarra = w > 0 ? (w - vao * (dados.length - 1)) / dados.length : 0;

  return (
    <View style={{ gap: spacing.sm }}>
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: altura }}>
        {w > 0 ? (
          <Svg width={w} height={altura}>
            {dados.map((d, i) => {
              const hb = Math.max(3, (d.y / max) * (altura - 4));
              return (
                <Rect
                  key={i}
                  x={i * (larguraBarra + vao)}
                  y={altura - hb}
                  width={larguraBarra}
                  height={hb}
                  rx={4}
                  fill={d.y > 0 ? cor : colors.surfaceHigh}
                  opacity={d.y > 0 ? (i === dados.length - 1 ? 1 : 0.62) : 1}
                />
              );
            })}
          </Svg>
        ) : null}
      </View>
      <View style={s.eixo}>
        {dados.map((d, i) => (
          <Txt key={i} v="small" cor={colors.textFaint} size={10}>
            {d.x}
          </Txt>
        ))}
      </View>
      {sufixo ? (
        <Txt v="small" cor={colors.textFaint}>
          Máximo: {num(max)} {sufixo}
        </Txt>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  vazio: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
  topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  delta: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: 999 },
  eixo: { flexDirection: 'row', justifyContent: 'space-between' },
});
