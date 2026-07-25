# Forja — app de treino e nutrição

App mobile pessoal (Leonardo) para controle de treino com progressão de carga,
nutrição e gamificação. React Native + Expo SDK 57, **100% offline, banco local**.

> Expo muda rápido: consultar https://docs.expo.dev/versions/v57.0.0/ antes de
> usar API que não esteja já no código.

## Rodar

```bash
npx expo start          # dev server (QR para o celular via Expo Go)
npx expo start --web    # preview no navegador, para validar telas
npx tsc --noEmit        # typecheck — rodar sempre antes de entregar
```

Testar no celular é o que vale: o app foi desenhado para uso de pé, na
academia, com a mão suada. Layout que parece bom no navegador pode ter alvo de
toque pequeno demais no aparelho.

## Arquitetura

- **Sem backend.** SQLite local via `expo-sqlite`, SQL cru (sem ORM). Não há
  conta, login, servidor nem internet — funciona em modo avião.
- **Rotas:** Expo Router, file-based em `app/`.
- **Lógica:** `src/features/<dominio>/api.ts` concentra todo acesso a dados de
  um domínio. Tela nenhuma escreve SQL.
- **UI:** `src/shared/ui/` — todo componente visual sai daqui. Nenhuma tela
  inventa cor, espaçamento ou tamanho de fonte fora de `src/theme`.

```
app/                    rotas (Expo Router)
  (tabs)/               Hoje, Treino, Dieta, Evolução, Perfil
  sessao/[id].tsx       executor de treino — a tela mais importante
src/
  db/                   schema.ts (DDL), client.ts, seed/
  features/             treino, dieta, perfil, gamificacao
  shared/ui/            componentes; shared/utils/ formatação e datas
  theme/                tokens de cor, espaçamento, tipografia, motion
```

## Regras do domínio (não quebrar)

1. **Plano ≠ execução.** `routine_exercises` é o que se planejou; `set_logs` é
   o que se levantou. Nunca gravar execução no template — editar a rotina
   apagaria o histórico, e o histórico é o produto.
2. **Peso sempre em kg no banco.** Conversão só na apresentação.
3. **Macros de refeição consumida são snapshot.** Corrigir a tabela nutricional
   de um alimento não pode reescrever o que já foi comido.
4. **XP é ledger.** `point_events` é append-only; o total é sempre `SUM()`.
   Nunca guardar só o saldo.
5. **Séries são editáveis e removíveis de verdade.** Corrigir ou desmarcar
   precisa atualizar/apagar o `set_log` e recalcular os PRs derivados — senão
   um "8080" digitado por engano vira recorde permanente e trava a progressão.
6. **IMC, TMB e TDEE são calculados, nunca armazenados.** São função de peso,
   altura, idade e objetivo; congelar o valor cria histórico mentiroso.

## Detalhes de plataforma

- **Web (preview):** `expo-sqlite` roda em WASM e exige `.wasm` registrado como
  asset e headers COOP/COEP — ambos já em `metro.config.js`. Sem isso o bundle
  web nem constrói.
- **Haptics** não existe no web: sempre usar `buzz` de `shared/utils/haptics`,
  que já tem o guard.
- **iOS sem Mac:** build pelo EAS (`eas build -p ios`).

## Dados de terceiros

- Exercícios e imagens: `free-exercise-db` (MIT), servidas do GitHub. Dois
  frames por exercício (início/fim) que o app alterna como demonstração.
- Alimentos: tabela TACO (Unicamp).
- Não usar ExRx, MuscleWiki ou bases comerciais — conteúdo proprietário.

## Migração futura para multiusuário

O schema já é Postgres-compatível (snake_case, mesmas tabelas). Para virar
produto: subir para Supabase, trocar `INTEGER PRIMARY KEY AUTOINCREMENT` por
`uuid`, adicionar `user_id` + RLS em cada tabela, e manter o SQLite local como
cache offline com fila de sync.
