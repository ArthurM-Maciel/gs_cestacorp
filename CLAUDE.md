# Gincana Solidária · Cestacorp

Sistema que substitui a planilha da gincana solidária da Cestacorp (13 colaboradores).
O colaborador registra a própria ação com comprovante, o líder da equipe aprova, os pontos
saem da regra cadastrada e o placar por equipe se atualiza. O sistema também é a evidência
do selo de qualidade contábil PQCRS — por isso a trilha de auditoria não é um detalhe.

Projeto acadêmico da PUCRS, três sprints de uma semana, de 28/10 a 19/11/2026.
Leia `CONTRIBUTING.md` antes de qualquer alteração.

## Perfis

- **Colaborador** — registra as próprias ações, acompanha o status e vê o placar
- **Líder de equipe** — aprova ou recusa lançamentos **da própria equipe**
- **Administradora** (Marieri) — cadastra gincana, equipes e regras; aprova qualquer
  lançamento; consulta a auditoria

## Mapa do repositório

| Caminho                            | O que vive aqui                                                 |
| ---------------------------------- | --------------------------------------------------------------- |
| `apps/api/src/modules/<recurso>/`  | Rotas, serviços, políticas de autorização e testes da API       |
| `apps/api/prisma/`                 | Schema, migrations e seed. **Dono único: a Architecture Owner** |
| `apps/web/src/features/<recurso>/` | Uma pasta por história; é o que permite trabalho em paralelo    |
| `apps/web/src/components/ui/`      | Componentes compartilhados. Mudanças aqui afetam todo mundo     |
| `packages/scoring/`                | Cálculo de pontos. Função pura, sem banco e sem HTTP            |
| `packages/contracts/`              | Schemas zod e tipos compartilhados entre API e front            |
| `docs/prototipo/`                  | Telas do protótipo e inventário por perfil                      |

## Regras invariantes

Estas valem em qualquer alteração, sem exceção:

1. **Toda alteração de pontuação grava auditoria na mesma transação.** Criar, alterar,
   aprovar ou recusar um lançamento, e mudar uma regra, passam por
   `registrarAuditoria(tx, …)`. Se a transação falha, a auditoria não fica órfã e a
   pontuação não existe. Código que muda pontos sem auditoria é reprovado na revisão.
2. **As regras de pontuação ficam em cadastro, nunca no código.** Elas mudam durante a
   gincana e atividades extras são criadas no meio dela. Nenhum `if` com nome de ação,
   nenhuma tabela de pontos constante no fonte.
3. **Pontos são congelados no lançamento.** Grave `regraPontuacaoId` e
   `pontosPorUnidadeAplicado` junto do lançamento. Mudar a regra depois **não** recalcula
   o que já foi apurado — o protótipo promete isso à cliente em texto.
4. **Autorização é sempre conferida no servidor**, nunca por informação vinda do front.
   Líder só avalia a própria equipe; colaborador só enxerga os próprios lançamentos. O
   escopo entra no `where` da consulta, não num filtro aplicado depois.
5. **Mobile-first.** A Definition of Done exige a interface funcionando no celular. Cada
   tela é desenhada em 360px antes do desktop.
6. **Migration mergeada é imutável.** Corrige-se com uma nova, nunca editando a anterior.
7. **Nenhum dado pessoal de colaborador em log, teste ou seed de integração contínua.**

## Comandos

```bash
npm run dev          # sobe API e front juntos
npm run verify       # lint + formatação + tipos + testes (o mesmo que a CI roda)
npm test -w @gincana/scoring
npm run db:reset     # recria o banco local e carrega o seed de demonstração
docker compose up -d db
```

Rode `npm run verify` antes de entregar qualquer trabalho.

## Qual agente usar

| Tarefa                                                       | Agente              |
| ------------------------------------------------------------ | ------------------- |
| Endpoint, serviço, regra de negócio, autorização             | `api-dominio`       |
| Tela, componente, formulário, responsividade                 | `web-telas`         |
| Tabela, coluna, índice, migration, seed                      | `dados-migrations`  |
| Revisar o próprio trabalho antes do PR, ou o PR de um colega | `revisor-qualidade` |
| Workflow, deploy, variáveis de ambiente, CI vermelha         | `devops-ci`         |

## Convenções de código

- Domínio em português (`gincana`, `lancamento`, `equipe`, `tipoAcao`, `colaborador`);
  termos técnicos em inglês (`middleware`, `handler`, `router`).
- TypeScript estrito. `any` é erro de lint — ele apaga justamente a checagem que protege
  o cálculo de pontos.
- Texto de interface em português do Brasil, incluindo mensagem de erro.
- Sem barrel file no front: arquivo que reexporta tudo é a maior fonte de conflito aqui.
- Erros da API saem no formato `{ erro: { codigo, mensagem, detalhes? } }`.

## O que nenhum agente faz

- **Publicar:** nada de `git commit`, `git push`, abrir pull request ou fazer merge.
  O agente produz o diff; quem publica é a pessoa, no nome dela.
- **Aprovar pull request:** a Definition of Done exige aprovação de outro desenvolvedor,
  pessoa física.
- **Decidir produto:** critério de aceite e prioridade são do PO.
- **Tocar em banco hospedado:** nenhuma migration ou SQL aplicado em homologação ou
  produção a partir daqui.
- **Mudar as próprias regras:** `CLAUDE.md`, `.claude/`, `CODEOWNERS` e `CONTRIBUTING.md`
  só mudam por decisão do time.

Commits saem em nome de quem está trabalhando, **sem nenhum trailer de coautoria de IA**.
A integração contínua recusa o pull request que tiver um.
