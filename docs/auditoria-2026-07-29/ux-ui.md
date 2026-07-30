# Auditoria UX/UI — Forja

> Agente: ux-ui · 2026-07-29 · escopo lido: `app/sessao/[id].tsx` (integral), `app/(tabs)/*`,
> `app/dia/[id].tsx`, `app/_layout.tsx`, `src/shared/ui/*`, `src/theme/index.ts`,
> `src/features/treino/descanso.ts`, `src/shared/utils/haptics.ts`, `scripts/pwa.mjs`,
> `public/sw.js`. Nenhum arquivo editado.
>
> Régua aplicada: registrar uma série em 2–5 s, de pé, mão suada, iPhone PWA standalone.

---

## 1. CRÍTICO — Registrar uma série com a mesma carga da semana passada custa 4 toques e 2 teclados

**Problema:** O caminho mais frequente do app — "fiz a mesma carga de sempre, marca aí" — exige: tocar no check (1), confirmar peso no NumberPad (2), confirmar reps (3), tocar no check de novo (4). A tabela mostra o valor anterior em cinza dentro do campo, o que comunica "já está preenchido, é só marcar" — mas marcar abre o teclado, porque o placeholder não é estado.
**Causa:** `app/sessao/[id].tsx` — o estado da série nasce vazio (linha 190: `{ peso: '', reps: '', concluida: false }`); `concluirSerie` valida sobre o estado, não sobre o herdado (linhas 447–453); e `confirmarCampo` no reps faz `setFoco(null)` sem concluir (linha 412), obrigando o quarto toque.
**Impacto:** Num treino de 20 séries são ~80 toques onde caberiam ~20. Cada série dispara duas animações de teclado e o colapso do cabeçalho — a tela muda de layout duas vezes no meio do gesto. A meta de 2–5 s não fecha; o padrão de mercado (Strong, Hevy) resolve com 1 toque.
**Evidência:**
```tsx
// concluirSerie — linha 451
if (!porTempo && (!pesoN || !repsN)) {
  abrirCampo(ex.id, idx, !pesoN ? 'peso' : 'reps');
// LinhaSerie — linha 1372: o campo EXIBE o anterior, mas ele não vale
{serie.peso || (anterior?.peso_kg ? fmtPeso(anterior.peso_kg) : '—')}
```
**Solução:** Pré-popular o estado com a última execução ao montar a sessão (peso/reps reais, não placeholder), renderizando o valor herdado em `textDim` até a primeira edição. O check passa a concluir em 1 toque; quem quer mudar toca no campo antes.
**Alternativas:** (a) check grava o anterior quando o estado está vazio ("vazio = repetir"), com haptic distinto; (b) `confirmarCampo` do reps conclui a série (reduz para 3 toques); (c) long-press no check = "repetir anterior".

## 2. CRÍTICO — Alvos de toque do fluxo central abaixo do mínimo; o theme define HIT=52 e a tela de sessão ignora

**Problema:** O botão mais tocado do app (check de concluir série) tem ~36×34 pt. A trilha de exercícios tem bolinhas de 30 pt encostadas. "Pular" descanso tem ~30 pt de altura. "Concluir" treino, 38 pt. Voltar/info, 36 pt. Apple HIG pede 44×44; o design system do projeto pede 52 (`HIT`); zero `hitSlop` no repositório (grep confirmou).
**Causa:** `app/sessao/[id].tsx` — `check`/`checkBox` (linhas 1628–1638), `BOLA = 30` (linha 100), `pular` (1679–1684, paddingVertical 6), `btnFim` (1501, height 38), `iconeBtn`/`iconeMini` (1491, 1583). `HIT = 52` declarado em `src/theme/index.ts:74` e usado só por Button e Input.
**Impacto:** Mão suada e de pé, o dedo erra o check e acerta o campo de reps ao lado (abre teclado sem querer) ou erra a bolinha da trilha e pula para o exercício errado. Atrito exatamente no gesto que o app existe para servir.
**Evidência:**
```tsx
check: { width: 36, alignItems: 'flex-end' },
checkBox: { width: 34, height: 34, ... },
```
```ts
/** Altura mínima de qualquer coisa clicável. Abaixo disso o polegar erra. */
export const HIT = 52;
```
**Solução:** Check a 48–52 pt; `hitSlop` nos alvos que não podem crescer visualmente (bolinhas, "Pular", ícones do cabeçalho) — `Press` já herda `PressableProps`.
**Alternativas:** Linha inteira da série como alvo de conclusão (campos excluídos), checkbox só indicador; aumentar `PASSO` da trilha.

## 3. ALTO — Falha de gravação é silenciosa: a série fica verde na tela sem estar no banco

**Problema:** A UI marca a série como concluída antes do `await registrarSerie(...)` e não existe nenhum `catch` — nem toast, nem rollback, nem indicador. Mesmo padrão em `atualizarSerie`, `desfazerSerie` e `finalizarSessao` (try/finally sem catch: se lançar, o sheet trava aberto sem mensagem).
**Causa:** `app/sessao/[id].tsx` linhas 458–472 (otimismo sem tratamento), 528–564 (`encerrar` sem catch). A tela inteira não tem um único estado de erro visível.
**Impacto:** No PWA, o SQLite roda sobre OPFS — aba duplicada segurando o lock ou quota do Safari basta para uma gravação falhar. O usuário vê verde, confia, e o histórico (o produto, regra 1) perde a série sem avisar; a progressão da semana seguinte se baseia num buraco.
**Evidência:**
```tsx
arrNova[idx] = { ...arrNova[idx], concluida: true };
setSeries((p) => ({ ...p, [ex.id]: arrNova }));  // verde primeiro
buzz.ok();
const prs = await registrarSerie({ ... });        // se lançar, ninguém sabe
```
**Solução:** try/catch nas gravações: no erro, reverter `concluida`, `buzz.erro()` e aviso não-bloqueante (variante vermelha da `BarraDescanso`: "Não gravou, toque para tentar de novo").
**Alternativas:** Fila local de gravações pendentes com retry; ao menos logar em tabela de diagnóstico para `/diagnostico` exibir.

## 4. ALTO — "Cancelar treino" apaga tudo com um toque, sem confirmação

**Problema:** No sheet "Sair do treino", o botão "Cancelar treino" chama `abandonar()` direto: apaga sessão, séries e PRs derivados, irreversível, num toque — no mesmo sheet onde estão "Pausar" e "Concluir agora". Texto avisa, mas texto não é fricção.
**Causa:** `app/sessao/[id].tsx` — `abandonar` (linhas 593–597) ligado direto ao `onPress` do Button perigo (834–841). O próprio arquivo comenta na linha 606 que "voltar direto já perdeu treino por engano" — a lição foi aplicada ao chevron, não ao botão destrutivo.
**Evidência:**
```tsx
<Button titulo="Cancelar treino" icone="trash-outline" variante="perigo" full
  carregando={salvando} onPress={abandonar} />
```
**Impacto:** Perda irreversível do artefato central por erro motor — o cenário exato (mão suada, alvo vizinho) que o AGENTS.md manda proteger.
**Solução:** Segundo estágio no próprio botão: primeiro toque vira "Toque de novo para apagar N séries" (armado ~3 s, cor sólida de perigo), segundo toque executa.
**Alternativas:** Long-press de 800 ms com progresso visual; ou soft-delete (lixeira de 24 h).

## 5. ALTO — `textFaint` tem contraste 3,0–3,3:1 em fontes de 10–12 px — inclusive na coluna "Anterior", que decide a carga

**Problema:** `#5C6373` sobre `#0A0B0F` dá ~3,3:1; sobre `surface` (`#14161D`, fundo da tabela) dá ~3,0:1. WCAG AA para texto pequeno exige 4,5:1. E o app usa `textFaint` justamente em texto minúsculo: a referência "80 × 8" da última sessão, o "1 de 8" de posição, contagem da trilha, subtítulos.
**Causa:** `src/theme/index.ts:24` (`textFaint: '#5C6373'`) combinado com o uso na tabela em `app/sessao/[id].tsx:1362` — a informação mais consultada durante a decisão de carga está na pior cor do sistema, em 12 px.
**Impacto:** Academia iluminada + brilho alto + suor: o histórico anterior, que a pessoa lê entre séries para decidir se sobe carga, fica ilegível de relance. O comentário do próprio theme ("número que se lê de relance") não se cumpre onde mais importa.
**Evidência:**
```tsx
<Txt v="small" cor={colors.textFaint} style={{ flex: 1 }} size={12}>
  {anterior?.peso_kg ? `${fmtPeso(anterior.peso_kg)} × ${anterior.reps}` : ...}
```
**Solução:** Coluna "Anterior" em `textDim` (`#9AA1B4`, ~7,6:1 — passa AA); `textFaint` só para decorativo. Subir `textFaint` para ~`#6E7688` (≈4,5:1) resolve o resto numa linha.
**Alternativas:** Proibir `textFaint` abaixo de 13 px via convenção; ou "Anterior" em estilo `numeric` 13 px `textDim`.

## 6. MÉDIO — O cronômetro de descanso some exatamente quando se prepara a próxima série

**Problema:** A `BarraDescanso` é ocultada quando o NumberPad está aberto (`!foco`), e o NumberPad não mostra o tempo. Fluxo real: concluir série → descanso começa → durante o descanso ajusta o peso da próxima → abre o pad → o tempo desaparece.
**Causa:** `app/sessao/[id].tsx:700` — `{descansoAtivo && descanso !== null && !foco ? <BarraDescanso .../> : null}`. O visor do NumberPad (`src/shared/ui/NumberPad.tsx:98–121`) tem espaço à direita (`contexto`) mas não recebe o descanso.
**Impacto:** O timer é a segunda função mais usada e fica invisível no momento em que mais orienta; perde-se o aviso dos 3 bips finais.
**Solução:** Passar `descanso` para o NumberPad e exibir contador compacto no visor, com a cor da barra.
**Alternativas:** Encolher a barra para um pill acima do pad; ou countdown no rótulo do visor quando restam <15 s.

## 7. MÉDIO — Série adicionada por engano não pode ser removida e trava a conclusão do exercício

**Problema:** "Adicionar série" cria uma linha sem gesto de remoção (nem swipe, nem long-press, nem botão). Como `completoDe` exige todas as linhas concluídas, uma linha fantasma impede a bolinha verde e o auto-avanço. Ao fechar e reabrir o app, a linha vazia desaparece (recuperação usa `max(series_alvo, gravadas)`) — o mesmo treino tem dois estados dependendo de reabrir.
**Causa:** `app/sessao/[id].tsx` — `onAddSerie` só adiciona (676–681); `LinhaSerie` (1330–1393) sem ação de remoção; `completoDe` exige tudo concluído (338–340); recuperação descarta vazias (180–191). A regra 5 do AGENTS.md está cumprida no banco, não na UI da sessão.
**Impacto:** Toque acidental em "Adicionar série" deixa o exercício eternamente "incompleto" na trilha e mata o auto-avanço.
**Solução:** Long-press na linha não concluída → "Remover série" (linha concluída já tem corrigir/desmarcar). Só estado; nenhuma mudança de banco.
**Alternativas:** Lixeira na última linha quando vazia; ou `completoDe` ignorar extras vazias (mascara o problema).

## 8. MÉDIO — Sheets com Input não tratam o teclado nativo: o campo de nota fica atrás dele

**Problema:** O `Sheet` não tem `KeyboardAvoidingView` nem equivalente (grep: zero). O sheet "Nota de setup" (altura 0,62, Input multiline) abre o teclado do iOS, que cobre a metade inferior — onde estão o campo e o "Salvar".
**Causa:** `src/shared/ui/Sheet.tsx:28–54` (Modal + posição absoluta no bottom, sem reação ao teclado) usado com Input em `app/sessao/[id].tsx:846–878` e nos sheets de Perfil/Evolução/Dieta.
**Impacto:** Anotar "banco no furo 3" no meio do treino vira digitar às cegas. No standalone é pior que no Safari.
**Solução:** `KeyboardAvoidingView` (`behavior="padding"` no iOS) no Sheet; na web, `visualViewport` para padding-bottom.
**Alternativas:** Sheet a 0.9 quando contém Input focado.

## 9. MÉDIO — Na Home, o CTA do treino vem depois de nível, semana, passos e fase

**Problema:** Ordem da aba Hoje: nível/XP → semana → passos → fase do plano → só então "Hoje: iniciar treino". No momento "cheguei na academia", a ação nº 1 está abaixo da dobra.
**Causa:** `app/(tabs)/index.tsx` — blocos nas linhas 109 (nível), 139 (semana), 204 (passos), 248 (fase), 269 (treino de hoje). "Treino em andamento" tem prioridade correta quando existe (linha 92); "vou começar agora" não.
**Impacto:** Um a dois scrolls extras antes do toque principal, todo dia de treino. Gamificação acima da ação inverte a hierarquia de valor.
**Solução:** Cartão "Hoje" (agenda + Iniciar treino) logo abaixo do cabeçalho; nível e passos descem.
**Alternativas:** Ordenação por contexto (dia de treino não feito → cartão sobe; pós-treino → resumo sobe).

## 10. MENOR — Estados de carregamento são tela vazia com título "Carregando…"

**Problema:** Hoje, Dieta, Evolução e Perfil renderizam `<Screen titulo="Carregando…">` vazio enquanto ~8–11 queries resolvem. No PWA o iOS mata o processo com frequência — a tela vazia aparece em toda reabertura fria, inclusive na academia.
**Causa:** `app/(tabs)/index.tsx:56–62`, `dieta.tsx:68`, `evolucao.tsx:54`, `perfil.tsx:49` — mesmo padrão `if (!dados) return <Screen titulo="Carregando…">`.
**Impacto:** Percepção de lentidão e flash de layout. Não bloqueia — por isso menor — mas é a primeira impressão em toda reabertura.
**Solução:** Componente `Skeleton` no design system, usado nos quatro lugares; na Home, pintar treino/semana primeiro, estatísticas depois.
**Alternativas:** Cache em memória do último snapshot (stale-while-revalidate visual).

---

## Observações fora do top 10

- **Acessibilidade programática é zero:** nenhum `accessibilityLabel`/`accessibilityRole`. Aceitável para app pessoal; dívida de App Store se virar produto (plano multiusuário do AGENTS.md).
- **`user-scalable=no`** (`scripts/pwa.mjs:156`) é trade-off consciente e bem comentado; fere WCAG 1.4.4 se houver auditoria formal um dia.
- **Offline:** o SW só cacheia imagens de `raw.githubusercontent.com` (`public/sw.js:44`); thumbs do YouTube (`i.ytimg.com`) ficam de fora — sem sinal, a capa falha com latência/flash antes do fallback. Incluir `i.ytimg.com` no mesmo cache elimina isso.
- **Muito bem resolvido (não mexer):** descanso como instante-de-término persistido + áudio keep-alive + notificação (`src/features/treino/descanso.ts`), recuperação de sessão interrompida com retomada no exercício pendente, alarme por travessia de zero, NumberPad com incrementos de anilha e visor, `keepAwake`, pipeline de atualização do PWA via `versao.json`. Engenharia acima da média para o contexto.

**Prioridade sugerida pelo agente:** 1 e 2 juntos (mesmo redesign da linha de série), depois 3 e 4 (proteção do histórico), 5 (uma linha no theme + um uso), e o resto conforme sobrar sessão.
