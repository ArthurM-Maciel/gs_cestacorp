/**
 * US11 — a ordem do placar e o tratamento do empate, como função pura.
 *
 * Fica fora do serviço de propósito: ordenar e numerar posições não precisa de banco nem
 * de HTTP, e é exatamente a parte que a cliente vai conferir com o dedo na tela do pódio.
 *
 * **Empate divide a posição.** Duas equipes com 480 pontos ficam as duas em 2º e a
 * seguinte em 4º — é a contagem olímpica, a mesma que todo mundo já viu em quadro de
 * medalhas. A alternativa (desempatar por quem chegou primeiro aos pontos) foi descartada:
 * exigiria olhar a data de aprovação de cada lançamento, uma regra que o protótipo não
 * promete e que a cliente teria de aprender para entender o placar.
 *
 * Dentro do empate, a ordem é alfabética pelo nome da equipe. Não é critério de
 * desempate — as duas continuam em 2º — é só para a lista não dançar entre dois
 * carregamentos da mesma tela.
 */

export interface TotalDaEquipe {
  equipeId: string;
  nome: string;
  lider: { id: string; nome: string } | null;
  pontos: number;
  acoesAprovadas: number;
  totalColaboradores: number;
}

export interface EquipeClassificada extends TotalDaEquipe {
  posicao: number;
  /** Outra equipe tem a mesma pontuação. A tela escreve "2º (empate)". */
  empatada: boolean;
}

export function classificarEquipes(totais: readonly TotalDaEquipe[]): EquipeClassificada[] {
  const ordenadas = [...totais].sort(
    (a, b) => b.pontos - a.pontos || a.nome.localeCompare(b.nome, 'pt-BR'),
  );

  return ordenadas.map((equipe, indice) => {
    const anterior = ordenadas[indice - 1];
    const proxima = ordenadas[indice + 1];

    return {
      ...equipe,
      // Mesma pontuação da anterior significa mesma posição; quem vem depois do empate
      // pula as posições consumidas por ele, que é o 1, 2, 2, 4.
      posicao:
        anterior && anterior.pontos === equipe.pontos ? posicaoDe(ordenadas, indice) : indice + 1,
      empatada: anterior?.pontos === equipe.pontos || proxima?.pontos === equipe.pontos,
    };
  });
}

/** A posição do primeiro da faixa empatada em que esta equipe está. */
function posicaoDe(ordenadas: readonly TotalDaEquipe[], indice: number): number {
  let primeiro = indice;
  while (primeiro > 0 && ordenadas[primeiro - 1]?.pontos === ordenadas[indice]?.pontos) {
    primeiro -= 1;
  }
  return primeiro + 1;
}
