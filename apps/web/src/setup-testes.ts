import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';

import { limparToken } from './lib/token.js';
import { restaurarApi } from './simulacao-da-api.js';

// Cada teste começa sem sessão, sem simulação de rede e sem espiões do anterior.
afterEach(() => {
  vi.restoreAllMocks();
  restaurarApi();
  limparToken();
});
