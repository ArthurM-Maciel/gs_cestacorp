import { describe, expect, it } from 'vitest';

import { enderecoSeguroDoComprovante } from './evidencias-api.js';
import { tiposAceitosNoCampo, validarComprovante } from './validar-comprovante.js';

function arquivo(tipo: string, bytes: number): File {
  const f = new File(['x'], 'arquivo', { type: tipo });
  Object.defineProperty(f, 'size', { value: bytes });
  return f;
}

describe('validarComprovante', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])('aceita %s', (tipo) => {
    expect(validarComprovante(arquivo(tipo, 1000))).toBeNull();
  });

  it('aceita exatamente 5 MB e recusa um byte a mais', () => {
    const cinco = 5 * 1024 * 1024;
    expect(validarComprovante(arquivo('image/jpeg', cinco))).toBeNull();
    expect(validarComprovante(arquivo('image/jpeg', cinco + 1))).toMatch(/o limite é 5 MB/);
  });

  it.each(['image/gif', 'text/plain', 'application/zip', ''])('recusa o tipo "%s"', (tipo) => {
    expect(validarComprovante(arquivo(tipo, 1000))).toMatch(/foto \(JPG, PNG ou WebP\) ou um PDF/);
  });

  it('recusa arquivo vazio', () => {
    expect(validarComprovante(arquivo('image/jpeg', 0))).toMatch(/está vazio/);
  });

  it('o campo de arquivo oferece só o que a API aceita', () => {
    expect(tiposAceitosNoCampo).toBe('image/jpeg,image/png,image/webp,application/pdf');
  });
});

describe('enderecoSeguroDoComprovante', () => {
  it('deixa passar só endereços http e https', () => {
    expect(enderecoSeguroDoComprovante('https://res.cloudinary.com/a.jpg')).toBe(
      'https://res.cloudinary.com/a.jpg',
    );
    expect(enderecoSeguroDoComprovante('http://localhost/a.jpg')).toBe('http://localhost/a.jpg');
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    'não é um endereço',
    '',
  ])('nunca devolve "%s" como link', (url) => {
    expect(enderecoSeguroDoComprovante(url)).toBeNull();
  });
});
