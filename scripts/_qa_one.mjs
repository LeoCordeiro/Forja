import { EXERCICIOS } from '../src/db/seed/exercicios.ts';
import { montarPlano } from '../src/features/treino/gerador.ts';
const T = EXERCICIOS.map(([n,g,s,e,c],i)=>({id:i+1,nome:n,grupo_primario:g,grupos_secundarios:s,equipamento:e,tipo_carga:c}));
const fonte={catalogo:T.filter(e=>e.grupo_primario!=='cardio'),cardio:T.filter(e=>e.grupo_primario==='cardio')};
const p={dias:4,diasDisponiveis:[1,2,3,4],experiencia:'avancado',objetivo:'emagrecimento',local:'academia',
 minutosPorDia:[30,30,30,30,30,30,30],preferenciaEquipamento:'maquina',focos:['peito'],dores:['ombro'],barraFixaReps:-1};
const pl=await montarPlano(p,fonte);
for(const d of pl.dias) console.log(`${d.nome} (${d.minutos}min): ` + d.exercicios.map(e=>`${e.series}x ${e.nome}[${e.grupo}]`).join(' | '));
console.log('\nAVISOS:'); pl.avisos.forEach((a,i)=>console.log(` ${i+1}. ${a.slice(0,160)}`));
