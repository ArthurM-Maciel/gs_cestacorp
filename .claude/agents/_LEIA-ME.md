# Agentes do repositório

Cinco agentes, um por fronteira de risco do projeto. O roteamento está em `CLAUDE.md`.

| Agente              | Escopo                       | Por que existe separado                                                             |
| ------------------- | ---------------------------- | ----------------------------------------------------------------------------------- |
| `api-dominio`       | `apps/api/src`, `packages/*` | Carrega as invariantes de auditoria e autorização, onde um erro custa caro          |
| `web-telas`         | `apps/web/src`               | Volume alto, risco baixo; precisa do protótipo em contexto, não do modelo de dados  |
| `dados-migrations`  | `apps/api/prisma`            | Único autorizado a mexer no schema; migration ruim custa uma sprint ao time inteiro |
| `revisor-qualidade` | leitura do repositório       | Sem ferramenta de edição de propósito: revisor que conserta deixa de revisar        |
| `devops-ci`         | `.github`, configs           | Mexe no que afeta as oito pessoas de uma vez                                        |

## Como as regras são garantidas

Em duas camadas, porque instrução sozinha não basta:

1. **Instrução** — cada agente tem no próprio prompt o que não pode fazer, e o campo
   `tools` do cabeçalho é uma lista de permissão: o que não está listado não existe para
   ele. O `revisor-qualidade`, por exemplo, não recebe `Edit` nem `Write`.
2. **Permissão** — `settings.json` põe `git commit`, `git push`, `git merge` e abertura de
   pull request em **pergunta**: nada é publicado sem uma pessoa autorizar na hora. O que
   é destrutivo ou toca ambiente hospedado (`push --force`, `prisma migrate deploy`,
   leitura do `.env`) fica **negado**.

Quem quiser pular a pergunta na própria máquina usa `.claude/settings.local.json`, que não
é versionado. A decisão de publicar continua sendo de quem está no teclado — e o commit
sai no nome dessa pessoa, sem nenhum trailer de coautoria de IA.

## O que nenhum deles faz

Decidir produto, aprovar pull request, publicar código, aplicar SQL em banco hospedado, ou
alterar estas próprias regras.
