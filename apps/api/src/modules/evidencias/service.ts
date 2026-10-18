import type {
  AssinaturaDeUpload,
  Lancamento,
  RegistrarEvidencia,
  RespostaDeAssinatura,
  UsuarioAutenticado,
} from '@gincana/contracts';

import { prisma, type Transacao } from '../../db.js';
import { conflito, naoEncontrado, semPermissao } from '../../middlewares/erros.js';
import { registrarAuditoria } from '../auditoria/registrar.js';
import { montarLancamento, selecaoDoLancamento } from '../lancamentos/service.js';
import { podeMexerNasEvidencias } from '../lancamentos/policy.js';

import { storage } from './storage.js';

/**
 * US07 — o comprovante do lançamento.
 *
 * O arquivo sobe direto do navegador para o armazenamento; a API entra só nas duas
 * pontas, assinando o envio e registrando o que subiu. A consequência prática é que a
 * requisição de registro não prova nada sozinha: tipo e tamanho são conferidos aqui de
 * novo, porque validação de navegador é conforto de quem usa, não controle de acesso.
 *
 * Nada do conteúdo do comprovante entra em log: a foto pode trazer endereço, rosto ou
 * documento de terceiro, e o repositório não é lugar para isso.
 */

interface LancamentoParaEvidencia {
  id: string;
  colaboradorId: string;
  equipeId: string;
  status: 'PENDENTE' | 'APROVADO' | 'RECUSADO';
  tipoAcao: { nome: string };
}

async function carregarLancamento(
  cliente: Transacao,
  id: string,
): Promise<LancamentoParaEvidencia> {
  const lancamento = await cliente.lancamento.findUnique({
    where: { id },
    select: {
      id: true,
      colaboradorId: true,
      equipeId: true,
      status: true,
      tipoAcao: { select: { nome: true } },
    },
  });

  if (!lancamento) {
    throw naoEncontrado('Lançamento não encontrado.');
  }

  return lancamento;
}

/**
 * Só o dono anexa ou remove comprovante, e só enquanto o lançamento está pendente.
 *
 * Depois de avaliado, o conjunto de comprovantes é parte da decisão registrada: trocar a
 * foto de um lançamento aprovado apagaria o contexto de quem aprovou.
 */
function conferirMexidaNasEvidencias(
  usuario: UsuarioAutenticado,
  lancamento: LancamentoParaEvidencia,
): void {
  if (!podeMexerNasEvidencias(usuario, lancamento)) {
    throw semPermissao('Você só pode anexar comprovantes aos seus próprios lançamentos.');
  }

  if (lancamento.status !== 'PENDENTE') {
    throw conflito(
      'LANCAMENTO_JA_AVALIADO',
      lancamento.status === 'APROVADO'
        ? 'Este lançamento já foi aprovado e os comprovantes dele não mudam mais.'
        : 'Este lançamento foi recusado. Corrija-o para voltar a anexar comprovantes.',
    );
  }
}

/**
 * Assina o envio do arquivo.
 *
 * O que volta é o formulário pronto para o navegador postar no armazenamento. A chave
 * secreta fica no servidor: só a assinatura derivada dela atravessa a rede, válida por
 * poucos minutos e amarrada ao identificador sorteado aqui.
 *
 * Tipo e tamanho já foram validados pelo contrato antes de chegar aqui — assinar um envio
 * de 40 MB seria autorizar o problema e só descobrir no registro.
 */
export function assinarEnvioDeEvidencia(
  usuario: UsuarioAutenticado,
  dados: AssinaturaDeUpload,
): RespostaDeAssinatura {
  return storage.assinarUpload({ ...dados, prefixo: usuario.id });
}

/** Quantos comprovantes um lançamento aceita. Acima disso é engano, não zelo. */
const MAXIMO_DE_EVIDENCIAS = 10;

/**
 * Registra na API o arquivo que já subiu.
 *
 * A gravação e a auditoria vivem na mesma transação porque anexar comprovante muda o que
 * sustenta a aprovação: um lançamento que exige evidência passa a poder ser aprovado
 * depois disso, e a trilha precisa explicar quando isso aconteceu.
 */
export async function registrarEvidencia(
  usuario: UsuarioAutenticado,
  lancamentoId: string,
  dados: RegistrarEvidencia,
): Promise<Lancamento> {
  return prisma.$transaction(async (tx) => {
    const lancamento = await carregarLancamento(tx, lancamentoId);
    conferirMexidaNasEvidencias(usuario, lancamento);

    const quantas = await tx.evidencia.count({ where: { lancamentoId } });
    if (quantas >= MAXIMO_DE_EVIDENCIAS) {
      throw conflito(
        'LIMITE_DE_COMPROVANTES',
        `Este lançamento já tem ${MAXIMO_DE_EVIDENCIAS} comprovantes. Remova um antes de anexar outro.`,
      );
    }

    const evidencia = await tx.evidencia.create({
      data: {
        lancamentoId,
        url: dados.url,
        publicId: dados.publicId,
        nomeArquivo: dados.nomeArquivo,
        mimeType: dados.mimeType,
        tamanhoBytes: dados.tamanhoBytes,
        enviadoPorId: usuario.id,
      },
      select: { id: true, nomeArquivo: true, mimeType: true, tamanhoBytes: true, publicId: true },
    });

    // O nome do arquivo entra na trilha; o conteúdo dele, nunca.
    await registrarAuditoria(tx, {
      entidade: 'Lancamento',
      entidadeId: lancamentoId,
      acao: 'ALTERACAO',
      autorId: usuario.id,
      valoresDepois: {
        evidenciaId: evidencia.id,
        nomeArquivo: evidencia.nomeArquivo,
        mimeType: evidencia.mimeType,
        tamanhoBytes: evidencia.tamanhoBytes,
      },
      descricao: `Comprovante "${evidencia.nomeArquivo}" anexado ao lançamento.`,
    });

    return montarLancamento(
      await tx.lancamento.findUniqueOrThrow({
        where: { id: lancamentoId },
        select: selecaoDoLancamento,
      }),
    );
  });
}

/**
 * Remove um comprovante anexado por engano.
 *
 * O arquivo continua no armazenamento externo: apagá-lo de lá é operação de limpeza, não
 * de requisição — e remover o registro já basta para o lançamento deixar de contar com
 * ele. O `publicId` fica na trilha de auditoria, que é o que permite achar o arquivo
 * depois.
 */
export async function removerEvidencia(
  usuario: UsuarioAutenticado,
  lancamentoId: string,
  evidenciaId: string,
): Promise<Lancamento> {
  return prisma.$transaction(async (tx) => {
    const lancamento = await carregarLancamento(tx, lancamentoId);
    conferirMexidaNasEvidencias(usuario, lancamento);

    const evidencia = await tx.evidencia.findUnique({
      where: { id: evidenciaId },
      select: { id: true, lancamentoId: true, nomeArquivo: true, publicId: true },
    });

    if (!evidencia || evidencia.lancamentoId !== lancamentoId) {
      throw naoEncontrado('Comprovante não encontrado neste lançamento.');
    }

    await tx.evidencia.delete({ where: { id: evidenciaId } });

    await registrarAuditoria(tx, {
      entidade: 'Lancamento',
      entidadeId: lancamentoId,
      acao: 'ALTERACAO',
      autorId: usuario.id,
      valoresAntes: {
        evidenciaId: evidencia.id,
        nomeArquivo: evidencia.nomeArquivo,
        publicId: evidencia.publicId,
      },
      descricao: `Comprovante "${evidencia.nomeArquivo}" removido do lançamento.`,
    });

    return montarLancamento(
      await tx.lancamento.findUniqueOrThrow({
        where: { id: lancamentoId },
        select: selecaoDoLancamento,
      }),
    );
  });
}
