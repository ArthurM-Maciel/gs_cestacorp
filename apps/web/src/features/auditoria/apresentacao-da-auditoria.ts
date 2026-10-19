import type { AcaoAuditada, EntidadeAuditada } from '@gincana/contracts';

/** A cor de cada ação na etiqueta. A palavra vai sempre junto: a cor sozinha não conta. */
export const tomDaAcao: Record<AcaoAuditada, 'sucesso' | 'atencao' | 'neutro' | 'erro'> = {
  CRIACAO: 'neutro',
  APROVACAO: 'sucesso',
  RECUSA: 'erro',
  ALTERACAO: 'atencao',
  EXCLUSAO: 'erro',
};

/** O marcador da linha do tempo. Classes por extenso: o Tailwind só gera o que encontra. */
export const marcadorDaAcao: Record<AcaoAuditada, string> = {
  CRIACAO: 'bg-marca-600',
  APROVACAO: 'bg-aprovado',
  RECUSA: 'bg-recusado',
  ALTERACAO: 'bg-pendente',
  EXCLUSAO: 'bg-recusado',
};

const rotulosDeEntidade: Record<EntidadeAuditada, string> = {
  Lancamento: 'Lançamento',
  RegraPontuacao: 'Regra de pontuação',
  TipoAcao: 'Tipo de ação',
  Colaborador: 'Colaborador',
  Equipe: 'Equipe',
  Gincana: 'Gincana',
};

/**
 * `entidade` chega como texto livre na resposta (a API não a restringe a uma lista), então
 * uma entidade que esta tela não conhece aparece como veio, em vez de sumir.
 */
export function rotuloDaEntidade(entidade: string): string {
  return Object.hasOwn(rotulosDeEntidade, entidade)
    ? rotulosDeEntidade[entidade as EntidadeAuditada]
    : entidade;
}
