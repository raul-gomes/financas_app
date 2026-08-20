-- Normalização: is_parcelado
-- Marca is_parcelado = true para transações que realmente são parceladas
-- Critério: total_parcelas > 1 ou parcela é preenchida
-- Marca is_parcelado = false para o restante

BEGIN;

-- True: total_parcelas > 1 (ou parcela > 0 quando total_parcelas > 1)
UPDATE transacoes
SET is_parcelado = true
WHERE total_parcelas IS NOT NULL
  AND total_parcelas > 1
  AND is_parcelado IS DISTINCT FROM true;

-- False: total_parcelas = 1, nulo, ou 0
UPDATE transacoes
SET is_parcelado = false
WHERE (total_parcelas IS NULL OR total_parcelas <= 1)
  AND is_parcelado IS DISTINCT FROM false;

-- Garantir que NOT NULL em toda a tabela
UPDATE transacoes SET is_parcelado = false WHERE is_parcelado IS NULL;

COMMIT;
