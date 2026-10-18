import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';

import { limparToken } from './lib/token.js';
import { restaurarApi } from './simulacao-da-api.js';

/**
 * O jsdom não implementa o `<dialog>` modal. Este polyfill faz só o que importa para o
 * teste enxergar o que a pessoa enxergaria: abrir, fechar e avisar que fechou. Foco preso,
 * inércia do fundo e Esc são do navegador e foram conferidos num navegador de verdade.
 */
if (typeof HTMLDialogElement.prototype.showModal !== 'function') {
  Object.defineProperty(HTMLDialogElement.prototype, 'open', {
    configurable: true,
    get(this: HTMLDialogElement) {
      return this.hasAttribute('open');
    },
  });
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    if (this.hasAttribute('open')) {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    }
  };
}

// Cada teste começa sem sessão, sem simulação de rede e sem espiões do anterior.
afterEach(() => {
  vi.restoreAllMocks();
  restaurarApi();
  limparToken();
});
