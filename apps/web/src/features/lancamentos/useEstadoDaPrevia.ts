import { previaDeLancamentoSchema, type Unidade } from '@gincana/contracts';
import { calcularPontos, ErroDeCalculo } from '@gincana/scoring';
import { isAxiosError } from 'axios';

import { formatarPontosPorUnidade, formatarQuantidade } from '../../lib/formatar-numero.js';
import { lerQuantidade } from './CampoDeQuantidade.js';
import { traduzirFalhaDeLancamento } from './mensagens-de-lancamento.js';
import { usePrevia } from './lancamentos-api.js';
import type { EstadoDaPrevia } from './PreviaDePontos.js';
import { useValorComAtraso } from './useValorComAtraso.js';

interface Entrada {
  tipoAcaoId: string;
  unidade: Unidade;
  /** O que está digitado no campo de quantidade. */
  quantidade: string;
  dataAcao: string;
  /**
   * Só na correção. Corrigir a quantidade de um lançamento recalcula sobre o preço que ficou
   * congelado nele, e não sobre o de hoje. Enquanto o dia da ação não muda, a prévia usa esse
   * preço com a mesma função da API (`calcularPontos`, do `@gincana/scoring`); se o dia muda,
   * a API escolhe a regra daquela data, e só ela sabe qual é.
   */
  precoCongelado?: { pontosPorUnidade: number; dataAcao: string };
}

function foiRecusaDeRegra(erro: unknown): boolean {
  const status = isAxiosError(erro) ? erro.response?.status : undefined;
  return status === 400 || status === 409;
}

/**
 * Tudo que a prévia de pontos precisa: espera a pessoa parar de digitar, chama a API (ou
 * calcula com o preço congelado) e entrega o estado pronto para mostrar.
 *
 * `bloqueada` é verdadeira quando a API recusou o cálculo por regra (gincana parada, ação
 * pausada, data fora do período): enviar daria a mesma recusa, então o botão espera.
 */
export function useEstadoDaPrevia(entrada: Entrada): {
  estado: EstadoDaPrevia;
  bloqueada: boolean;
} {
  const { tipoAcaoId, unidade, quantidade, dataAcao, precoCongelado } = entrada;

  const quantidadeComAtraso = useValorComAtraso(quantidade);
  const dataComAtraso = useValorComAtraso(dataAcao);

  const numero = lerQuantidade(quantidade);
  const usaPrecoCongelado = precoCongelado !== undefined && dataAcao === precoCongelado.dataAcao;

  const pedido = previaDeLancamentoSchema.safeParse({
    tipoAcaoId,
    quantidade: lerQuantidade(quantidadeComAtraso),
    dataAcao: dataComAtraso,
  });
  // A consulta segue o dia em que a pessoa PAROU, não o que está digitado agora: mudar do dia
  // original para outro não pode pedir a regra do dia original durante a espera.
  const diaEmEspera = precoCongelado !== undefined && dataComAtraso === precoCongelado.dataAcao;
  const previa = usePrevia(!diaEmEspera && pedido.success ? pedido.data : null);

  if (Number.isNaN(numero) || dataAcao === '') {
    return { estado: { situacao: 'aguardando' }, bloqueada: false };
  }

  if (usaPrecoCongelado) {
    try {
      return {
        estado: {
          situacao: 'pronta',
          pontos: calcularPontos(numero, precoCongelado.pontosPorUnidade),
          detalhe: `${formatarQuantidade(numero, unidade)} × ${formatarPontosPorUnidade(precoCongelado.pontosPorUnidade, unidade)}, o preço de quando você registrou`,
        },
        bloqueada: false,
      };
    } catch (erro) {
      if (erro instanceof ErroDeCalculo) {
        return { estado: { situacao: 'aguardando' }, bloqueada: false };
      }
      throw erro;
    }
  }

  const esperandoAPessoa = quantidadeComAtraso !== quantidade || dataComAtraso !== dataAcao;

  if (!pedido.success && !esperandoAPessoa) {
    return { estado: { situacao: 'aguardando' }, bloqueada: false };
  }

  if (esperandoAPessoa || previa.isFetching) {
    return {
      estado: { situacao: 'calculando', pontos: previa.data?.pontos ?? null },
      bloqueada: false,
    };
  }

  if (previa.isError) {
    const falha = traduzirFalhaDeLancamento(previa.error, 'registrar', {
      camposDoFormulario: ['dataAcao'],
      campoDaData: 'dataAcao',
    });
    return {
      estado: {
        situacao: 'indisponivel',
        mensagem: falha.geral ?? falha.campos.dataAcao ?? 'Tente de novo em instantes.',
      },
      bloqueada: foiRecusaDeRegra(previa.error),
    };
  }

  if (previa.data !== undefined) {
    return {
      estado: {
        situacao: 'pronta',
        pontos: previa.data.pontos,
        detalhe: `${formatarQuantidade(previa.data.quantidade, previa.data.unidade)} × ${formatarPontosPorUnidade(previa.data.pontosPorUnidade, previa.data.unidade)}`,
      },
      bloqueada: false,
    };
  }

  return { estado: { situacao: 'aguardando' }, bloqueada: false };
}
