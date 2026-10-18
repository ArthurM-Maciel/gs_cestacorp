import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import bcrypt from 'bcryptjs';

/**
 * Dados de demonstração da Gincana Solidária.
 *
 * Reproduz o que aparece no protótipo (`docs/prototipo/README.md`) para que a Sprint
 * Review mostre a tela com os mesmos números que a cliente já viu. É idempotente: roda
 * quantas vezes for preciso sem duplicar nada.
 *
 * Os nomes aqui são fictícios de propósito. Dado real de colaborador da Cestacorp não
 * entra em repositório nem em ambiente de teste.
 */

const conexao = process.env.DATABASE_URL;

if (conexao === undefined || conexao === '') {
  throw new Error('Defina DATABASE_URL antes de rodar o seed.');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: conexao }) });

const SENHA_DE_DEMONSTRACAO = 'Gincana@2026';

const data = (texto: string) => new Date(`${texto}T12:00:00.000Z`);

async function main(): Promise<void> {
  const senhaHash = await bcrypt.hash(SENHA_DE_DEMONSTRACAO, 10);

  const gincana = await prisma.gincana.upsert({
    where: { ano: 2026 },
    update: {},
    create: {
      ano: 2026,
      nome: 'Gincana Solidária 2026',
      dataInicio: data('2026-03-02'),
      dataFim: data('2026-11-30'),
      status: 'ATIVA',
    },
  });

  const admin = await prisma.colaborador.upsert({
    where: { email: 'marieri@cestacorp.com.br' },
    update: {},
    create: {
      nome: 'Marieri Gazen',
      email: 'marieri@cestacorp.com.br',
      senhaHash,
      papel: 'ADMIN',
    },
  });

  // Seis equipes, como no protótipo. Cada uma tem um líder, que aprova os lançamentos
  // da própria equipe.
  const composicao = [
    { equipe: 'Equipe Ipê', lider: 'Fernanda Alves', membros: ['Diego Martins', 'Rafael Costa'] },
    { equipe: 'Equipe Araucária', lider: 'Arthur Souza', membros: ['Camila Rocha', 'Paula Nunes'] },
    { equipe: 'Equipe Jacarandá', lider: 'Bruno Carvalho', membros: ['Helena Dias'] },
    { equipe: 'Equipe Paineira', lider: 'Juliana Prado', membros: ['Tiago Moreira'] },
    { equipe: 'Equipe Figueira', lider: 'Marcos Vieira', membros: ['Sofia Lemos'] },
    { equipe: 'Equipe Pitanga', lider: 'Letícia Barros', membros: ['Rodrigo Pinto'] },
  ];

  const emailDe = (nome: string) =>
    `${nome
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, '.')}@cestacorp.com.br`;

  const pessoas = new Map<string, string>();

  for (const { equipe: nomeEquipe, lider, membros } of composicao) {
    const equipe = await prisma.equipe.upsert({
      where: { gincanaId_nome: { gincanaId: gincana.id, nome: nomeEquipe } },
      update: {},
      create: { nome: nomeEquipe, gincanaId: gincana.id },
    });

    const registroLider = await prisma.colaborador.upsert({
      where: { email: emailDe(lider) },
      update: { equipeId: equipe.id },
      create: {
        nome: lider,
        email: emailDe(lider),
        senhaHash,
        papel: 'LIDER',
        equipeId: equipe.id,
      },
    });
    pessoas.set(lider, registroLider.id);

    await prisma.equipe.update({
      where: { id: equipe.id },
      data: { liderId: registroLider.id },
    });

    for (const membro of membros) {
      const registro = await prisma.colaborador.upsert({
        where: { email: emailDe(membro) },
        update: { equipeId: equipe.id },
        create: { nome: membro, email: emailDe(membro), senhaHash, equipeId: equipe.id },
      });
      pessoas.set(membro, registro.id);
    }
  }

  // Tipos de ação e suas regras, com os pontos que aparecem no protótipo.
  const tipos = [
    { nome: 'Doação de alimentos', unidade: 'KG' as const, pontos: 10, exigeEvidencia: true },
    { nome: 'Doação de tampinhas', unidade: 'KG' as const, pontos: 10, exigeEvidencia: true },
    { nome: 'Doação de roupas', unidade: 'PECA' as const, pontos: 15, exigeEvidencia: true },
    {
      nome: 'Curso ou PDI',
      unidade: 'CERTIFICADO' as const,
      pontos: 50,
      exigeEvidencia: true,
    },
  ];

  const regrasDe = new Map<
    string,
    { tipoId: string; regras: { id: string; pontos: number; inicio: Date; fim: Date | null }[] }
  >();

  for (const tipo of tipos) {
    const tipoAcao = await prisma.tipoAcao.upsert({
      where: { gincanaId_nome: { gincanaId: gincana.id, nome: tipo.nome } },
      update: {},
      create: {
        gincanaId: gincana.id,
        nome: tipo.nome,
        unidade: tipo.unidade,
        exigeEvidencia: tipo.exigeEvidencia,
      },
    });

    const jaTemRegra = await prisma.regraPontuacao.findFirst({
      where: { tipoAcaoId: tipoAcao.id },
    });

    if (jaTemRegra === null) {
      // Tampinhas nasce com histórico: começou valendo 8 pontos por quilo e passou a
      // valer 10. É o que demonstra, ao vivo, que mudar a regra não mexe no que já foi
      // apurado.
      if (tipo.nome === 'Doação de tampinhas') {
        await prisma.regraPontuacao.create({
          data: {
            tipoAcaoId: tipoAcao.id,
            pontosPorUnidade: 8,
            vigenciaInicio: data('2026-03-02'),
            vigenciaFim: data('2026-07-01'),
            criadoPorId: admin.id,
          },
        });
      }

      await prisma.regraPontuacao.create({
        data: {
          tipoAcaoId: tipoAcao.id,
          pontosPorUnidade: tipo.pontos,
          vigenciaInicio:
            tipo.nome === 'Doação de tampinhas' ? data('2026-07-01') : data('2026-03-02'),
          criadoPorId: admin.id,
        },
      });
    }

    const regras = await prisma.regraPontuacao.findMany({
      where: { tipoAcaoId: tipoAcao.id },
      orderBy: { vigenciaInicio: 'asc' },
    });

    regrasDe.set(tipo.nome, {
      tipoId: tipoAcao.id,
      regras: regras.map((r) => ({
        id: r.id,
        pontos: Number(r.pontosPorUnidade),
        inicio: r.vigenciaInicio,
        fim: r.vigenciaFim,
      })),
    });
  }

  // Lançamentos da demonstração: uma fila de pendentes para o líder aprovar ao vivo,
  // aprovados que alimentam o placar e um recusado com motivo visível.
  const lancamentos: {
    pessoa: string;
    tipo: string;
    qtd: number;
    status: 'PENDENTE' | 'APROVADO' | 'RECUSADO';
    motivo?: string;
    dataAcao?: string;
  }[] = [
    // Lançamento feito quando tampinhas ainda valia 8 pontos por quilo. Ele continua
    // valendo 8 mesmo depois de a regra virar 10: é a prova visível, na Sprint Review,
    // de que mudar a pontuação não mexe no que já foi apurado.
    {
      pessoa: 'Helena Dias',
      tipo: 'Doação de tampinhas',
      qtd: 10,
      status: 'APROVADO' as const,
      dataAcao: '2026-04-20',
    },
    { pessoa: 'Camila Rocha', tipo: 'Doação de alimentos', qtd: 12, status: 'PENDENTE' as const },
    { pessoa: 'Diego Martins', tipo: 'Doação de tampinhas', qtd: 3, status: 'PENDENTE' as const },
    { pessoa: 'Paula Nunes', tipo: 'Doação de roupas', qtd: 8, status: 'PENDENTE' as const },
    { pessoa: 'Camila Rocha', tipo: 'Doação de tampinhas', qtd: 24, status: 'APROVADO' as const },
    { pessoa: 'Paula Nunes', tipo: 'Doação de roupas', qtd: 3, status: 'APROVADO' as const },
    { pessoa: 'Rafael Costa', tipo: 'Curso ou PDI', qtd: 1, status: 'APROVADO' as const },
    { pessoa: 'Helena Dias', tipo: 'Doação de alimentos', qtd: 20, status: 'APROVADO' as const },
    { pessoa: 'Tiago Moreira', tipo: 'Doação de tampinhas', qtd: 15, status: 'APROVADO' as const },
    {
      pessoa: 'Camila Rocha',
      tipo: 'Doação de roupas',
      qtd: 5,
      status: 'RECUSADO' as const,
      motivo: 'Foto sem a etiqueta da ONG.',
    },
  ];

  const jaTemLancamento = await prisma.lancamento.findFirst({ where: { gincanaId: gincana.id } });

  if (jaTemLancamento === null) {
    for (const item of lancamentos) {
      const colaboradorId = pessoas.get(item.pessoa);
      const tipo = regrasDe.get(item.tipo);
      const dataAcao = data(item.dataAcao ?? '2026-09-15');

      // Mesma seleção que a API faz: vale a regra vigente na data em que a ação
      // aconteceu, não a de hoje.
      const regra = tipo?.regras.find(
        (r) => r.inicio <= dataAcao && (r.fim === null || dataAcao < r.fim),
      );

      if (colaboradorId === undefined || tipo === undefined || regra === undefined) {
        continue;
      }

      const colaborador = await prisma.colaborador.findUniqueOrThrow({
        where: { id: colaboradorId },
        include: { equipe: { select: { id: true, liderId: true } } },
      });

      if (colaborador.equipe === null) {
        continue;
      }

      const avaliadorId =
        item.status === 'PENDENTE' ? null : (colaborador.equipe.liderId ?? admin.id);

      const lancamento = await prisma.lancamento.create({
        data: {
          gincanaId: gincana.id,
          colaboradorId,
          equipeId: colaborador.equipe.id,
          tipoAcaoId: tipo.tipoId,
          quantidade: item.qtd,
          regraPontuacaoId: regra.id,
          pontosPorUnidadeAplicado: regra.pontos,
          pontosCalculados: Math.round(item.qtd * regra.pontos),
          status: item.status,
          dataAcao,
          motivoRecusa: item.motivo ?? null,
          avaliadoPorId: avaliadorId,
          avaliadoEm: avaliadorId === null ? null : data('2026-09-16'),
        },
      });

      await prisma.registroAuditoria.create({
        data: {
          entidade: 'Lancamento',
          entidadeId: lancamento.id,
          acao: 'CRIACAO',
          autorId: colaboradorId,
          valoresDepois: {
            quantidade: item.qtd,
            pontosCalculados: lancamento.pontosCalculados,
            status: 'PENDENTE',
          },
          descricao: `Registrou ${item.qtd} de ${item.tipo}`,
          criadoEm: dataAcao,
        },
      });

      if (avaliadorId !== null) {
        await prisma.registroAuditoria.create({
          data: {
            entidade: 'Lancamento',
            entidadeId: lancamento.id,
            acao: item.status === 'APROVADO' ? 'APROVACAO' : 'RECUSA',
            autorId: avaliadorId,
            valoresAntes: { status: 'PENDENTE' },
            valoresDepois: { status: item.status },
            descricao:
              item.status === 'APROVADO'
                ? 'Aprovou o lançamento'
                : `Recusou o lançamento: ${item.motivo ?? ''}`,
            criadoEm: data('2026-09-16'),
          },
        });
      }
    }
  }

  const totais = await prisma.lancamento.groupBy({
    by: ['status'],
    where: { gincanaId: gincana.id },
    _count: true,
  });

  console.warn('Seed concluído.');
  console.warn(`  Gincana: ${gincana.nome}`);
  console.warn(`  Colaboradores: ${await prisma.colaborador.count()}`);
  console.warn(`  Equipes: ${await prisma.equipe.count()}`);
  console.warn(`  Lançamentos: ${totais.map((t) => `${t.status}=${t._count}`).join(', ')}`);
  console.warn(`  Senha de todos no ambiente de demonstração: ${SENHA_DE_DEMONSTRACAO}`);
}

main()
  .catch((erro: unknown) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
