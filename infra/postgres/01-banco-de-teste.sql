-- Banco usado pelos testes automatizados, criado junto do banco de desenvolvimento.
--
-- Existe separado de propósito: os testes apagam e recriam dados, e ninguém quer perder
-- a carga de demonstração no meio de uma Sprint Review por ter rodado `npm test`.
CREATE DATABASE gincana_test OWNER gincana;
