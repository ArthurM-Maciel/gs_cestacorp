import type { Papel } from '@gincana/contracts';

import { useSessao } from '../../lib/sessao.js';

const rotuloDoPapel: Record<Papel, string> = {
  COLABORADOR: 'Colaborador',
  LIDER: 'Líder de equipe',
  ADMIN: 'Administradora',
};

/**
 * Destino mínimo depois do login. É onde as próximas histórias entram: cada rota troca
 * este esqueleto pela tela do seu perfil (início do colaborador, fila do líder, painel).
 */
export function EsqueletoDoPerfil({ descricao }: { descricao: string }) {
  const { usuario, sair } = useSessao();

  if (usuario === null) {
    return null;
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 px-4 py-6">
      <header className="flex items-center justify-between gap-4">
        <p className="font-semibold text-marca-600">Gincana Solidária</p>
        <button
          type="button"
          onClick={sair}
          className="inline-flex min-h-11 items-center rounded-xl border-2 border-marca-600 px-5 font-semibold text-marca-600 hover:bg-marca-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-600"
        >
          Sair
        </button>
      </header>

      <section className="rounded-cartao bg-superficie p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-balance">Olá, {usuario.nome}!</h1>
        <p className="mt-2 inline-block rounded-full bg-marca-100 px-3 py-1 text-sm font-semibold text-aprovado">
          <span className="sr-only">Perfil: </span>
          {rotuloDoPapel[usuario.papel]}
        </p>
        <p className="mt-4 text-texto-suave">{descricao}</p>
      </section>
    </main>
  );
}
