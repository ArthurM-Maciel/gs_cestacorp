import type { AcaoAuditada, MudancaAuditada, Unidade } from '@gincana/contracts';

import { formatarData } from '../../lib/formatar-data.js';
import { formatarDataEHora } from '../../lib/formatar-instante.js';
import {
  formatarNumero,
  formatarPontos,
  formatarPontosPorUnidade,
  formatarQuantidade,
} from '../../lib/formatar-numero.js';

/**
 * Como uma mudança é lida na tela:
 *
 * - `registro`: o valor com que a coisa nasceu ("Registrado com 24 kg"). É a criação: não
 *   havia valor antes, então não há seta nem "antes".
 * - `troca`: "Quantidade: 12 kg → 15 kg".
 * - `definido`: passou a ter um valor onde não havia ("Observação: Entrega na portaria").
 * - `removido`: tinha valor e deixou de ter ("Motivo da recusa: removido (era …)").
 */
export type FormaDaMudanca = 'registro' | 'troca' | 'definido' | 'removido';

export interface MudancaParaExibir {
  campo: string;
  rotulo: string;
  forma: FormaDaMudanca;
  /** Já formatado ("12 kg"). `null` quando não havia valor antes. */
  antes: string | null;
  /** Já formatado ("15 kg"). `null` quando o valor foi removido. */
  depois: string | null;
}

const ehData = (valor: string) => /^\d{4}-\d{2}-\d{2}$/.test(valor);
const ehInstante = (valor: string) => /^\d{4}-\d{2}-\d{2}T/.test(valor);

/**
 * Põe o valor no jeito de ler. A API entrega a comparação em texto ("12", "2026-11-02") e é
 * este o ponto que acrescenta o que ela não sabe: a unidade do lançamento ("kg") e o
 * formato brasileiro de número e data.
 *
 * Sem `unidade` (o painel geral mistura lançamentos, regras e equipes), a quantidade vai
 * sem ela: a unidade errada seria pior do que nenhuma.
 */
function formatarValor(campo: string, valor: string, unidade: Unidade | undefined): string {
  const numero = Number(valor);
  const ehNumero = valor.trim() !== '' && !Number.isNaN(numero);

  if (campo === 'quantidade' && ehNumero) {
    return unidade === undefined ? formatarNumero(numero) : formatarQuantidade(numero, unidade);
  }
  if (campo === 'pontosCalculados' && ehNumero) {
    return formatarPontos(numero);
  }
  if ((campo === 'pontosPorUnidadeAplicado' || campo === 'pontosPorUnidade') && ehNumero) {
    return unidade === undefined
      ? formatarPontos(numero)
      : formatarPontosPorUnidade(numero, unidade);
  }
  if (ehData(valor)) {
    return formatarData(valor);
  }
  if (ehInstante(valor)) {
    return formatarDataEHora(valor);
  }
  return valor;
}

interface Contexto {
  acao: AcaoAuditada;
  /** A unidade do lançamento, quando a tela a conhece (o detalhe de um lançamento). */
  unidade?: Unidade;
}

/**
 * Traduz as mudanças que a API já comparou em algo que a tela exibe. **Não compara
 * `valoresAntes` com `valoresDepois`**: quem decide o que mudou é o servidor, e este
 * arquivo só decide como cada mudança é escrita.
 *
 * Um valor `null` nunca chega ao texto: vira o jeito certo de dizer "não havia" ou "foi
 * removido" (veja `FormaDaMudanca`).
 */
export function prepararMudancas(
  mudancas: readonly MudancaAuditada[],
  { acao, unidade }: Contexto,
): MudancaParaExibir[] {
  return mudancas.flatMap<MudancaParaExibir>((mudanca) => {
    const { campo, rotulo, de, para } = mudanca;
    const antes = de === null ? null : formatarValor(campo, de, unidade);
    const depois = para === null ? null : formatarValor(campo, para, unidade);

    if (antes === null && depois === null) {
      return [];
    }
    if (antes === null) {
      return [
        { campo, rotulo, forma: acao === 'CRIACAO' ? 'registro' : 'definido', antes, depois },
      ];
    }
    if (depois === null) {
      return [{ campo, rotulo, forma: 'removido', antes, depois }];
    }
    return [{ campo, rotulo, forma: 'troca', antes, depois }];
  });
}
