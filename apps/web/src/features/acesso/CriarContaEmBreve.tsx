import { Link } from 'react-router-dom';

import { botaoPrimario } from '../../components/estilos-de-botao.js';
import { LayoutDeAcesso } from './LayoutDeAcesso.js';

/**
 * Destino provisório de "Criar conta". O cadastro tem história própria e ainda depende de
 * decisão da PO sobre quem escolhe a equipe (ver "Lacunas conhecidas" em
 * `docs/prototipo/README.md`). Quando a história entrar, ela troca o elemento desta rota.
 */
export function CriarContaEmBreve() {
  return (
    <LayoutDeAcesso voltarPara="/">
      <h1 className="mt-8 text-3xl leading-tight font-bold tracking-tight lg:mt-0">
        Criar conta <span className="block text-marca-600">em breve</span>
      </h1>
      <p className="mt-2 text-texto-suave">
        O cadastro ainda não está disponível. Se você já tem acesso, entre com o seu e-mail
        corporativo.
      </p>
      <Link to="/entrar" className={`${botaoPrimario} mt-8`}>
        Ir para o login
      </Link>
    </LayoutDeAcesso>
  );
}
