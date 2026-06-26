-- Índices de rendimiento agregados para escalabilidad
-- Se pueden ejecutar sin downtime (CREATE INDEX IF NOT EXISTS)

CREATE INDEX IF NOT EXISTS "inventory_movements_businessId_fecha_idx"
  ON inventory_movements("businessId", fecha);

CREATE INDEX IF NOT EXISTS "inventory_movements_businessId_tipo_idx"
  ON inventory_movements("businessId", tipo);

CREATE INDEX IF NOT EXISTS "sales_businessId_estado_fecha_idx"
  ON sales("businessId", estado, fecha);

CREATE INDEX IF NOT EXISTS "cash_sessions_businessId_userId_estado_idx"
  ON cash_sessions("businessId", "userId", estado);

CREATE INDEX IF NOT EXISTS "cash_sessions_businessId_estado_idx"
  ON cash_sessions("businessId", estado);
