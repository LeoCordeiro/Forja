import { EXERCICIOS } from '../src/db/seed/exercicios.ts';
import { montarPlano } from '../src/features/treino/gerador.ts';
const TODOS = EXERCICIOS.map(([n,g,s,e,c],i)=>({id:i+1,nome:n,grupo_primario:g,grupos_secundarios:s,equipamento:e,tipo_carga:c}));
const fonte={catalogo:TODOS.filter(e=>e.grupo_primario!=='cardio'),cardio:TODOS.filter(e=>e.grupo_primario==='cardio')};
const base={dias:4,diasDisponiveis:[1,2,4,5],experiencia:'intermediario',objetivo:'hipertrofia',local:'academia',minutosPorDia:[60,60,60,60,60,60,60],preferenciaEquipamento:'indiferente',focos:[],dores:[],barraFixaReps:-1};
const out=[];
for (const dias of [3,4,5,6])
 for (const exp of ['iniciante','intermediario','avancado'])
  for (const min of [45,60,90,120])
   for (const local of ['academia','casa_simples'])
    for (const focos of [[],['peito'],['inferior'],['superior'],['gluteo'],['ombro']]) {
      const p={...base,dias,diasDisponiveis:[1,2,3,4,5,6].slice(0,dias),experiencia:exp,minutosPorDia:[min,min,min,min,min,min,min],local,focos};
      const pl=await montarPlano(p,fonte);
      // assinatura = conjunto de exercicios por dia (ordem ignorada) -> isola REMOÇÃO de reordenação
      out.push(`${dias}|${exp}|${min}|${local}|${focos.join('+')||'-'}::`+pl.dias.map(d=>d.nome+'{'+d.exercicios.map(e=>`${e.nome}x${e.series}`).sort().join(',')+'}').join(';'));
    }
console.log(out.join('\n'));
