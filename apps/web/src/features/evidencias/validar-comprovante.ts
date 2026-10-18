import { mimeTypesDeEvidencia, TAMANHO_MAXIMO_DE_EVIDENCIA_BYTES } from '@gincana/contracts';

import { formatarTamanhoDeArquivo } from '../../lib/formatar-numero.js';

const tiposAceitos: readonly string[] = mimeTypesDeEvidencia;

/** O valor do atributo `accept` do campo de arquivo: o celular só oferece o que a API aceita. */
export const tiposAceitosNoCampo = mimeTypesDeEvidencia.join(',');

/**
 * Confere o arquivo ANTES de gastar a rede do celular com ele. Usa as mesmas constantes do
 * contrato que a API confere de novo no registro: o navegador só poupa tempo de quem usa,
 * quem barra de verdade é o servidor.
 *
 * Devolve a mensagem do problema, já dizendo o que fazer, ou `null` se o arquivo serve.
 */
export function validarComprovante(arquivo: File): string | null {
  if (arquivo.size === 0) {
    return 'O arquivo está vazio. Escolha outro arquivo ou tire a foto de novo.';
  }

  if (!tiposAceitos.includes(arquivo.type)) {
    return 'Este tipo de arquivo não é aceito. Envie uma foto (JPG, PNG ou WebP) ou um PDF.';
  }

  if (arquivo.size > TAMANHO_MAXIMO_DE_EVIDENCIA_BYTES) {
    const limite = formatarTamanhoDeArquivo(TAMANHO_MAXIMO_DE_EVIDENCIA_BYTES);
    return `O arquivo tem ${formatarTamanhoDeArquivo(arquivo.size)} e o limite é ${limite}. Escolha um arquivo menor ou tire a foto de novo.`;
  }

  return null;
}
