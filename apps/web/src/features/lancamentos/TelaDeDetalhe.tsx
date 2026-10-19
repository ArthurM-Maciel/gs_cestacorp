import type { Lancamento } from '@gincana/contracts';
import { isAxiosError } from 'axios';
import type { ReactNode } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { CabecalhoDePagina } from '../../components/ui/CabecalhoDePagina.js';
import { botaoContorno, botaoDeLinha } from '../../components/ui/estilos-de-botao.js';
import { EstadoCarregando, EstadoDeErro, EstadoVazio } from '../../components/ui/Estados.js';
import { mensagemDeErro } from '../../lib/api.js';
import { caminhoInicial } from '../../lib/destinos.js';
import { formatarData } from '../../lib/formatar-data.js';
import { formatarDataEHora } from '../../lib/formatar-instante.js';
import {
  formatarPontos,
  formatarPontosPorUnidade,
  formatarQuantidade,
} from '../../lib/formatar-numero.js';
import { useSessao } from '../../lib/sessao.js';
import { ComprovantesDoLancamento } from '../aprovacoes/ComprovantesDoLancamento.js';
import { HistoricoDoLancamento } from '../auditoria/HistoricoDoLancamento.js';
import { EtiquetaDeStatus } from './EtiquetaDeStatus.js';
import { useLancamento } from './lancamentos-api.js';

/**
 * Volta para onde a pessoa estava (a lista, o painel de auditoria). Quem chegou por um link
 * direto não tem "onde estava" dentro do app: `navigate(-1)` a levaria para fora dele, então
 * nesse caso o botão leva ao início do perfil.
 */
function Voltar({
  rotulo = 'Voltar',
  estilo = `${botaoDeLinha} self-start`,
}: {
  rotulo?: string;
  estilo?: string;
}) {
  const { usuario } = useSessao();
  const navegar = useNavigate();
  const local = useLocation();
  const chegouDeDentro = local.key !== 'default';

  return (
    <button
      type="button"
      onClick={() => {
        if (chegouDeDentro) {
          void navegar(-1);
        } else {
          void navegar(caminhoInicial(usuario?.papel ?? 'COLABORADOR'));
        }
      }}
      className={estilo}
    >
      <span aria-hidden="true">←</span> {rotulo}
    </button>
  );
}

function Item({
  rotulo,
  children,
  largo = false,
}: {
  rotulo: string;
  children: ReactNode;
  /** Ocupa a linha inteira: textos longos (nomes, motivo, comprovante) não cabem em meia coluna. */
  largo?: boolean;
}) {
  return (
    <div className={largo ? 'col-span-2' : undefined}>
      <dt className="text-sm text-texto-suave">{rotulo}</dt>
      <dd className="mt-0.5 font-semibold">{children}</dd>
    </div>
  );
}

/** O que os pontos querem dizer em cada situação: pendente ainda não soma, recusado nunca soma. */
function Pontos({ lancamento }: { lancamento: Lancamento }) {
  const pontos = formatarPontos(lancamento.pontosCalculados);
  if (lancamento.status === 'RECUSADO') {
    return <>Sem pontos (recusado)</>;
  }
  return (
    <>
      <span className="text-aprovado">{pontos}</span>
      {lancamento.status === 'PENDENTE' && (
        <span className="block text-sm font-normal text-texto-suave">
          Só entram no placar depois da aprovação.
        </span>
      )}
    </>
  );
}

function Resumo({ lancamento }: { lancamento: Lancamento }) {
  const { tipoAcao } = lancamento;

  return (
    <dl
      aria-label="Dados do lançamento"
      className="grid grid-cols-2 gap-x-4 gap-y-4 rounded-cartao bg-superficie p-5 shadow-sm"
    >
      <Item rotulo="Situação">
        <EtiquetaDeStatus status={lancamento.status} />
      </Item>
      <Item rotulo="Quantidade">{formatarQuantidade(lancamento.quantidade, tipoAcao.unidade)}</Item>
      <Item rotulo="Pontos">
        <Pontos lancamento={lancamento} />
      </Item>
      {/* O preço que valeu no dia do lançamento: mudar a regra depois não o altera. */}
      <Item rotulo="Regra aplicada">
        {formatarPontosPorUnidade(lancamento.pontosPorUnidadeAplicado, tipoAcao.unidade)}
      </Item>
      <Item rotulo="Data da ação">{formatarData(lancamento.dataAcao)}</Item>
      <Item rotulo="Registrado por" largo>
        {lancamento.colaborador.nome} · {lancamento.equipe.nome}
      </Item>
      {lancamento.avaliadoPor !== null && (
        <Item rotulo={lancamento.status === 'RECUSADO' ? 'Recusado por' : 'Avaliado por'} largo>
          {lancamento.avaliadoPor.nome}
          {lancamento.avaliadoEm !== null && (
            <span className="block text-sm font-normal text-texto-suave">
              {formatarDataEHora(lancamento.avaliadoEm)}
            </span>
          )}
        </Item>
      )}
      {lancamento.status === 'RECUSADO' && lancamento.motivoRecusa !== null && (
        <div className="col-span-2">
          <dt className="text-sm text-texto-suave">Motivo da recusa</dt>
          <dd className="mt-0.5 font-semibold text-recusado">{lancamento.motivoRecusa}</dd>
        </div>
      )}
      {lancamento.observacao !== null && lancamento.observacao !== '' && (
        <div className="col-span-2">
          <dt className="text-sm text-texto-suave">Observação</dt>
          <dd className="mt-0.5 font-semibold">{lancamento.observacao}</dd>
        </div>
      )}
      <div className="col-span-2">
        <dt className="text-sm text-texto-suave">Comprovante</dt>
        <dd className="mt-0.5">
          <ComprovantesDoLancamento lancamento={lancamento} />
        </dd>
      </div>
    </dl>
  );
}

/**
 * O detalhe de um lançamento: o resumo do que foi registrado e, abaixo, o histórico de quem
 * criou, corrigiu, aprovou ou recusou (US09).
 *
 * Os três perfis abrem esta tela, cada um dentro do próprio menu. Quem pode ver o quê é da
 * API: o lançamento de outra equipe volta como 404, e a tela diz "não encontrado" sem
 * confirmar que ele existe.
 */
export function TelaDeDetalhe() {
  const { id = '' } = useParams();
  const consulta = useLancamento(id);

  if (consulta.isPending) {
    return <EstadoCarregando mensagem="Carregando o lançamento…" />;
  }

  if (consulta.isError) {
    if (isAxiosError(consulta.error) && consulta.error.response?.status === 404) {
      return (
        <EstadoVazio
          titulo="Lançamento não encontrado"
          descricao="Ele não existe ou você não tem acesso a ele. Volte e escolha outro lançamento da lista."
        >
          <Voltar rotulo="Voltar para a lista" estilo={botaoContorno} />
        </EstadoVazio>
      );
    }
    return (
      <div className="flex flex-col gap-4">
        <Voltar />
        <EstadoDeErro
          mensagem={mensagemDeErro(consulta.error)}
          aoTentarDeNovo={() => {
            void consulta.refetch();
          }}
        />
      </div>
    );
  }

  const lancamento = consulta.data;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Voltar />
      <CabecalhoDePagina
        sobretitulo="Lançamento"
        titulo={lancamento.tipoAcao.nome}
        descricao={`Registrado por ${lancamento.colaborador.nome}, da ${lancamento.equipe.nome}.`}
      />
      <Resumo lancamento={lancamento} />
      <HistoricoDoLancamento lancamento={lancamento} />
    </div>
  );
}
