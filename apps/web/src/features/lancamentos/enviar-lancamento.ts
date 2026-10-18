import {
  lancamentoSchema,
  type AtualizarLancamento,
  type CriarLancamento,
  type Lancamento,
  type RegistrarEvidencia,
} from '@gincana/contracts';
import { isAxiosError } from 'axios';

import { api } from '../../lib/api.js';
import {
  enviarComprovante,
  registrarEvidencia,
  removerEvidencia,
} from '../evidencias/evidencias-api.js';

/** Onde o envio está, para a tela dizer o que está acontecendo enquanto o botão espera. */
export type EtapaDoEnvio = 'enviando-comprovante' | 'registrando';

/**
 * O lançamento já existe na API, mas o comprovante não chegou até ele. A tela leva a pessoa
 * para onde o lançamento aparece, com um aviso e o caminho para anexar de novo: tentar
 * "enviar" outra vez criaria um segundo lançamento igual.
 */
export class EnvioParcial extends Error {
  constructor(
    readonly lancamento: Lancamento,
    readonly causa: unknown,
  ) {
    super('O lançamento foi registrado, mas o comprovante não chegou até ele.');
    this.name = 'EnvioParcial';
  }
}

/**
 * Arquivos que já subiram nesta tela. Se o registro falhar por um motivo que a pessoa
 * conserta (uma data fora do período, por exemplo), o segundo envio do formulário não
 * repete o upload de uma foto de vários megabytes numa rede de celular.
 */
export type ArquivosEnviados = WeakMap<File, RegistrarEvidencia>;

type AoMudarEtapa = (etapa: EtapaDoEnvio) => void;

async function enviarUmaVez(
  arquivo: File,
  enviados: ArquivosEnviados,
  aoMudarEtapa: AoMudarEtapa,
): Promise<RegistrarEvidencia> {
  const jaEnviado = enviados.get(arquivo);
  if (jaEnviado !== undefined) {
    return jaEnviado;
  }
  aoMudarEtapa('enviando-comprovante');
  const enviado = await enviarComprovante(arquivo);
  enviados.set(arquivo, enviado);
  return enviado;
}

/** O que a pessoa preencheu no formulário de registro. */
export interface PedidoDeRegistro {
  dados: CriarLancamento;
  arquivo: File | null;
}

interface EntradaDoRegistro extends PedidoDeRegistro {
  enviados: ArquivosEnviados;
  aoMudarEtapa: AoMudarEtapa;
}

/**
 * US06 + US07, nesta ordem:
 *
 * 1. envia o arquivo ao armazenamento (assinatura + upload);
 * 2. cria o lançamento;
 * 3. registra o comprovante no lançamento.
 *
 * O arquivo vai primeiro porque uma falha de rede no upload, que é o passo mais lento e o
 * que mais falha no celular, não deixa nada para trás: nenhum lançamento sem comprovante.
 */
export async function registrarLancamento(entrada: EntradaDoRegistro): Promise<Lancamento> {
  const { dados, arquivo, enviados, aoMudarEtapa } = entrada;
  const evidencia = arquivo === null ? null : await enviarUmaVez(arquivo, enviados, aoMudarEtapa);

  aoMudarEtapa('registrando');
  const resposta = await api.post<unknown>('/lancamentos', dados);
  const criado = lancamentoSchema.parse(resposta.data);

  if (evidencia === null) {
    return criado;
  }

  try {
    return await registrarEvidencia(criado.id, evidencia);
  } catch (causa) {
    throw new EnvioParcial(criado, causa);
  }
}

/** O que a pessoa mudou no formulário de correção. */
export interface PedidoDeCorrecao {
  dados: AtualizarLancamento;
  /** Comprovantes já anexados que ela descartou. */
  evidenciasARemover: readonly string[];
  arquivo: File | null;
}

interface EntradaDaCorrecao extends PedidoDeCorrecao {
  lancamentoId: string;
  enviados: ArquivosEnviados;
  aoMudarEtapa: AoMudarEtapa;
}

/**
 * Corrigir e reenviar: o `PATCH` devolve o lançamento recusado para a fila (PENDENTE) e só
 * depois disso a API aceita mexer nos comprovantes. Por isso a ordem é: subir o arquivo
 * novo, corrigir, remover os comprovantes descartados e registrar o novo.
 *
 * Se um passo depois do `PATCH` falhar, o lançamento já voltou para a fila: o erro sai como
 * `EnvioParcial` e a tela diz exatamente isso.
 */
export async function corrigirLancamento(entrada: EntradaDaCorrecao): Promise<Lancamento> {
  const { lancamentoId, dados, evidenciasARemover, arquivo, enviados, aoMudarEtapa } = entrada;
  const evidencia = arquivo === null ? null : await enviarUmaVez(arquivo, enviados, aoMudarEtapa);

  aoMudarEtapa('registrando');
  const resposta = await api.patch<unknown>(`/lancamentos/${lancamentoId}`, dados);
  let atual = lancamentoSchema.parse(resposta.data);

  try {
    for (const evidenciaId of evidenciasARemover) {
      try {
        atual = await removerEvidencia(lancamentoId, evidenciaId);
      } catch (erro) {
        // Já removido numa tentativa anterior: o resultado é o que a pessoa queria.
        if (!(isAxiosError(erro) && erro.response?.status === 404)) {
          throw erro;
        }
      }
    }
    if (evidencia !== null) {
      atual = await registrarEvidencia(lancamentoId, evidencia);
    }
  } catch (causa) {
    throw new EnvioParcial(atual, causa);
  }

  return atual;
}
