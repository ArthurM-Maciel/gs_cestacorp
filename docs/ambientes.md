# Ambientes

| Ambiente        | Onde                                  | O que roda                                |
| --------------- | ------------------------------------- | ----------------------------------------- |
| Desenvolvimento | máquina de cada pessoa                | `docker compose up -d db` + `npm run dev` |
| Homologação     | Render (API e banco) e Vercel (front) | o que está na `main`                      |
| Produção        | definido no piloto                    | fora do escopo da disciplina              |

## O que precisa ser configurado à mão, uma vez

Nenhum destes passos é automatizável a partir do repositório, e nenhum deles é feito por
agente de IA.

1. **Render** — conectar a conta ao repositório e apontar para `render.yaml`. O serviço e
   o banco nascem dali. Depois de criado, preencher no painel: `CORS_ORIGINS` (a URL do
   front na Vercel) e as três chaves do Cloudinary.
2. **Vercel** — importar o repositório; o `vercel.json` já descreve o build do monorepo.
   Definir `VITE_API_URL` com a URL pública da API no Render.
3. **Cloudinary** — criar a conta gratuita e copiar as três chaves. O segredo nunca vai
   ao navegador: a API assina o envio e o arquivo sobe direto do aparelho da pessoa.

   > **Atenção antes da Sprint Review.** Sem essas três variáveis preenchidas, a API
   > sobe normalmente, mas usa um armazenamento **falso**: a tela aceita o comprovante,
   > o lançamento é criado e aprovado, e nenhum arquivo é guardado de verdade. Isso
   > existe para desenvolvimento e testes rodarem sem rede e sem conta, e é exatamente
   > o tipo de coisa que passa despercebida até alguém procurar o comprovante.
   >
   > Variável vazia conta como ausente. Depois de preencher no painel, registre um
   > lançamento com foto em homologação e confira que o arquivo aparece no Cloudinary.

4. **GitHub Secrets** — `RENDER_DEPLOY_HOOK` e `DATABASE_URL` de homologação, usados pelo
   job que aplica as migrations antes do deploy.

## Variáveis

Todas estão em `.env.example`, com valor fictício. Variável nova entra lá no mesmo pull
request que passa a usá-la — o template de pull request cobra isso.

## O plano gratuito hiberna

A API no Render dorme após alguns minutos sem tráfego e leva cerca de 30 segundos para
voltar. Antes de uma Sprint Review, abra `/health` uma vez para acordar o serviço. Não
vale criar execução agendada para mantê-la acordada: queima os minutos de integração
contínua e é justamente o que o plano gratuito não oferece.
