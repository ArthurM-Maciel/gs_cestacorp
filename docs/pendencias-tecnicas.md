# Pendências técnicas

Achados de revisão que não bloqueiam a entrega atual, mas cobram juros se ficarem para
depois. Cada item diz o que fazer e quando dói. Vire issue no quadro quando o time
decidir a prioridade.

## Antes da homologação

### Limite de tentativas no login

`POST /auth/login` é o único endpoint público e não tem limite por IP nem por e-mail.
São 13 contas com e-mail corporativo previsível; o bcrypt de custo 10 atrasa o ataque,
não o impede. Curiosamente, o front já tem a mensagem para o 429 — a intenção existia e
ficou pelo caminho.

**O que fazer:** `express-rate-limit` no login, limitando por IP e por e-mail.
**Quando dói:** quando o sistema sair da rede interna.

## Antes das histórias de aprovação (US08)

### `papel: 'LIDER'` pode existir sem equipe liderada

Pelo lado da equipe, promover e despromover mantêm papel e liderança em sincronia. Pelo
lado do colaborador, `POST /colaboradores` e `PATCH /colaboradores/:id` aceitam
`papel: 'LIDER'` sem vínculo nenhum. Hoje não vaza dado — a política de leitura já
convive com isso — mas a conta chega quando "líder avalia a própria equipe" precisar
decidir o que fazer com um líder cujo `equipeLideradaId` é nulo.

**O que fazer:** decidir entre recusar `LIDER` para quem não lidera equipe, ou tratar o
papel como derivado de `equipeLiderada` e parar de aceitá-lo na entrada. É conversa de
dez minutos na daily, não decisão de uma pessoa só.
**Quando dói:** na US08.

## Para a Architecture Owner

### O vínculo com equipe é global, não por gincana

No schema, `Equipe.liderId` é `@unique` e `Colaborador.equipeId` aponta para uma única
equipe — ambos valem para o banco inteiro, enquanto equipes pertencem a uma gincana.

O placar sobrevive, porque `Lancamento.equipeId` é congelado no lançamento. O problema
aparece na virada para a gincana seguinte: montar as equipes novas tira todo mundo das
equipes do ano anterior, e nomear como líder alguém que já liderou vai esbarrar na
restrição.

**O que fazer:** decidir se o vínculo de colaborador com equipe deveria ser por gincana.
Mexe em `schema.prisma`, que tem dona única, e vem em pull request isolado.
**Quando dói:** na segunda edição da gincana — fora do escopo de 19/11, mas o épico E7
(gincanas de vários anos) promete isso desde a inception.

## Processo

### US02 e US03 não fecham a Definition of Done sem tela

A API das duas histórias está pronta e testada, mas a DoD exige interface funcionando e
demonstração aceita pela PO. Enquanto as telas de administradora não entrarem, essas
histórias são trabalho habilitador, não histórias prontas — e na Sprint Review só
poderiam ser mostradas por ferramenta de API, o que não demonstra nada para a cliente.

**O que fazer:** manter US02 e US03 fora da coluna Pronto até as telas entrarem, ou
combinar com o PO que a aceitação delas cai na sprint seguinte.
