/**
 * Prepara o banco usado pelos testes automatizados.
 *
 * Cria o banco se ele ainda não existir e aplica as migrations. É idempotente: rodar de
 * novo não quebra nada. Na integração contínua o banco já nasce criado pelo serviço, e
 * então só a parte das migrations tem efeito.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)), quiet: true });

const URL_DO_TESTE =
  process.env.DATABASE_URL_TEST ?? 'postgresql://gincana:gincana@localhost:5432/gincana_test';

const url = new URL(URL_DO_TESTE);
const nomeDoBanco = url.pathname.slice(1);

// Conecta no banco administrativo para poder criar o de teste.
const administrativo = new URL(URL_DO_TESTE);
administrativo.pathname = '/postgres';

const cliente = new pg.Client({ connectionString: administrativo.toString() });

try {
  await cliente.connect();
} catch (erro) {
  console.error(
    `Não consegui falar com o PostgreSQL em ${url.host}. ` +
      'O banco local está no ar? Rode: docker compose up -d db',
  );
  console.error(erro instanceof Error ? erro.message : erro);
  process.exit(1);
}

const existe = await cliente.query('SELECT 1 FROM pg_database WHERE datname = $1', [nomeDoBanco]);

if (existe.rowCount === 0) {
  // O nome vem da nossa própria configuração, mas passa pelo identificador citado
  // mesmo assim: CREATE DATABASE não aceita parâmetro.
  await cliente.query(`CREATE DATABASE "${nomeDoBanco.replace(/"/g, '""')}"`);
  console.warn(`Banco de teste "${nomeDoBanco}" criado.`);
} else {
  console.warn(`Banco de teste "${nomeDoBanco}" já existe.`);
}

await cliente.end();

execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: URL_DO_TESTE },
});

console.warn('Banco de teste pronto.');
