## História

Refs: US

<!-- Link do card no quadro. Se for trabalho sem história (infra, pipeline), use US00. -->

## O que muda

<!-- Três linhas, em português, do ponto de vista de quem usa. -->

## Como testar

<!-- Passos reproduzíveis. Diga com qual perfil entrar: colaborador, líder ou administradora. -->

1.
2.

## Checklist da Definition of Done

- [ ] Os critérios de aceite da história foram atendidos
- [ ] Há teste automatizado novo cobrindo o comportamento, e `npm run verify` passa
- [ ] Toda alteração de pontuação grava auditoria na mesma transação <!-- ou: não se aplica -->
- [ ] A autorização foi conferida no servidor para os três perfis
- [ ] Testado em tela de celular (360px) e de computador
- [ ] Se há migration: ela é reversível e veio em pull request isolado
- [ ] Nenhum segredo, token ou dado pessoal real entrou no diff
- [ ] `.env.example` atualizado, se alguma variável nova foi usada

## Evidência

<!-- Print em celular e em computador, ou o link da pré-visualização. -->

## Risco e rollback

<!-- O que quebra se der errado e como voltar atrás. -->

---

Acima de 400 linhas úteis? Explique por que não dá para quebrar em dois.
