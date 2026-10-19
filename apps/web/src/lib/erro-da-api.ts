import { erroSchema } from '@gincana/contracts';
import { isAxiosError } from 'axios';

import { detalhesDoErro, mensagemDeErro } from './api.js';

/** Código de negócio do erro (`ANO_JA_CADASTRADO`, `LIDERA_EQUIPE`…), ou `null` se não houver. */
export function codigoDoErro(erro: unknown): string | null {
  if (!isAxiosError(erro)) {
    return null;
  }
  const corpo = erroSchema.safeParse(erro.response?.data);
  return corpo.success ? corpo.data.erro.codigo : null;
}

/** O que um formulário mostra depois que a API recusa: erros nos campos e/ou um aviso geral. */
export interface ErroDeFormulario<C extends string> {
  campos: Partial<Record<C, string>>;
  geral: string | null;
}

/** Um conflito de negócio que a tela mostra junto de um campo específico. */
export interface ConflitoNoCampo<C extends string> {
  campo: C;
  /** O que a pessoa pode fazer para resolver, dito depois da mensagem da API. */
  orientacao?: string;
}

/**
 * Decide onde cada falha da API aparece no formulário:
 *
 * 1. conflito de negócio conhecido (`porCodigo`) → junto do campo que o causou;
 * 2. registro que não existe mais (`NAO_ENCONTRADO`) → aviso geral, com o que fazer;
 * 3. `detalhes` por campo (validação) → junto de cada campo que a API apontou;
 * 4. qualquer outra coisa → aviso geral, já traduzido para português.
 *
 * A mensagem do conflito é a que a API mandou: ela conhece a regra e cita nomes (da equipe,
 * da pessoa). A tela só acrescenta o próximo passo.
 */
export function traduzirErroDoFormulario<C extends string>(
  erro: unknown,
  camposDoFormulario: readonly C[],
  porCodigo: Partial<Record<string, ConflitoNoCampo<C>>> = {},
): ErroDeFormulario<C> {
  const codigo = codigoDoErro(erro);
  const conflito = codigo === null ? undefined : porCodigo[codigo];

  if (conflito !== undefined) {
    const mensagem = mensagemDeErro(erro);
    const texto =
      conflito.orientacao === undefined ? mensagem : `${mensagem} ${conflito.orientacao}`;
    return { campos: { [conflito.campo]: texto } as Partial<Record<C, string>>, geral: null };
  }

  // O registro sumiu ou mudou depois que a tela carregou (outra pessoa mexeu). A lista já
  // foi atualizada pela invalidação; falta só dizer isso a quem estava preenchendo.
  if (codigo === 'NAO_ENCONTRADO') {
    return {
      campos: {},
      geral: `${mensagemDeErro(erro)} Feche esta janela e confira a lista, que já foi atualizada.`,
    };
  }

  const detalhes = detalhesDoErro(erro);
  const campos: Partial<Record<C, string>> = {};
  for (const campo of camposDoFormulario) {
    const primeira = detalhes[campo]?.[0];
    if (primeira !== undefined) {
      campos[campo] = primeira;
    }
  }

  if (Object.keys(campos).length > 0) {
    return { campos, geral: null };
  }

  return { campos: {}, geral: mensagemDeErro(erro) };
}

/** Parte do resultado de um `safeParse` do zod, sem depender do pacote no front. */
interface ProblemaDeValidacao {
  path: readonly PropertyKey[];
  message: string;
}

/**
 * Erros do schema do contrato, um por campo (o primeiro de cada). Quem valida no front usa
 * o mesmo schema da API, então a mensagem que aparece aqui é a que a API devolveria.
 */
export function errosDoSchema<C extends string>(
  problemas: readonly ProblemaDeValidacao[],
  camposDoFormulario: readonly C[],
): Partial<Record<C, string>> {
  const campos: Partial<Record<C, string>> = {};
  for (const problema of problemas) {
    const campo = camposDoFormulario.find((nome) => nome === problema.path[0]);
    if (campo !== undefined && campos[campo] === undefined) {
      campos[campo] = problema.message;
    }
  }
  return campos;
}

/** Leva o foco ao primeiro campo com erro, na ordem em que aparecem no formulário. */
export function focarPrimeiroComErro<C extends string>(
  formulario: HTMLFormElement | null,
  camposDoFormulario: readonly C[],
  erros: Partial<Record<C, string>>,
): void {
  const primeiro = camposDoFormulario.find((campo) => erros[campo] !== undefined);
  if (formulario === null || primeiro === undefined) {
    return;
  }
  const elemento = formulario.elements.namedItem(primeiro);
  if (elemento instanceof HTMLElement) {
    elemento.focus();
  }
}
