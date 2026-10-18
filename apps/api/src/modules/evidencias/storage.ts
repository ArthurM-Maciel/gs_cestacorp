import { createHash, randomUUID } from 'node:crypto';

import type { AssinaturaDeUpload, RespostaDeAssinatura } from '@gincana/contracts';

import { env } from '../../env.js';

/**
 * US07 — o envio do comprovante não passa pela API.
 *
 * O navegador pede uma assinatura, envia o arquivo direto ao armazenamento e depois
 * registra na API o que subiu. A API fica fora do caminho do byte: não há limite de corpo
 * de requisição para estourar nem memória de contêiner gratuito para encher com uma foto
 * de 5 MB.
 *
 * O que sai daqui para o navegador é sempre uma assinatura derivada, com validade curta e
 * amarrada a um `public_id` específico. `CLOUDINARY_API_SECRET` fica no servidor: ela
 * entra no cálculo do hash e não aparece na resposta, em log nem em mensagem de erro.
 */

/** Dados do arquivo que a assinatura cobre. */
export interface PedidoDeAssinatura extends AssinaturaDeUpload {
  /** Prefixo do identificador no armazenamento, para separar por colaborador. */
  readonly prefixo: string;
}

export interface StorageAdapter {
  readonly nome: 'cloudinary' | 'fake';
  assinarUpload(pedido: PedidoDeAssinatura): RespostaDeAssinatura;
  /** Confere se a URL registrada pertence mesmo a este armazenamento. */
  aceitaUrl(url: string): boolean;
}

/** A assinatura vale por 10 minutos: tempo de escolher o arquivo e enviar, não mais. */
const VALIDADE_EM_SEGUNDOS = 10 * 60;

const EXTENSOES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

function extensaoDe(mimeType: string): string {
  return EXTENSOES[mimeType] ?? 'bin';
}

/**
 * O identificador é sorteado no servidor, nunca derivado do nome do arquivo enviado.
 *
 * Nome de arquivo é entrada do cliente: aceitar `../` ali seria deixar o navegador
 * escolher onde o arquivo cai no armazenamento. O nome original continua guardado na
 * coluna `nomeArquivo`, para a tela mostrar "comprovante-tampinhas.jpg".
 */
function sortearPublicId(prefixo: string): string {
  return `${prefixo}/${randomUUID()}`;
}

/**
 * Assinatura da Cloudinary: os parâmetros em ordem alfabética, concatenados como
 * `chave=valor` separados por `&`, com o segredo colado no fim e tudo passado por SHA-1.
 * É o formato que a própria Cloudinary confere ao receber o envio.
 */
export function assinarParametros(parametros: Record<string, string>, segredo: string): string {
  const base = Object.keys(parametros)
    .sort()
    .map((chave) => `${chave}=${parametros[chave]}`)
    .join('&');

  return createHash('sha1').update(`${base}${segredo}`).digest('hex');
}

export function criarAdaptadorCloudinary(
  cloudName: string,
  apiKey: string,
  apiSecret: string,
  pasta: string,
): StorageAdapter {
  const urlDeUpload = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;

  return {
    nome: 'cloudinary',
    assinarUpload(pedido) {
      const timestamp = Math.floor(Date.now() / 1000);
      const publicId = sortearPublicId(`${pasta}/${pedido.prefixo}`);

      // Só o que a Cloudinary assina entra aqui; `api_key` e `signature` ficam de fora.
      const assinados: Record<string, string> = {
        public_id: publicId,
        timestamp: String(timestamp),
      };

      return {
        provedor: 'cloudinary',
        urlDeUpload,
        campos: {
          ...assinados,
          api_key: apiKey,
          signature: assinarParametros(assinados, apiSecret),
        },
        publicId,
        urlPrevista: `https://res.cloudinary.com/${cloudName}/image/upload/${publicId}.${extensaoDe(pedido.mimeType)}`,
        expiraEm: new Date((timestamp + VALIDADE_EM_SEGUNDOS) * 1000).toISOString(),
      };
    },
    aceitaUrl(url) {
      return url.startsWith(`https://res.cloudinary.com/${cloudName}/`);
    },
  };
}

/** Base do armazenamento falso. `.invalido` nunca resolve: ninguém sobe nada de verdade. */
export const BASE_DO_ARMAZENAMENTO_FAKE = 'https://armazenamento.local.invalido';

/**
 * O armazenamento de mentira do ambiente local e da suíte.
 *
 * Devolve a mesma forma de resposta do adaptador real — provedor, URL, campos, prazo —
 * para que o front exercite exatamente o mesmo fluxo sem conta em serviço externo e sem
 * nenhum segredo configurado. A "assinatura" aqui é um valor sorteado, sem significado
 * criptográfico, e está explicitamente marcada como falsa.
 */
export function criarAdaptadorFake(pasta = 'gincana/evidencias'): StorageAdapter {
  return {
    nome: 'fake',
    assinarUpload(pedido) {
      const publicId = sortearPublicId(`${pasta}/${pedido.prefixo}`);

      return {
        provedor: 'fake',
        urlDeUpload: `${BASE_DO_ARMAZENAMENTO_FAKE}/upload`,
        campos: {
          public_id: publicId,
          timestamp: String(Math.floor(Date.now() / 1000)),
          signature: `fake-${randomUUID()}`,
        },
        publicId,
        urlPrevista: `${BASE_DO_ARMAZENAMENTO_FAKE}/${publicId}.${extensaoDe(pedido.mimeType)}`,
        expiraEm: new Date(Date.now() + VALIDADE_EM_SEGUNDOS * 1000).toISOString(),
      };
    },
    aceitaUrl(url) {
      return url.startsWith(`${BASE_DO_ARMAZENAMENTO_FAKE}/`);
    },
  };
}

/**
 * Escolhe o adaptador pela configuração do ambiente.
 *
 * Com as três variáveis da Cloudinary presentes, vale o armazenamento real. Faltando
 * qualquer uma, cai no falso — e a API sobe do mesmo jeito. Meia configuração nunca vira
 * meia assinatura: ou assina de verdade, ou assume que é mentira e diz isso na resposta.
 */
export function criarStorageAdapter(): StorageAdapter {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_PASTA } =
    env;

  if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
    return criarAdaptadorCloudinary(
      CLOUDINARY_CLOUD_NAME,
      CLOUDINARY_API_KEY,
      CLOUDINARY_API_SECRET,
      CLOUDINARY_PASTA,
    );
  }

  return criarAdaptadorFake(CLOUDINARY_PASTA);
}

/** Instância única do processo. */
export const storage: StorageAdapter = criarStorageAdapter();
