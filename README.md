# Gincana Solidária · Cestacorp

Sistema web que substitui a planilha da Gincana Solidária da Cestacorp. O colaborador
registra a própria ação com comprovante, o líder da equipe aprova, os pontos saem da regra
cadastrada e o placar por equipe se atualiza sozinho. Nenhuma pontuação muda sem registro
de auditoria — o sistema também serve de evidência para o PQCRS/Sescon-RS.

Projeto da disciplina de Gerenciamento de Projetos, PUCRS, 2026. Cliente: Marieri Gazen.

## Perfis

| Perfil                       | Pode                                                                                                                                     |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Colaborador**              | Registrar as próprias ações com comprovante, acompanhar o status delas e ver o placar                                                    |
| **Líder de equipe**          | Tudo do colaborador, mais aprovar ou recusar os lançamentos **da própria equipe**                                                        |
| **Administradora** (Marieri) | Cadastrar gincana, equipes, colaboradores e regras de pontuação; aprovar lançamentos de qualquer equipe; consultar a trilha de auditoria |

## Stack

Monorepo em npm workspaces.

- `apps/web` — React + Vite + TypeScript + Tailwind, responsivo para computador e celular
- `apps/api` — Node + Express + Prisma, API REST com autenticação JWT
- `packages/scoring` — cálculo de pontos, função pura e testada, usada pela API e pelo front
- `packages/contracts` — schemas zod e tipos compartilhados entre os dois lados
- PostgreSQL para os dados, armazenamento externo para os comprovantes

## Como rodar

```bash
cp .env.example .env        # preencha as variáveis descritas no arquivo
docker compose up -d db     # sobe o PostgreSQL local
npm ci                      # instala as dependências de todos os workspaces
npm run db:reset            # aplica as migrations e carrega os dados de exemplo
npm run dev                 # sobe a API e o front juntos
```

Requer Node 22 (veja `.nvmrc`; com nvm, `nvm use`) e Docker para o banco local.

Antes de abrir um pull request, rode `npm run verify` — é o mesmo conjunto de verificações
que a integração contínua executa.

## Documentação

- [`CONTRIBUTING.md`](CONTRIBUTING.md) — fluxo de trabalho, convenções e Definition of Done.
  **Leia antes do primeiro pull request.**
- [`docs/prototipo/`](docs/prototipo/) — telas do protótipo e inventário por perfil
- [`docs/inception.md`](docs/) — escopo, backlog e riscos (em elaboração)

## Ambientes

- **Desenvolvimento:** máquina de cada integrante
- **Homologação:** o que está na `main`, onde a cliente valida na Sprint Review
- **Produção:** usada no piloto, fora do escopo da disciplina

> A API de homologação roda em plano gratuito e hiberna por inatividade: o primeiro acesso
> depois de um tempo parado pode levar cerca de 30 segundos. Acorde o ambiente antes de uma
> demonstração.

## Time

| Papel              | Pessoa                               |
| ------------------ | ------------------------------------ |
| Product Owner      | Victor                               |
| Architecture Owner | Marina                               |
| Team Lead          | Felipe                               |
| Desenvolvedores    | João, Brenda, Arthur, Antônio, Lucas |
| Cliente            | Marieri Gazen (Cestacorp)            |

## Calendário

| Sprint | Período       | Entrega                                                        |
| ------ | ------------- | -------------------------------------------------------------- |
| S1     | 28/10 a 04/11 | Gincana, equipes, tipos de ação e cálculo automático de pontos |
| S2     | 05/11 a 12/11 | Registro com comprovante, aprovação e placar por equipe        |
| S3     | 13/11 a 19/11 | Trilha de auditoria, ajustes finais e apresentação             |

Sprint Review com a cliente ao final de cada sprint. Congelamento de código em 18/11.
