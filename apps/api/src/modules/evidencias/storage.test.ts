import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  assinarParametros,
  BASE_DO_ARMAZENAMENTO_FAKE,
  criarAdaptadorCloudinary,
  criarAdaptadorFake,
  storage,
} from './storage.js';

/**
 * O adaptador de armazenamento, testado sem rede e sem conta em serviço externo.
 *
 * O que importa aqui é o que **não** atravessa a rede: o segredo da Cloudinary nunca pode
 * sair numa resposta. Como o processo de teste roda sem as variáveis configuradas, o
 * adaptador escolhido é o falso — e isso também é um comportamento a garantir, senão a
 * suíte dependeria de credencial de alguém.
 */

const pedido = {
  prefixo: 'colaborador-123',
  nomeArquivo: 'comprovante.jpg',
  mimeType: 'image/jpeg' as const,
  tamanhoBytes: 1024,
};

describe('criarStorageAdapter', () => {
  it('cai no armazenamento falso quando as variáveis não estão configuradas', () => {
    expect(storage.nome).toBe('fake');
  });
});

describe('adaptador falso', () => {
  it('devolve a mesma forma de resposta do real, marcada como falsa', () => {
    const assinatura = criarAdaptadorFake().assinarUpload(pedido);

    expect(assinatura).toMatchObject({ provedor: 'fake' });
    expect(assinatura.urlDeUpload).toBe(`${BASE_DO_ARMAZENAMENTO_FAKE}/upload`);
    expect(assinatura.campos.public_id).toBe(assinatura.publicId);
    expect(assinatura.campos.signature).toMatch(/^fake-/);
    expect(new Date(assinatura.expiraEm).getTime()).toBeGreaterThan(Date.now());
  });

  it('usa a extensão do tipo do arquivo na URL prevista', () => {
    const adaptador = criarAdaptadorFake();

    expect(adaptador.assinarUpload(pedido).urlPrevista).toMatch(/\.jpg$/);
    expect(adaptador.assinarUpload({ ...pedido, mimeType: 'application/pdf' }).urlPrevista).toMatch(
      /\.pdf$/,
    );
  });

  it('sorteia o identificador em vez de confiar no nome enviado pelo navegador', () => {
    const adaptador = criarAdaptadorFake();
    const maliciosa = adaptador.assinarUpload({
      ...pedido,
      nomeArquivo: '../../../etc/passwd',
    });

    expect(maliciosa.publicId).not.toContain('..');
    expect(maliciosa.publicId.startsWith('gincana/evidencias/colaborador-123/')).toBe(true);

    const outra = adaptador.assinarUpload(pedido);
    expect(outra.publicId).not.toBe(maliciosa.publicId);
  });

  it('reconhece as próprias URLs e recusa as de fora', () => {
    const adaptador = criarAdaptadorFake();

    expect(adaptador.aceitaUrl(`${BASE_DO_ARMAZENAMENTO_FAKE}/qualquer/coisa.jpg`)).toBe(true);
    expect(adaptador.aceitaUrl('https://site-de-terceiro.invalido/arquivo.jpg')).toBe(false);
  });
});

describe('adaptador da Cloudinary', () => {
  const SEGREDO = 'segredo-que-nao-pode-vazar';
  const adaptador = criarAdaptadorCloudinary('conta-de-teste', 'chave-publica', SEGREDO, 'pasta');

  /**
   * O formato que a Cloudinary confere do outro lado: parâmetros em ordem alfabética,
   * `chave=valor` unidos por `&`, segredo colado no fim e SHA-1 de tudo. Se alguém mudar
   * a ordem, o envio passa a ser recusado lá — e este teste avisa antes do deploy.
   */
  it('assina os parâmetros em ordem alfabética com o segredo no fim', () => {
    const esperado = createHash('sha1')
      .update(`public_id=abc&timestamp=1700000000${SEGREDO}`)
      .digest('hex');

    expect(assinarParametros({ timestamp: '1700000000', public_id: 'abc' }, SEGREDO)).toBe(
      esperado,
    );
  });

  it('não deixa o segredo sair na resposta, em campo nenhum', () => {
    const assinatura = adaptador.assinarUpload(pedido);

    expect(JSON.stringify(assinatura)).not.toContain(SEGREDO);
    expect(assinatura.campos.api_key).toBe('chave-publica');
    expect(assinatura.campos.signature).toMatch(/^[0-9a-f]{40}$/);
  });

  it('assina o identificador que ele mesmo sorteou, e só ele e o instante', () => {
    const assinatura = adaptador.assinarUpload(pedido);
    const esperada = createHash('sha1')
      .update(
        `public_id=${assinatura.campos.public_id}&timestamp=${assinatura.campos.timestamp}${SEGREDO}`,
      )
      .digest('hex');

    expect(assinatura.campos.signature).toBe(esperada);
    expect(assinatura.publicId.startsWith('pasta/colaborador-123/')).toBe(true);
  });

  it('só reconhece URLs da própria conta', () => {
    expect(adaptador.aceitaUrl('https://res.cloudinary.com/conta-de-teste/a.jpg')).toBe(true);
    expect(adaptador.aceitaUrl('https://res.cloudinary.com/outra-conta/a.jpg')).toBe(false);
  });
});
