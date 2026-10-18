import { z } from 'zod';

import { idSchema } from './comum.js';

/**
 * US07 — o colaborador anexa foto ou arquivo como comprovante.
 *
 * O arquivo nunca passa pela API: o navegador pede uma assinatura, envia direto ao
 * armazenamento e depois registra aqui o que subiu. Isso mantém a API leve no plano
 * gratuito de hospedagem e evita um limite de corpo de requisição no meio da Sprint
 * Review — mas tem um preço: o que o navegador registra precisa ser conferido de novo no
 * servidor, porque a requisição de registro é só mais uma chamada HTTP.
 *
 * Por isso tipo e tamanho são validados nas duas pontas, e o segredo do armazenamento
 * nunca sai do servidor: o navegador recebe a assinatura pronta, não a chave.
 */

/** Foto do comprovante ou certificado em PDF. Nada além disso entra. */
export const mimeTypesDeEvidencia = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;
export const mimeTypeDeEvidenciaSchema = z.enum(mimeTypesDeEvidencia, {
  message: 'Envie uma foto (JPG, PNG ou WebP) ou um PDF.',
});
export type MimeTypeDeEvidencia = z.infer<typeof mimeTypeDeEvidenciaSchema>;

/** 5 MB: cabe foto de celular sem obrigar ninguém a redimensionar antes. */
export const TAMANHO_MAXIMO_DE_EVIDENCIA_BYTES = 5 * 1024 * 1024;

export const tamanhoDeEvidenciaSchema = z
  .number({ message: 'Informe o tamanho do arquivo.' })
  .int('Tamanho de arquivo inválido.')
  .positive('O arquivo está vazio.')
  .max(TAMANHO_MAXIMO_DE_EVIDENCIA_BYTES, 'O arquivo precisa ter no máximo 5 MB.');

export const nomeDeArquivoSchema = z
  .string()
  .trim()
  .min(1, 'Informe o nome do arquivo.')
  .max(255, 'O nome do arquivo é longo demais.');

/** O que o navegador pede antes de enviar o arquivo. */
export const assinaturaDeUploadSchema = z.object({
  nomeArquivo: nomeDeArquivoSchema,
  mimeType: mimeTypeDeEvidenciaSchema,
  tamanhoBytes: tamanhoDeEvidenciaSchema,
});
export type AssinaturaDeUpload = z.infer<typeof assinaturaDeUploadSchema>;

/**
 * A resposta da assinatura.
 *
 * `campos` é o formulário que o navegador posta em `urlDeUpload`, já com a assinatura
 * calculada no servidor. A chave secreta do armazenamento não aparece em lugar nenhum
 * daqui — só a assinatura derivada dela, válida para este envio e por tempo limitado.
 */
export const respostaDeAssinaturaSchema = z.object({
  provedor: z.enum(['cloudinary', 'fake']),
  urlDeUpload: z.string(),
  campos: z.record(z.string(), z.string()),
  publicId: z.string(),
  /** A URL em que o arquivo ficará disponível depois do envio. */
  urlPrevista: z.string(),
  expiraEm: z.string(),
});
export type RespostaDeAssinatura = z.infer<typeof respostaDeAssinaturaSchema>;

/**
 * O registro do arquivo já enviado.
 *
 * Tipo e tamanho vêm de novo porque esta chamada é independente do envio: validar só no
 * navegador deixaria a porta aberta para um PDF de 40 MB entrar na lista de comprovantes.
 */
export const registrarEvidenciaSchema = z.object({
  url: z.url({ message: 'Endereço do arquivo inválido.' }).max(2000),
  publicId: z.string().trim().min(1, 'Identificador do arquivo ausente.').max(255),
  nomeArquivo: nomeDeArquivoSchema,
  mimeType: mimeTypeDeEvidenciaSchema,
  tamanhoBytes: tamanhoDeEvidenciaSchema,
});
export type RegistrarEvidencia = z.infer<typeof registrarEvidenciaSchema>;

export const evidenciaSchema = z.object({
  id: idSchema,
  lancamentoId: idSchema,
  url: z.string(),
  publicId: z.string(),
  nomeArquivo: z.string(),
  mimeType: z.string(),
  tamanhoBytes: z.number().int(),
  enviadoPorId: idSchema,
  criadoEm: z.string(),
});
export type Evidencia = z.infer<typeof evidenciaSchema>;
