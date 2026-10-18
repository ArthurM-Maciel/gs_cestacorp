import {
  lancamentoSchema,
  mimeTypeDeEvidenciaSchema,
  respostaDeAssinaturaSchema,
  type AssinaturaDeUpload,
  type Lancamento,
  type RegistrarEvidencia,
  type RespostaDeAssinatura,
} from '@gincana/contracts';

import { api } from '../../lib/api.js';

/** Falha ao levar o arquivo ao armazenamento. A mensagem já é para quem usa o app. */
export class ErroDeEnvioDoArquivo extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ErroDeEnvioDoArquivo';
  }
}

/** Foto de celular em rede ruim demora; mais que isso é rede caída, não lentidão. */
const TEMPO_LIMITE_DO_ENVIO_MS = 120_000;

/** 1º passo: o servidor assina o envio. A chave do armazenamento nunca chega ao navegador. */
async function pedirAssinatura(arquivo: File): Promise<RespostaDeAssinatura> {
  const mimeType = mimeTypeDeEvidenciaSchema.safeParse(arquivo.type);
  if (!mimeType.success) {
    throw new ErroDeEnvioDoArquivo(
      mimeType.error.issues[0]?.message ?? 'Tipo de arquivo inválido.',
    );
  }

  const corpo: AssinaturaDeUpload = {
    nomeArquivo: arquivo.name.slice(-255),
    mimeType: mimeType.data,
    tamanhoBytes: arquivo.size,
  };
  const { data } = await api.post<unknown>('/evidencias/assinatura', corpo);
  return respostaDeAssinaturaSchema.parse(data);
}

/**
 * 2º passo: o arquivo vai direto ao armazenamento, sem passar pela API.
 *
 * Usa `fetch` e não a instância `api` de propósito: a `api` anexa o token de sessão a toda
 * chamada, e o token da pessoa nunca deve sair para um serviço de terceiro.
 */
async function enviarParaOArmazenamento(
  assinatura: RespostaDeAssinatura,
  arquivo: File,
): Promise<void> {
  // O armazenamento de desenvolvimento aponta para um endereço que não existe: não há para
  // onde mandar os bytes, e o registro na API continua funcionando.
  if (assinatura.provedor === 'fake') {
    return;
  }

  if (!assinatura.urlDeUpload.startsWith('https://')) {
    throw new ErroDeEnvioDoArquivo(
      'O endereço de envio do comprovante não é seguro. Tente de novo e, se persistir, fale com a administradora.',
    );
  }

  const formulario = new FormData();
  for (const [campo, valor] of Object.entries(assinatura.campos)) {
    formulario.append(campo, valor);
  }
  formulario.append('file', arquivo);

  let resposta: Response;
  try {
    resposta = await fetch(assinatura.urlDeUpload, {
      method: 'POST',
      body: formulario,
      // Nenhum cookie ou credencial vai para o serviço de terceiro.
      credentials: 'omit',
      signal: AbortSignal.timeout(TEMPO_LIMITE_DO_ENVIO_MS),
    });
  } catch {
    throw new ErroDeEnvioDoArquivo(
      'Não foi possível enviar o comprovante. Verifique a sua internet e tente de novo.',
    );
  }

  if (!resposta.ok) {
    throw new ErroDeEnvioDoArquivo(
      'O armazenamento não aceitou o comprovante. Tente de novo ou escolha outro arquivo.',
    );
  }
}

/**
 * Pede a assinatura e envia o arquivo. Devolve o que a API precisa para REGISTRAR o
 * comprovante num lançamento (3º passo, `registrarEvidencia`), que só pode acontecer depois
 * que o lançamento existe.
 */
export async function enviarComprovante(arquivo: File): Promise<RegistrarEvidencia> {
  const assinatura = await pedirAssinatura(arquivo);
  await enviarParaOArmazenamento(assinatura, arquivo);

  return {
    url: assinatura.urlPrevista,
    publicId: assinatura.publicId,
    nomeArquivo: arquivo.name.slice(-255),
    mimeType: mimeTypeDeEvidenciaSchema.parse(arquivo.type),
    tamanhoBytes: arquivo.size,
  };
}

export async function registrarEvidencia(
  lancamentoId: string,
  evidencia: RegistrarEvidencia,
): Promise<Lancamento> {
  const { data } = await api.post<unknown>(`/lancamentos/${lancamentoId}/evidencias`, evidencia);
  return lancamentoSchema.parse(data);
}

export async function removerEvidencia(
  lancamentoId: string,
  evidenciaId: string,
): Promise<Lancamento> {
  const { data } = await api.delete<unknown>(
    `/lancamentos/${lancamentoId}/evidencias/${evidenciaId}`,
  );
  return lancamentoSchema.parse(data);
}

/**
 * Só endereços http(s) viram link. O comprovante é um endereço que veio de outra pessoa:
 * um `javascript:` ou `data:` num link que o líder clica seria código rodando na sessão dele.
 */
export function enderecoSeguroDoComprovante(url: string): string | null {
  try {
    const { protocol } = new URL(url);
    return protocol === 'https:' || protocol === 'http:' ? url : null;
  } catch {
    return null;
  }
}
