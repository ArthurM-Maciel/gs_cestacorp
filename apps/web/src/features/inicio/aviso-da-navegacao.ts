/**
 * Recado que uma tela deixa para a próxima ao navegar (o registro que deu certo, o
 * comprovante que não chegou). Viaja no estado do histórico e, como qualquer estado de
 * navegação, é validado antes de aparecer: nada dali vira texto na tela sem passar por aqui.
 */
export interface AvisoDaNavegacao {
  tipo: 'sucesso' | 'erro';
  texto: string;
}

export function lerAvisoDaNavegacao(estado: unknown): AvisoDaNavegacao | null {
  if (typeof estado !== 'object' || estado === null || !('aviso' in estado)) {
    return null;
  }
  const { aviso } = estado;
  if (
    typeof aviso === 'object' &&
    aviso !== null &&
    'tipo' in aviso &&
    'texto' in aviso &&
    (aviso.tipo === 'sucesso' || aviso.tipo === 'erro') &&
    typeof aviso.texto === 'string'
  ) {
    return { tipo: aviso.tipo, texto: aviso.texto };
  }
  return null;
}
