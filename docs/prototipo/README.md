# Protótipo — Gincana Solidária

Capturas do protótipo no Figma, feitas em 18/10/2026 a partir do modo de apresentação.
Arquivo original: [Gincana Solidária · App](https://www.figma.com/design/kJkwMa5JEO3BqnKnNOqhjD/Gincana-Solid%C3%A1ria-%C2%B7-App).

> As imagens são referência visual. As cores em `apps/web/src/styles.css` foram extraídas
> do arquivo original — o Figma não define variáveis de design, então os valores vieram da
> amostragem das telas. Os espaçamentos continuam sendo aproximação.

## Node-ids dos frames, para consulta no Figma

| Tela                     | Celular | Computador |
| ------------------------ | ------- | ---------- |
| Boas-vindas              | `1:70`  | —          |
| Login                    | `1:97`  | `21:690`   |
| Cadastro                 | `1:134` | `21:726`   |
| Início do colaborador    | `1:167` | `21:1062`  |
| Escolher ação            | `1:227` | `21:1158`  |
| Registrar ação           | `1:32`  | `21:1158`  |
| Placar                   | `1:273` | `21:1219`  |
| Aprovações do líder      | `1:343` | `21:1640`  |
| Painel da administradora | —       | `21:1748`  |
| Regras                   | `1:405` | `18:125`   |
| Nova regra               | `1:463` | `18:352`   |
| Equipes                  | —       | `21:1834`  |

## Identidade visual

| Uso                                  | Cor       |
| ------------------------------------ | --------- |
| Topo das telas e menu lateral        | `#1e3a2f` |
| Botão primário e números em destaque | `#2f7d4f` |
| Realce e pódio                       | `#a7e3b9` |
| Fundo da aplicação                   | `#eef5f0` |
| Texto                                | `#0d1b14` |

Cantos bem arredondados, cartões brancos com sombra suave, títulos grandes em duas linhas
com a segunda em verde.

Cada família de ação tem cor própria, para o colaborador reconhecer o tipo antes de ler:
alimentos `#ffe7d6`, tampinhas `#ddf3f0`, roupas `#dcebff`, curso ou PDI `#ece4ff` e
outra ação `#fff3c4`.

Estados do lançamento: pendente `#8a5a00` sobre `#fdf1d6`, aprovado `#245f3c` sobre
`#e3f3e8`, recusado `#b3261e` sobre `#fbeaea`.

## Telas por perfil

O protótipo cobre os três perfis em **mobile** e em **desktop**. A navegação mobile é uma
barra inferior; a desktop é uma barra lateral escura.

### 01 · Acesso (`01-acesso-mobile.png`, `05-acesso-web.png`)

Boas-vindas ("Faça o bem e some pontos!"), login e criação de conta. O login avisa
"Acesso só para colaboradores — o login usa o seu e-mail corporativo". O cadastro pede
nome, e-mail da Cestacorp, **seleção de equipe**, senha (mínimo 8 caracteres com um
número) e um aceite explícito: "Aceito o uso dos meus dados na gincana (LGPD)".

### 02 · Colaborador (`02-colaborador-mobile.png`, `06-colaborador-web.png`)

- **Início:** saudação, posição da equipe ("Sua equipe está em segundo lugar!"), cartão
  com o total de pontos e a distância para o líder, botão "+ Registrar ação" e a lista
  "Meus lançamentos" com status por cor — Pendente, Aprovado, Recusado. O recusado mostra
  o motivo ("Foto sem etiqueta da ONG") e um link "Reenviar".
- **Escolher ação:** grade de tipos de ação com os pontos por unidade visíveis, filtros
  (Todas, Doações, Cursos) e um card "Outra ação — a Marieri avalia e define os pontos".
- **Registrar:** quantidade com stepper, área de comprovante ("Tirar foto ou escolher
  arquivo · Foto, PDF ou certificado") e o **cálculo em tempo real** em destaque
  ("+120 pts · Vai para aprovação de Arthur, líder da equipe").
- **Placar:** pódio com as três primeiras equipes, alternância Geral / Esta semana e
  ranking completo com líder e número de ações.

### 03 · Líder da equipe (`03-lider-mobile.png`, `07-lider-web.png`)

Fila de aprovações com contador ("Você tem 3 aprovações"), abas Pendentes / Aprovados /
Recusados e, em cada item, ação, quantidade, colaborador, data e pontos, com os botões
Recusar e Aprovar. No desktop vira tabela com a coluna "Ver comprovante" e a instrução
"Abra o comprovante antes de aprovar. Cada decisão fica no histórico."

### 04 · Administradora (`04-administradora-mobile.png`, `08-administradora-web.png`)

- **Painel (desktop):** cartões de equipes, lançamentos, aguardando aprovação e regras
  ativas, mais o ranking e a fila de pendentes.
- **Regras de pontuação:** lista com ação, unidade, pontos por unidade, exigência de
  comprovante e status Ativa/Pausada. Rodapé decisivo para o modelo de dados:
  **"Mudanças valem só para lançamentos novos e ficam registradas no histórico."**
- **Nova regra:** nome da ação, unidade (kg · unidade · peça · certificado), pontos por
  unidade, dois interruptores (comprovante obrigatório; aprovação do líder, com a nota "A
  Marieri também pode aprovar") e um exemplo calculado ao vivo: "3 kg de tampinhas = 30 pts".
- **Equipes:** 6 equipes e 13 colaboradores, com líder, nº de colaboradores, ações
  aprovadas e pontos. Nota: "Cada equipe tem um líder, que aprova os lançamentos da
  própria equipe."

## Dados de exemplo do protótipo

Equipes: Ipê (Fernanda, 4.280 pts), Araucária (Arthur, 3.910), Jacarandá (Bruno, 3.355),
Paineira (Juliana, 3.120), Figueira (Marcos, 2.870), Pitanga (Letícia, 2.540).
Tipos de ação: alimentos (10 pts/kg), tampinhas (10 pts/kg), roupas (15 pts/peça),
curso ou PDI (50 pts/certificado). Use-os no seed para que a demo bata com o protótipo.

## Lacunas conhecidas

- **US09 (trilha de auditoria) não tem tela no protótipo.** O protótipo só promete que
  "cada decisão fica no histórico". A tela de histórico — quem aprovou, quem alterou, o
  valor antes e depois — precisa ser desenhada ou definida com a PO antes da S3.
- O cadastro permite o colaborador **escolher a própria equipe**, enquanto a US03 diz que
  a Marieri vincula colaboradores às equipes. Confirmar qual vale.
- Não há tela de cadastro de gincana (US02) nem de edição de período, embora o protótipo
  mostre "Gincana 2026" como contexto fixo.
