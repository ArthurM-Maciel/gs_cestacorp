import type {
  AcaoAuditada,
  EntidadeAuditada,
  LinhaDoTempo,
  ListarAuditoriaQuery,
  PaginaDeAuditoria,
  RegistroDeAuditoria,
  UsuarioAutenticado,
} from '@gincana/contracts';

import { prisma } from '../../db.js';
import { naoEncontrado } from '../../middlewares/erros.js';
import { escopoDeLeituraDeLancamentos } from '../lancamentos/policy.js';

import { calcularMudancas, normalizarJson } from './mudancas.js';

/**
 * US09 — a leitura da trilha de auditoria.
 *
 * **Este módulo é somente leitura.** Quem grava é `registrar.ts`, sempre dentro da
 * transação que originou a mudança. Nada aqui cria, atualiza ou apaga registro: a tabela
 * é somente-inclusão e é justamente essa imutabilidade que sustenta o selo PQCRS.
 *
 * Duas decisões de autorização:
 *
 *  1. A linha do tempo de um lançamento tem **exatamente o mesmo escopo do lançamento**.
 *     A regra não é reescrita aqui: reaproveita `escopoDeLeituraDeLancamentos`, da US06.
 *     Quem não pode ver o lançamento recebe 404 — a mesma resposta de `GET /lancamentos/:id`,
 *     para que a existência do registro alheio não vaze pela diferença entre 403 e 404.
 *  2. O painel geral é só da administradora, barrado por papel no middleware da rota.
 */

const selecaoDoRegistro = {
  id: true,
  entidade: true,
  entidadeId: true,
  acao: true,
  autor: { select: { id: true, nome: true } },
  valoresAntes: true,
  valoresDepois: true,
  descricao: true,
  criadoEm: true,
} as const;

interface RegistroDoBanco {
  id: string;
  entidade: string;
  entidadeId: string;
  acao: AcaoAuditada;
  autor: { id: string; nome: string };
  valoresAntes: unknown;
  valoresDepois: unknown;
  descricao: string | null;
  criadoEm: Date;
}

/**
 * Monta a entrada que a tela consome.
 *
 * Os valores crus vão junto, mas o que a linha do tempo exibe é `mudancas`: a comparação
 * já feita, com rótulo em português. Assim o front não repete a lógica de "o que mudou"
 * — nem corre o risco de divergir dela.
 */
function montarRegistro(registro: RegistroDoBanco): RegistroDeAuditoria {
  const valoresAntes = normalizarJson(registro.valoresAntes);
  const valoresDepois = normalizarJson(registro.valoresDepois);

  return {
    id: registro.id,
    entidade: registro.entidade,
    entidadeId: registro.entidadeId,
    acao: registro.acao,
    autor: registro.autor,
    descricao: registro.descricao,
    criadoEm: registro.criadoEm.toISOString(),
    mudancas: calcularMudancas(valoresAntes, valoresDepois),
    valoresAntes,
    valoresDepois,
  };
}

/**
 * US09 — a linha do tempo de um lançamento: criado, recusado, corrigido, aprovado.
 *
 * O escopo entra na consulta do lançamento, não num filtro depois: o líder de outra
 * equipe não encontra o lançamento e, portanto, não chega à trilha dele.
 */
export async function linhaDoTempoDoLancamento(
  usuario: UsuarioAutenticado,
  lancamentoId: string,
): Promise<LinhaDoTempo> {
  const lancamento = await prisma.lancamento.findFirst({
    where: { AND: [{ id: lancamentoId }, escopoDeLeituraDeLancamentos(usuario)] },
    select: { id: true },
  });

  if (!lancamento) {
    throw naoEncontrado('Lançamento não encontrado.');
  }

  const registros = await prisma.registroAuditoria.findMany({
    where: { entidade: 'Lancamento', entidadeId: lancamento.id },
    select: selecaoDoRegistro,
    // Do mais antigo para o mais recente: a linha do tempo é lida de cima para baixo.
    // O `id` desempata registros gravados no mesmo instante dentro de uma transação.
    orderBy: [{ criadoEm: 'asc' }, { id: 'asc' }],
  });

  return {
    entidade: 'Lancamento',
    entidadeId: lancamento.id,
    itens: registros.map(montarRegistro),
  };
}

interface FiltrosDeAuditoria {
  entidade?: EntidadeAuditada;
  entidadeId?: string;
  autorId?: string;
  acao?: AcaoAuditada;
}

/** Só os filtros informados entram no `where`. Nenhum deles amplia escopo. */
export function filtrosDaAuditoria(filtros: ListarAuditoriaQuery): FiltrosDeAuditoria {
  const resultado: FiltrosDeAuditoria = {};

  if (filtros.entidade) {
    resultado.entidade = filtros.entidade;
  }
  if (filtros.entidadeId) {
    resultado.entidadeId = filtros.entidadeId;
  }
  if (filtros.autorId) {
    resultado.autorId = filtros.autorId;
  }
  if (filtros.acao) {
    resultado.acao = filtros.acao;
  }

  return resultado;
}

/**
 * US09 — o painel de evidência do PQCRS, só para a administradora.
 *
 * Mais recentes primeiro: quem abre a tela quer ver o que acabou de acontecer.
 */
export async function listarAuditoria(filtros: ListarAuditoriaQuery): Promise<PaginaDeAuditoria> {
  const where = filtrosDaAuditoria(filtros);

  const [total, registros] = await Promise.all([
    prisma.registroAuditoria.count({ where }),
    prisma.registroAuditoria.findMany({
      where,
      select: selecaoDoRegistro,
      orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }],
      skip: (filtros.pagina - 1) * filtros.porPagina,
      take: filtros.porPagina,
    }),
  ]);

  return {
    itens: registros.map(montarRegistro),
    pagina: filtros.pagina,
    porPagina: filtros.porPagina,
    total,
    totalDePaginas: Math.max(1, Math.ceil(total / filtros.porPagina)),
  };
}
