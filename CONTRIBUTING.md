# Como contribuir

Este documento vale para todas as oito pessoas do squad. Ele existe porque temos três
sprints de uma semana e cinco desenvolvedores mexendo no mesmo monorepo: sem convenção, o
tempo que sobra vai embora resolvendo conflito.

## Fluxo de trabalho

1. Pegue a história no quadro e confirme que ela está pronta (critério de aceite escrito,
   regra de pontuação documentada, priorizada pelo PO).
2. Atualize a `main`: `git switch main && git pull --rebase`.
3. Crie o branch: `git switch -c feat/US06-lancar-acao`.
4. Trabalhe em commits pequenos (veja abaixo).
5. Rode `npm run verify` antes de subir.
6. Suba o branch e abra o pull request preenchendo o template inteiro.
7. Peça revisão a outro desenvolvedor. **Nenhum PR entra sem aprovação de outra pessoa.**
8. Com a revisão aprovada e a integração contínua verde, faça **squash merge** e apague o
   branch.

Para sincronizar um branch já aberto, use `git pull --rebase origin main`. **Nunca**
`git merge main` dentro do branch: isso enche o pull request de alterações alheias e
esconde o que você realmente mudou.

## Branches

```
<tipo>/US<NN>-<descricao-curta>
```

Tipos: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `ci`, `spike`.
Trabalho sem história (infraestrutura, pipeline, documentação do repo) usa `US00`.

| Bom                              | Ruim                 | Por quê                                |
| -------------------------------- | -------------------- | -------------------------------------- |
| `feat/US06-lancar-acao`          | `feature/lancamento` | sem o tipo e sem a história            |
| `fix/US08-aprovar-equipe-errada` | `arthur`             | branch com nome de pessoa não diz nada |
| `ci/US00-pipeline-testes`        | `teste`              | não é um tipo válido                   |

Um branch vive **no máximo dois dias úteis**. História grande vira dois branches
(`feat/US07-parte1-upload`, `feat/US07-parte2-validacao`), não um branch que atravessa a
sprint.

Não existe `develop` nem `release`. A `main` é a única fonte de verdade e é sempre o que
está em homologação.

## Commits

Tipo e escopo em inglês, descrição em português, no imperativo, sem ponto final:

```
feat(api): registra auditoria ao recusar lançamento

A recusa precisa deixar rastro igual à aprovação, senão a apuração
não consegue explicar por que o lançamento sumiu do placar.

Refs: US08
```

Escopos válidos: `api`, `web`, `db`, `contracts`, `ci`, `docs`.

A amarração com a história é o trailer `Refs: USNN` no corpo. Ele sobrevive ao squash,
é pesquisável (`git log --grep "Refs: US08"`) e não consome o título.

**Granularidade:** um commit é uma mudança que compila e cujo título descreve exatamente o
que mudou. Se o título precisa de "e", são dois commits. Uma história costuma render de
três a oito commits:

```
feat(db): cria tabela de registro de auditoria
feat(contracts): adiciona schema de lançamento
feat(api): implementa lançamento com cálculo de pontos
test(api): cobre cálculo e bloqueio por perfil no lançamento
feat(web): adiciona formulário de lançamento responsivo
```

Limpe commits de rascunho com `git rebase -i` **antes** de abrir o pull request — nunca
depois que alguém já começou a revisar.

### O que nunca entra na mensagem

- **Qualquer menção de autoria de IA** — nada de `Co-Authored-By`, `Generated with`,
  emoji de robô. A autoria do trabalho acadêmico é das pessoas do squad, e só delas.
- Segredo, token, senha ou URL de banco com credencial. Mesmo revertido depois, o objeto
  continua no histórico.
- Dado pessoal real de colaborador da Cestacorp usado em teste ou exemplo.
- `wip`, `ajustes`, `agora vai`, `.` — descrição que não diz o que mudou.
- Nome de colega em tom de cobrança.

O corpo do commit serve para o **porquê** e para a alternativa descartada. O _o quê_ o
diff já mostra.

## Pull requests

**Limite: 400 linhas úteis e dois dias de vida.** Acima disso, a revisão deixa de ser
revisão e vira carimbo. Preencha o template inteiro, inclusive as evidências de tela em
celular e em computador.

### Quando duas pessoas mexem no mesmo módulo

Na ordem de eficácia:

1. **Contrato primeiro.** Quem precisa de um tipo novo abre um pull request minúsculo só
   com o schema em `packages/contracts`. Mergeado isso, front e API avançam em paralelo
   contra um tipo estável. É o que mais reduz conflito aqui.
2. **Fatie por camada, não por funcionalidade.** Um entrega migration e serviço; o outro
   entrega rota e tela em cima. Dois pull requests de 150 linhas custam menos que um de 500.
3. **Um arquivo por recurso.** Rotas em `apps/api/src/modules/<recurso>/`, telas em
   `apps/web/src/features/<recurso>/`. **Barrel file é proibido no front** — arquivo que
   reexporta tudo é a maior fábrica de conflito do projeto.
4. **Combine na daily quem está em qual arquivo** naquela sprint.

### Arquivos com dono único

- **`apps/api/prisma/schema.prisma` e as migrations** pertencem à Architecture Owner.
  Alteração de schema vem em pull request isolado, nunca junto de funcionalidade.
  **Migration já mergeada nunca é editada** — corrige-se com uma nova.
- Arquivos compartilhados (`app.ts`, `routes.tsx`, `components/ui/`) mudam em alterações
  de uma a três linhas. Se o seu pull request reescreve um deles, pare e converse antes.

### Como revisar

Responda em até 24 horas úteis. Leia o diff inteiro antes de comentar. Separe o que
bloqueia do que é sugestão — e diga qual é qual. Comentário de estilo sobre coisa que o
lint não pega é sugestão, não bloqueio.

Olhe sempre: a história faz o que promete; existe teste novo cobrindo o comportamento;
**toda alteração de pontuação grava auditoria na mesma transação**; a autorização é
conferida no servidor para os três perfis; ninguém consegue ler ou editar dado de outra
equipe; nenhum segredo entrou no diff.

## Testes que tocam o banco

Os testes da API rodam contra `gincana_test`, um banco separado do de desenvolvimento,
criado e migrado automaticamente antes da suíte. Nunca aponte teste para o banco de
desenvolvimento: a carga de demonstração é o que a cliente vê na Sprint Review.

Cada teste cria os próprios dados e limpa o que criou. Não escreva teste que dependa do
seed continuar igual — ele muda.

## Definition of Done

Uma história só está pronta quando **todos** os itens valem:

- [ ] Todos os critérios de aceite foram atendidos
- [ ] O código foi revisado e aprovado por outro desenvolvedor no pull request
- [ ] Os testes automatizados passam na integração contínua
- [ ] Toda alteração de pontuação gera registro de auditoria
- [ ] A funcionalidade está em execução no ambiente de homologação
- [ ] A interface funciona corretamente no computador e no celular
- [ ] O PO aceitou a história e ela foi demonstrada na Sprint Review

## Agentes de IA no repositório

O repositório traz agentes configurados em `.claude/agents/`, cada um com um escopo. Eles
escrevem código e preparam pareceres de revisão.

Três regras valem para todos:

- **Agente não publica.** Nenhum agente faz commit, push, abre pull request ou faz merge.
  O diff é dele; a publicação é sua, no seu nome.
- **Agente não aprova pull request.** A Definition of Done exige aprovação de outro
  desenvolvedor, pessoa física. O agente revisor prepara o parecer; quem decide é você.
- **Agente não decide produto.** Critério de aceite e prioridade são do PO.

Você continua responsável por tudo que sobe com o seu nome no commit.
