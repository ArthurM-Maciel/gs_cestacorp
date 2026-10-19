import {
  acaoAuditadaSchema,
  listarAuditoriaQuerySchema,
  rotulosDeAcaoAuditada,
  type ListarAuditoriaQuery,
  type RegistroDeAuditoria,
} from '@gincana/contracts';
import { Link, useSearchParams } from 'react-router-dom';

import { CabecalhoDePagina } from '../../components/ui/CabecalhoDePagina.js';
import { CampoDeSelecao } from '../../components/ui/CampoDeSelecao.js';
import {
  botaoContorno,
  botaoDeLinha,
  botaoPrimario,
} from '../../components/ui/estilos-de-botao.js';
import { EstadoCarregando, EstadoDeErro, EstadoVazio } from '../../components/ui/Estados.js';
import { Etiqueta } from '../../components/ui/Etiqueta.js';
import { ListaResponsiva, type ColunaDaLista } from '../../components/ui/ListaResponsiva.js';
import { mensagemDeErro } from '../../lib/api.js';
import { formatarDataEHora } from '../../lib/formatar-instante.js';
import { formatarNumero } from '../../lib/formatar-numero.js';
import { useColaboradores } from '../colaboradores/colaboradores-api.js';
import { rotuloDaEntidade, tomDaAcao } from './apresentacao-da-auditoria.js';
import { useAuditoria } from './auditoria-api.js';
import { ListaDeMudancas } from './ListaDeMudancas.js';

/**
 * Cada registro ocupa bastante espaço (descrição e mudanças), então a página é curta: em
 * 360px, dez registros já são várias telas de rolagem.
 */
const POR_PAGINA = 10;

/**
 * Os filtros vivem na barra de endereço (`?acao=APROVACAO&autor=…&pagina=2`): o link e o botão
 * voltar os preservam. O que vem de lá passa pelo mesmo schema que a API usa para validar a
 * consulta; um endereço editado à mão e inválido cai nos padrões em vez de virar um erro 400.
 */
function lerFiltros(parametros: URLSearchParams): ListarAuditoriaQuery {
  const lidos = listarAuditoriaQuerySchema.safeParse({
    acao: parametros.get('acao') ?? undefined,
    autorId: parametros.get('autor') ?? undefined,
    pagina: parametros.get('pagina') ?? undefined,
    porPagina: POR_PAGINA,
  });
  return lidos.success ? lidos.data : listarAuditoriaQuerySchema.parse({ porPagina: POR_PAGINA });
}

const colunas: ColunaDaLista<RegistroDeAuditoria>[] = [
  {
    chave: 'acao',
    titulo: 'Ação',
    semRotuloNoCelular: true,
    renderizar: (registro) => (
      <>
        <Etiqueta tom={tomDaAcao[registro.acao]}>{rotulosDeAcaoAuditada[registro.acao]}</Etiqueta>
        <p className="mt-1 text-sm text-texto-suave">{rotuloDaEntidade(registro.entidade)}</p>
      </>
    ),
  },
  {
    chave: 'quando',
    titulo: 'Quando',
    renderizar: (registro) => (
      <time dateTime={registro.criadoEm}>{formatarDataEHora(registro.criadoEm)}</time>
    ),
  },
  {
    chave: 'autor',
    titulo: 'Feito por',
    renderizar: (registro) => <span className="font-semibold">{registro.autor.nome}</span>,
  },
  {
    chave: 'mudancas',
    titulo: 'O que mudou',
    semRotuloNoCelular: true,
    renderizar: (registro) => (
      <>
        {registro.descricao !== null && <p>{registro.descricao}</p>}
        <ListaDeMudancas mudancas={registro.mudancas} acao={registro.acao} />
      </>
    ),
  },
  {
    chave: 'detalhe',
    titulo: 'Detalhe',
    acoes: true,
    renderizar: (registro) =>
      registro.entidade === 'Lancamento' ? (
        <Link
          to={`/lancamentos/${registro.entidadeId}`}
          aria-label={`Ver o lançamento: ${rotulosDeAcaoAuditada[registro.acao]} por ${registro.autor.nome}`}
          className={`${botaoDeLinha} w-full xl:w-auto`}
        >
          Ver lançamento
        </Link>
      ) : null,
  },
];

/**
 * US09 — o painel de auditoria da administradora: quem criou, aprovou, recusou ou alterou o
 * quê, do mais recente para o mais antigo. É a evidência que sustenta o selo de qualidade,
 * então a tela só consulta: nada aqui edita ou apaga um registro.
 *
 * Só a administradora alcança a rota; a API também recusa (403) quem tentar por fora.
 */
export function TelaDeAuditoria() {
  const [parametros, definirParametros] = useSearchParams();
  const filtros = lerFiltros(parametros);
  const consulta = useAuditoria(filtros);
  const pessoas = useColaboradores();

  const temFiltro = filtros.acao !== undefined || filtros.autorId !== undefined;
  const pagina = consulta.data;

  function alterar(mudancas: Record<string, string | null>) {
    definirParametros((atuais) => {
      const proximos = new URLSearchParams(atuais);
      for (const [chave, valor] of Object.entries(mudancas)) {
        if (valor === null || valor === '') {
          proximos.delete(chave);
        } else {
          proximos.set(chave, valor);
        }
      }
      return proximos;
    });
  }

  /** Mudar o filtro volta à primeira página: a página 4 do filtro antigo não existe no novo. */
  const filtrarPor = (chave: 'acao' | 'autor', valor: string) => {
    alterar({ [chave]: valor, pagina: null });
  };

  const irParaPagina = (numero: number) => {
    alterar({ pagina: numero === 1 ? null : String(numero) });
  };

  const limparFiltros = () => {
    alterar({ acao: null, autor: null, pagina: null });
  };

  const pessoasOrdenadas =
    pessoas.data?.toSorted((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoDePagina
        sobretitulo="Trilha de auditoria"
        titulo="Auditoria"
        descricao="Quem criou, aprovou, recusou ou alterou cada registro, com data e hora. É só consulta: nada aqui é editado ou apagado."
      />

      <fieldset className="grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
        <legend className="sr-only">Filtros da auditoria</legend>
        <CampoDeSelecao
          rotulo="Ação"
          value={filtros.acao ?? ''}
          onChange={(evento) => {
            filtrarPor('acao', evento.target.value);
          }}
        >
          <option value="">Todas as ações</option>
          {acaoAuditadaSchema.options.map((acao) => (
            <option key={acao} value={acao}>
              {rotulosDeAcaoAuditada[acao]}
            </option>
          ))}
        </CampoDeSelecao>

        <CampoDeSelecao
          rotulo="Feito por"
          value={filtros.autorId ?? ''}
          disabled={pessoas.isPending || pessoas.isError}
          dica={
            pessoas.isError
              ? 'Não foi possível carregar as pessoas. O filtro por ação continua funcionando.'
              : undefined
          }
          onChange={(evento) => {
            filtrarPor('autor', evento.target.value);
          }}
        >
          <option value="">Todas as pessoas</option>
          {pessoasOrdenadas.map((pessoa) => (
            <option key={pessoa.id} value={pessoa.id}>
              {pessoa.ativo ? pessoa.nome : `${pessoa.nome} (desativado)`}
            </option>
          ))}
        </CampoDeSelecao>
      </fieldset>

      {consulta.isPending && <EstadoCarregando mensagem="Carregando o histórico de alterações…" />}

      {consulta.isError && (
        <EstadoDeErro
          mensagem={mensagemDeErro(consulta.error)}
          aoTentarDeNovo={() => {
            void consulta.refetch();
          }}
        />
      )}

      {pagina !== undefined && pagina.total === 0 && (
        <EstadoVazio
          titulo={temFiltro ? 'Nenhum registro com esses filtros' : 'Ainda não há registros'}
          descricao={
            temFiltro
              ? 'Tente outra ação ou outra pessoa, ou limpe os filtros para ver tudo.'
              : 'Quando alguém criar, aprovar, recusar ou alterar um lançamento, o registro aparece aqui.'
          }
        >
          {temFiltro && (
            <button type="button" onClick={limparFiltros} className={botaoPrimario}>
              Limpar filtros
            </button>
          )}
        </EstadoVazio>
      )}

      {/* Um endereço com `?pagina=99` pede uma página que não existe: o total é maior que zero,
          mas a lista veio vazia. */}
      {pagina !== undefined && pagina.total > 0 && pagina.itens.length === 0 && (
        <EstadoVazio
          titulo="Esta página não tem registros"
          descricao="Os filtros ou a quantidade de registros mudaram. Volte à primeira página."
        >
          <button
            type="button"
            onClick={() => {
              irParaPagina(1);
            }}
            className={botaoPrimario}
          >
            Ir para a primeira página
          </button>
        </EstadoVazio>
      )}

      {pagina !== undefined && pagina.itens.length > 0 && (
        <section
          aria-labelledby="titulo-dos-registros"
          aria-busy={consulta.isPlaceholderData}
          className={`flex flex-col gap-4 ${consulta.isPlaceholderData ? 'opacity-60' : ''}`}
        >
          <h2 id="titulo-dos-registros" className="text-sm text-texto-suave">
            {formatarNumero(pagina.total)} {pagina.total === 1 ? 'registro' : 'registros'}
            {temFiltro ? ' com os filtros escolhidos' : ''}, do mais recente ao mais antigo.
          </h2>

          <ListaResponsiva
            rotulo="Registros de auditoria"
            colunas={colunas}
            itens={pagina.itens}
            chaveDoItem={(registro) => registro.id}
            modeloDeColunas="minmax(0,1.2fr) minmax(0,1.7fr) minmax(0,1.4fr) minmax(0,3fr) 9rem"
            tabelaA="xl"
          />

          {pagina.totalDePaginas > 1 && (
            <nav aria-label="Paginação da auditoria" className="flex flex-col gap-3">
              <p className="text-center text-sm text-texto-suave" aria-live="polite">
                Página {pagina.pagina} de {pagina.totalDePaginas}
              </p>
              <div className="grid grid-cols-2 gap-3 lg:mx-auto lg:w-full lg:max-w-sm">
                <button
                  type="button"
                  disabled={pagina.pagina <= 1 || consulta.isPlaceholderData}
                  onClick={() => {
                    irParaPagina(pagina.pagina - 1);
                  }}
                  className={botaoContorno}
                >
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={pagina.pagina >= pagina.totalDePaginas || consulta.isPlaceholderData}
                  onClick={() => {
                    irParaPagina(pagina.pagina + 1);
                  }}
                  className={botaoContorno}
                >
                  Próxima
                </button>
              </div>
            </nav>
          )}
        </section>
      )}
    </div>
  );
}
