import type { Lancamento } from '@gincana/contracts';

import { EstadoCarregando, EstadoDeErro, EstadoVazio } from '../../components/ui/Estados.js';
import { mensagemDeErro } from '../../lib/api.js';
import { useLinhaDoTempo } from './auditoria-api.js';
import { LinhaDoTempo } from './LinhaDoTempo.js';

/**
 * US09 — "quem aprovou ou alterou este lançamento", na tela de detalhe dele.
 *
 * Os quatro estados ficam aqui dentro: se o histórico falhar, o resumo do lançamento, que
 * já carregou, continua na tela.
 */
export function HistoricoDoLancamento({ lancamento }: { lancamento: Lancamento }) {
  const consulta = useLinhaDoTempo(lancamento.id);

  return (
    <section aria-labelledby="historico-do-lancamento" className="flex flex-col gap-3">
      <div>
        <h2 id="historico-do-lancamento" className="text-xl font-bold">
          Histórico
        </h2>
        <p className="text-sm text-texto-suave">
          Quem fez cada passo, na ordem em que aconteceu. O histórico não pode ser editado.
        </p>
      </div>

      {consulta.isPending && <EstadoCarregando mensagem="Carregando o histórico…" />}

      {consulta.isError && (
        <EstadoDeErro
          mensagem={mensagemDeErro(consulta.error)}
          aoTentarDeNovo={() => {
            void consulta.refetch();
          }}
        />
      )}

      {consulta.isSuccess && consulta.data.itens.length === 0 && (
        <EstadoVazio
          titulo="Este lançamento ainda não tem histórico"
          descricao="Cada criação, correção e decisão passa a aparecer aqui, com quem fez e quando."
        />
      )}

      {consulta.isSuccess && consulta.data.itens.length > 0 && (
        <div className="rounded-cartao bg-superficie p-5 shadow-sm">
          <LinhaDoTempo
            itens={consulta.data.itens}
            unidade={lancamento.tipoAcao.unidade}
            rotulo="Histórico do lançamento"
          />
        </div>
      )}
    </section>
  );
}
