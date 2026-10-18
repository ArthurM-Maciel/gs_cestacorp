-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('COLABORADOR', 'LIDER', 'ADMIN');

-- CreateEnum
CREATE TYPE "StatusGincana" AS ENUM ('PLANEJADA', 'ATIVA', 'ENCERRADA');

-- CreateEnum
CREATE TYPE "StatusLancamento" AS ENUM ('PENDENTE', 'APROVADO', 'RECUSADO');

-- CreateEnum
CREATE TYPE "Unidade" AS ENUM ('KG', 'UNIDADE', 'PECA', 'CERTIFICADO');

-- CreateEnum
CREATE TYPE "AcaoAuditoria" AS ENUM ('CRIACAO', 'APROVACAO', 'RECUSA', 'ALTERACAO', 'EXCLUSAO');

-- CreateTable
CREATE TABLE "colaboradores" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "papel" "Papel" NOT NULL DEFAULT 'COLABORADOR',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "equipeId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "colaboradores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gincanas" (
    "id" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "dataInicio" DATE NOT NULL,
    "dataFim" DATE NOT NULL,
    "status" "StatusGincana" NOT NULL DEFAULT 'PLANEJADA',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gincanas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipes" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "gincanaId" TEXT NOT NULL,
    "liderId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_acao" (
    "id" TEXT NOT NULL,
    "gincanaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "unidade" "Unidade" NOT NULL,
    "exigeEvidencia" BOOLEAN NOT NULL DEFAULT true,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tipos_acao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regras_pontuacao" (
    "id" TEXT NOT NULL,
    "tipoAcaoId" TEXT NOT NULL,
    "pontosPorUnidade" DECIMAL(10,2) NOT NULL,
    "vigenciaInicio" TIMESTAMP(3) NOT NULL,
    "vigenciaFim" TIMESTAMP(3),
    "criadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "regras_pontuacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lancamentos" (
    "id" TEXT NOT NULL,
    "gincanaId" TEXT NOT NULL,
    "colaboradorId" TEXT NOT NULL,
    "equipeId" TEXT NOT NULL,
    "tipoAcaoId" TEXT NOT NULL,
    "quantidade" DECIMAL(10,3) NOT NULL,
    "regraPontuacaoId" TEXT NOT NULL,
    "pontosPorUnidadeAplicado" DECIMAL(10,2) NOT NULL,
    "pontosCalculados" INTEGER NOT NULL,
    "status" "StatusLancamento" NOT NULL DEFAULT 'PENDENTE',
    "observacao" TEXT,
    "dataAcao" DATE NOT NULL,
    "avaliadoPorId" TEXT,
    "avaliadoEm" TIMESTAMP(3),
    "motivoRecusa" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lancamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidencias" (
    "id" TEXT NOT NULL,
    "lancamentoId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "tamanhoBytes" INTEGER NOT NULL,
    "enviadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registros_auditoria" (
    "id" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "acao" "AcaoAuditoria" NOT NULL,
    "autorId" TEXT NOT NULL,
    "valoresAntes" JSONB,
    "valoresDepois" JSONB,
    "descricao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registros_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "colaboradores_email_key" ON "colaboradores"("email");

-- CreateIndex
CREATE INDEX "colaboradores_equipeId_idx" ON "colaboradores"("equipeId");

-- CreateIndex
CREATE UNIQUE INDEX "gincanas_ano_key" ON "gincanas"("ano");

-- CreateIndex
CREATE INDEX "gincanas_status_idx" ON "gincanas"("status");

-- CreateIndex
CREATE UNIQUE INDEX "equipes_liderId_key" ON "equipes"("liderId");

-- CreateIndex
CREATE INDEX "equipes_gincanaId_idx" ON "equipes"("gincanaId");

-- CreateIndex
CREATE UNIQUE INDEX "equipes_gincanaId_nome_key" ON "equipes"("gincanaId", "nome");

-- CreateIndex
CREATE INDEX "tipos_acao_gincanaId_ativo_idx" ON "tipos_acao"("gincanaId", "ativo");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_acao_gincanaId_nome_key" ON "tipos_acao"("gincanaId", "nome");

-- CreateIndex
CREATE INDEX "regras_pontuacao_tipoAcaoId_vigenciaInicio_idx" ON "regras_pontuacao"("tipoAcaoId", "vigenciaInicio");

-- CreateIndex
CREATE INDEX "regras_pontuacao_tipoAcaoId_vigenciaFim_idx" ON "regras_pontuacao"("tipoAcaoId", "vigenciaFim");

-- CreateIndex
CREATE INDEX "lancamentos_gincanaId_status_idx" ON "lancamentos"("gincanaId", "status");

-- CreateIndex
CREATE INDEX "lancamentos_equipeId_status_idx" ON "lancamentos"("equipeId", "status");

-- CreateIndex
CREATE INDEX "lancamentos_colaboradorId_status_idx" ON "lancamentos"("colaboradorId", "status");

-- CreateIndex
CREATE INDEX "evidencias_lancamentoId_idx" ON "evidencias"("lancamentoId");

-- CreateIndex
CREATE INDEX "registros_auditoria_entidade_entidadeId_criadoEm_idx" ON "registros_auditoria"("entidade", "entidadeId", "criadoEm");

-- CreateIndex
CREATE INDEX "registros_auditoria_autorId_idx" ON "registros_auditoria"("autorId");

-- AddForeignKey
ALTER TABLE "colaboradores" ADD CONSTRAINT "colaboradores_equipeId_fkey" FOREIGN KEY ("equipeId") REFERENCES "equipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipes" ADD CONSTRAINT "equipes_gincanaId_fkey" FOREIGN KEY ("gincanaId") REFERENCES "gincanas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipes" ADD CONSTRAINT "equipes_liderId_fkey" FOREIGN KEY ("liderId") REFERENCES "colaboradores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tipos_acao" ADD CONSTRAINT "tipos_acao_gincanaId_fkey" FOREIGN KEY ("gincanaId") REFERENCES "gincanas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regras_pontuacao" ADD CONSTRAINT "regras_pontuacao_tipoAcaoId_fkey" FOREIGN KEY ("tipoAcaoId") REFERENCES "tipos_acao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regras_pontuacao" ADD CONSTRAINT "regras_pontuacao_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "colaboradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_gincanaId_fkey" FOREIGN KEY ("gincanaId") REFERENCES "gincanas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_colaboradorId_fkey" FOREIGN KEY ("colaboradorId") REFERENCES "colaboradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_equipeId_fkey" FOREIGN KEY ("equipeId") REFERENCES "equipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_tipoAcaoId_fkey" FOREIGN KEY ("tipoAcaoId") REFERENCES "tipos_acao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_regraPontuacaoId_fkey" FOREIGN KEY ("regraPontuacaoId") REFERENCES "regras_pontuacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_avaliadoPorId_fkey" FOREIGN KEY ("avaliadoPorId") REFERENCES "colaboradores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidencias" ADD CONSTRAINT "evidencias_lancamentoId_fkey" FOREIGN KEY ("lancamentoId") REFERENCES "lancamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidencias" ADD CONSTRAINT "evidencias_enviadoPorId_fkey" FOREIGN KEY ("enviadoPorId") REFERENCES "colaboradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_auditoria" ADD CONSTRAINT "registros_auditoria_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "colaboradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
