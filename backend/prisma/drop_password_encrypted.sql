-- Eliminar columna passwordEncrypted de users (contraseñas reversibles son riesgo de seguridad)
-- Las contraseñas ya están protegidas con bcrypt en passwordHash
ALTER TABLE users DROP COLUMN IF EXISTS "passwordEncrypted";
