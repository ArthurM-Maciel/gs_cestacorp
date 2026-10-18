import type { RegraPontuacao, UsuarioAutenticado } from '@gincana/contracts';
import { selecionarRegraVigente, type RegraPontuacao as RegraParaCalculo } from '@gincana/scoring';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from '../../db.js';
import {
  criarCenarioDeCadastro,
  type CenarioDeCadastro,
  type GincanaDeTeste,
  type PessoaDeTeste,
} from '../../testes/cadastro.fixtures.js';

import {
  atualizarTipoAcao,
  criarTipoAcao,
  listarTiposAcao,
  registrarNovaRegra,
} from './service.js';

const MINUTO = 60_000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

/** Leva a regra do contrato de volta ao formato que o `@gincana/scoring` entende. */
function paraCalculo(regra: RegraPontuacao): RegraParaCalculo {
  return {
    id: regra.id,
    pontosPorUnidade: regra.pontosPorUnidade,
    vigenciaInicio: new Date(regra.vigenciaInicio),
    vigenciaFim: regra.vigenciaFim ? new Date(regra.vigenciaFim) : null,
  };
}

/** O JSON da auditoria chega sem forma; o teste diz o que espera encontrar nele. */
function retrato(valor: unknown): RetratoDeAuditoria {
  return valor as RetratoDeAuditoria;
}

interface RetratoDeAuditoria {
  pontosPorUnidade: number | null;
  vigenciaInicio?: string;
  vigenciaFim?: string | null;
  ativo?: boolean;
}

describe('US04 — tipos de ação e a troca de pontuação', () => {
  let cenario: CenarioDeCadastro;
  let gincana: GincanaDeTeste;
  let marieri: PessoaDeTeste;
  let comoColaborador: UsuarioAutenticado;
  let comoAdministradora: UsuarioAutenticado;
  let contador = 0;

  /** Nome único por teste: o par (gincana, nome) é único no banco. */
  const nomeDeTipo = (prefixo: string) => `${prefixo} ${cenario.marca}-${(contador += 1)}`;

  beforeAll(async () => {
    cenario = await criarCenarioDeCadastro();
    gincana = await cenario.criarGincana();
    marieri = await cenario.criarPessoa({ papel: 'ADMIN' });

    comoAdministradora = {
      id: marieri.id,
      nome: marieri.nome,
      email: marieri.email,
      papel: 'ADMIN',
      equipeId: null,
      equipeLideradaId: null,
    };
    comoColaborador = { ...comoAdministradora, papel: 'COLABORADOR' };
  });

  afterAll(async () => {
    await cenario.limpar();
  });

  /**
   * O teste que sustenta a promessa feita à cliente na tela de regras: "Mudanças valem só
   * para lançamentos novos e ficam registradas no histórico."
   */
  it('troca 8 por 10 pontos sem mexer no que valia antes', async () => {
    const inicioAntigo = new Date(Date.now() - HORA);
    const tipo = await criarTipoAcao(
      gincana.id,
      {
        nome: nomeDeTipo('Tampinhas'),
        unidade: 'KG',
        exigeEvidencia: true,
        pontosPorUnidade: 8,
        vigenciaInicio: inicioAntigo.toISOString(),
      },
      marieri.id,
    );

    expect(tipo.regraVigente?.pontosPorUnidade).toBe(8);
    expect(tipo.regraVigente?.vigenciaFim).toBeNull();
    const regraAntigaId = tipo.regraVigente?.id;

    const troca = new Date();
    const depois = await registrarNovaRegra(
      tipo.id,
      { pontosPorUnidade: 10, vigenciaInicio: troca.toISOString(), motivo: 'Reajuste da campanha' },
      marieri.id,
    );

    expect(depois.regraVigente?.pontosPorUnidade).toBe(10);
    expect(depois.regras).toHaveLength(2);

    // (a) a regra antiga ficou com a vigência fechada exatamente onde a nova começa
    const antiga = depois.regras.find((regra) => regra.id === regraAntigaId);
    expect(antiga?.pontosPorUnidade).toBe(8);
    expect(antiga?.vigenciaFim).toBe(troca.toISOString());
    expect(depois.regraVigente?.vigenciaInicio).toBe(troca.toISOString());

    // (b) e (c) quem decide o que valia em cada data é o pacote de cálculo
    const regras = depois.regras.map(paraCalculo);
    expect(selecionarRegraVigente(regras, new Date(troca.getTime() - MINUTO))?.pontosPorUnidade) //
      .toBe(8);
    expect(selecionarRegraVigente(regras, new Date(troca.getTime() + MINUTO))?.pontosPorUnidade) //
      .toBe(10);
    // No instante exato da virada já vale a nova: vigência aberta no fim, sem sobreposição.
    expect(selecionarRegraVigente(regras, troca)?.pontosPorUnidade).toBe(10);

    // (d) a troca entrou na trilha de auditoria com antes e depois
    const auditoria = await prisma.registroAuditoria.findFirst({
      where: { entidade: 'RegraPontuacao', entidadeId: depois.regraVigente?.id },
    });

    expect(auditoria?.acao).toBe('ALTERACAO');
    expect(auditoria?.autorId).toBe(marieri.id);
    expect(auditoria?.descricao).toContain('Reajuste da campanha');

    const antes = retrato(auditoria?.valoresAntes);
    const aposTroca = retrato(auditoria?.valoresDepois);
    expect(antes.pontosPorUnidade).toBe(8);
    expect(antes.vigenciaInicio).toBe(inicioAntigo.toISOString());
    expect(antes.vigenciaFim).toBe(troca.toISOString());
    expect(aposTroca.pontosPorUnidade).toBe(10);
    expect(aposTroca.vigenciaInicio).toBe(troca.toISOString());
    expect(aposTroca.vigenciaFim).toBeNull();
  });

  it('cadastra o tipo e a primeira regra na mesma transação, com auditoria das duas', async () => {
    const nome = nomeDeTipo('Livros');
    const tipo = await criarTipoAcao(
      gincana.id,
      { nome, unidade: 'UNIDADE', exigeEvidencia: false, pontosPorUnidade: 5 },
      marieri.id,
    );

    expect(tipo.regras).toHaveLength(1);
    expect(tipo.regraVigente?.pontosPorUnidade).toBe(5);

    const doTipo = await prisma.registroAuditoria.findFirst({
      where: { entidade: 'TipoAcao', entidadeId: tipo.id, acao: 'CRIACAO' },
    });
    const daRegra = await prisma.registroAuditoria.findFirst({
      where: { entidade: 'RegraPontuacao', entidadeId: tipo.regraVigente?.id, acao: 'CRIACAO' },
    });

    expect(doTipo).not.toBeNull();
    expect(daRegra).not.toBeNull();
  });

  it('aceita pontuação zero, para a ação simbólica que não soma ponto', async () => {
    const tipo = await criarTipoAcao(
      gincana.id,
      { nome: nomeDeTipo('Mural'), unidade: 'UNIDADE', exigeEvidencia: false, pontosPorUnidade: 0 },
      marieri.id,
    );

    expect(tipo.regraVigente?.pontosPorUnidade).toBe(0);
  });

  it('recusa vigência que comece antes da regra que está valendo', async () => {
    const tipo = await criarTipoAcao(
      gincana.id,
      {
        nome: nomeDeTipo('Agasalhos'),
        unidade: 'PECA',
        exigeEvidencia: true,
        pontosPorUnidade: 15,
      },
      marieri.id,
    );

    await expect(
      registrarNovaRegra(
        tipo.id,
        { pontosPorUnidade: 20, vigenciaInicio: new Date(Date.now() - DIA).toISOString() },
        marieri.id,
      ),
    ).rejects.toMatchObject({ status: 409, codigo: 'VIGENCIA_ANTERIOR_A_REGRA_ATUAL' });

    const regras = await prisma.regraPontuacao.findMany({ where: { tipoAcaoId: tipo.id } });
    expect(regras).toHaveLength(1);
    expect(regras[0]?.vigenciaFim).toBeNull();
  });

  it('mostra a pontuação vigente hoje, e não a primeira nem a última cadastrada', async () => {
    const nome = nomeDeTipo('Horas de voluntariado');
    const tipo = await criarTipoAcao(
      gincana.id,
      {
        nome,
        unidade: 'CERTIFICADO',
        exigeEvidencia: true,
        pontosPorUnidade: 8,
        vigenciaInicio: new Date(Date.now() - 10 * DIA).toISOString(),
      },
      marieri.id,
    );

    await registrarNovaRegra(
      tipo.id,
      { pontosPorUnidade: 10, vigenciaInicio: new Date(Date.now() - 5 * DIA).toISOString() },
      marieri.id,
    );
    await registrarNovaRegra(
      tipo.id,
      { pontosPorUnidade: 20, vigenciaInicio: new Date(Date.now() + DIA).toISOString() },
      marieri.id,
    );

    const listados = await listarTiposAcao(comoColaborador, gincana.id, {});
    const encontrado = listados.find((item) => item.id === tipo.id);

    expect(encontrado?.regraVigente?.pontosPorUnidade).toBe(10);

    const historico = await prisma.regraPontuacao.findMany({
      where: { tipoAcaoId: tipo.id },
      orderBy: { vigenciaInicio: 'asc' },
    });
    expect(historico).toHaveLength(3);
    // A regra agendada para amanhã fecha a de hoje: nenhuma sobreposição fica para trás.
    expect(historico[0]?.vigenciaFim).not.toBeNull();
    expect(historico[1]?.vigenciaFim).not.toBeNull();
    expect(historico[2]?.vigenciaFim).toBeNull();
  });

  it('pausar o tipo não apaga nem altera o histórico de pontuação', async () => {
    const tipo = await criarTipoAcao(
      gincana.id,
      {
        nome: nomeDeTipo('Brinquedos'),
        unidade: 'PECA',
        exigeEvidencia: true,
        pontosPorUnidade: 7,
      },
      marieri.id,
    );
    await registrarNovaRegra(tipo.id, { pontosPorUnidade: 9 }, marieri.id);

    const antesDePausar = await prisma.regraPontuacao.findMany({
      where: { tipoAcaoId: tipo.id },
      orderBy: { vigenciaInicio: 'asc' },
    });

    const pausado = await atualizarTipoAcao(tipo.id, { ativo: false }, marieri.id);
    expect(pausado.ativo).toBe(false);
    expect(pausado.regras).toHaveLength(2);
    expect(pausado.regraVigente?.pontosPorUnidade).toBe(9);

    const depoisDePausar = await prisma.regraPontuacao.findMany({
      where: { tipoAcaoId: tipo.id },
      orderBy: { vigenciaInicio: 'asc' },
    });
    expect(depoisDePausar.map((regra) => regra.pontosPorUnidade.toString())).toEqual(
      antesDePausar.map((regra) => regra.pontosPorUnidade.toString()),
    );

    // Some do catálogo de quem registra ação, mas continua à vista da administradora.
    const paraColaborador = await listarTiposAcao(comoColaborador, gincana.id, {});
    const paraAdministradora = await listarTiposAcao(comoAdministradora, gincana.id, {});
    expect(paraColaborador.map((item) => item.id)).not.toContain(tipo.id);
    expect(paraAdministradora.map((item) => item.id)).toContain(tipo.id);

    const aoPausar = await prisma.registroAuditoria.findFirst({
      where: { entidade: 'TipoAcao', entidadeId: tipo.id, acao: 'ALTERACAO' },
      orderBy: { criadoEm: 'desc' },
    });
    expect(retrato(aoPausar?.valoresAntes).ativo).toBe(true);
    expect(retrato(aoPausar?.valoresDepois).ativo).toBe(false);

    const reativado = await atualizarTipoAcao(tipo.id, { ativo: true }, marieri.id);
    expect(reativado.ativo).toBe(true);

    const aoReativar = await prisma.registroAuditoria.findMany({
      where: { entidade: 'TipoAcao', entidadeId: tipo.id, acao: 'ALTERACAO' },
    });
    expect(aoReativar).toHaveLength(2);
  });

  it('recusa nome repetido na mesma gincana e aceita o mesmo nome em outra', async () => {
    const nome = nomeDeTipo('Doação de alimentos');
    await criarTipoAcao(
      gincana.id,
      { nome, unidade: 'KG', exigeEvidencia: true, pontosPorUnidade: 2 },
      marieri.id,
    );

    await expect(
      criarTipoAcao(
        gincana.id,
        { nome, unidade: 'KG', exigeEvidencia: true, pontosPorUnidade: 3 },
        marieri.id,
      ),
    ).rejects.toMatchObject({ status: 409, codigo: 'NOME_DE_TIPO_DUPLICADO' });

    const outra = await cenario.criarGincana();
    const emOutraGincana = await criarTipoAcao(
      outra.id,
      { nome, unidade: 'KG', exigeEvidencia: true, pontosPorUnidade: 3 },
      marieri.id,
    );
    expect(emOutraGincana.nome).toBe(nome);
  });

  it('não encontra gincana inexistente', async () => {
    await expect(
      criarTipoAcao(
        '00000000-0000-4000-8000-000000000000',
        { nome: nomeDeTipo('Órfão'), unidade: 'KG', exigeEvidencia: true, pontosPorUnidade: 1 },
        marieri.id,
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
});
