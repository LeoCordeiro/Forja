# /sprint — roda a próxima fase do roadmap, do início ao fim

Fluxo autônomo até a borda do irreversível: situar, implementar, cross-revisar,
validar e registrar sem pedir nada ao Leonardo. Commit, push, roadmap novo e
teste físico na academia são dele — todo o resto é seu.

## Passos

1. **Situar.** Ler `AGENTS.md`, `docs/roadmap.md` e o consolidado da rodada
   atual (link no roadmap). Working tree sujo com coisa que não é desta fase →
   PARAR e avisar; não misturar trabalho.
2. **Escolher a fase:** a primeira `pendente` do roadmap. Todas fechadas →
   pular direto para "Re-auditoria" abaixo.
3. **Confirmar antes de mexer.** Cada achado da fase é verificado no código
   atual. Achado que não se reproduz mais: registrar em "Não se confirmou" no
   roadmap e tirar do escopo — nunca implementar correção de problema morto.
   Não pedir aprovação do plano: o roadmap JÁ é o escopo aprovado.
4. **Implementar:** subagente `mobile-expo` executa. `fitness-scientist` e
   `nutricionista` NUNCA editam código. Máximo 3 subagentes em paralelo.
5. **Cross-review obrigatório:** `qa` revisa o diff caçando corrupção de dado,
   regressão, closure velha e falta de idempotência (na sessão 1 esse passo
   pegou 2 ALTOS que reabririam corrupção). Achou ALTO → corrigir e revisar de
   novo até limpar. Fase que mexe em prescrição de treino → `fitness-scientist`
   revisa o resultado também (relatório, sem editar).
6. **Gates automáticos, nenhum pulável:**
   - `npx tsc --noEmit` limpo
   - mexeu em schema → `npm run testar:migracao` 100% + responder por escrito
     "e quem já está com o banco estragado?"
   - fluxo real validado no navegador a 390×844 (`npx expo start --web`),
     clicando de verdade — compilar ≠ funcionar
7. **Regras de sangue** (herdadas de bug pago, não negociáveis):
   - Retry de gravação só com idempotência; nunca re-INSERT cego.
   - Não bloquear comportamento que funciona por "estado inconsistente" sem
     aval do Leonardo — na dúvida, aviso não-bloqueante.
   - Nada fora do escopo da fase. Achado novo no caminho vira linha em
     "Candidatos à próxima rodada" no roadmap — não vira código.
8. **Encerrar e registrar:**
   - `docs/roadmap.md`: fase → `aguardando-aprovação`, com data, o que foi
     validado e o que não foi.
   - Cofre Obsidian: atualizar a nota
     `Claude/Projetos/Em andamento/Forja - App de Treino e Nutrição.md` e o
     diário do dia.
   - **NÃO commitar, NÃO fazer push.**
   - Última mensagem: resumo por achado + lista explícita do que ficou para o
     Leonardo (commit; teste no celular quando a fase tocou UI de treino).

## Re-auditoria (quando o roadmap zera)

Rodar a rodada N+1 do time — `fitness-scientist`, `nutricionista`, `ux-ui` e
os globais que couberem, em rodadas de até 3 — comparando com o consolidado
anterior: o que melhorou, o que persiste, o que apareceu. Gerar
`docs/auditoria-AAAA-MM-DD/consolidado-cto.md` novo + proposta de roadmap, e
PARAR: roadmap novo é escopo novo, e escopo é do Leonardo.
