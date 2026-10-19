/**
 * Guarda do token de acesso.
 *
 * O token fica em localStorage para sobreviver ao recarregamento da página. Todo acesso
 * passa por try/catch porque o navegador lança exceção em janela privada, com o
 * armazenamento bloqueado ou cheio. Quando isso acontece o token vive só em memória: a
 * sessão funciona até a pessoa recarregar a página e depois ela entra de novo.
 *
 * Trade-off conhecido: o que está em localStorage é legível por qualquer script da página.
 * A defesa é não carregar script de terceiros e manter o token com validade curta.
 */
const CHAVE = 'gincana:token';

let emMemoria: string | null = null;

export function lerToken(): string | null {
  try {
    return window.localStorage.getItem(CHAVE) ?? emMemoria;
  } catch {
    return emMemoria;
  }
}

export function gravarToken(token: string): void {
  emMemoria = token;
  try {
    window.localStorage.setItem(CHAVE, token);
  } catch {
    // Sem persistência: a sessão dura só até recarregar a página.
  }
}

export function limparToken(): void {
  emMemoria = null;
  try {
    window.localStorage.removeItem(CHAVE);
  } catch {
    // Nada a limpar além da memória.
  }
}
