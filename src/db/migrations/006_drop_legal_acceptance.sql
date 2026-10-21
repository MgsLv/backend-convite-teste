-- o aceite do Aviso de Privacidade e dos Termos de Uso deixou de fazer parte do cadastro (decisão da gerência):
-- o payload não traz mais `aceite` e o backend não grava nada sobre ele

-- dependente primeiro: legal_acceptances referencia legal_documents
DROP TABLE IF EXISTS legal_acceptances;
DROP TABLE IF EXISTS legal_documents;
