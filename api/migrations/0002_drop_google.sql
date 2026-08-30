-- =====================================================================
-- Se elimina el inicio de sesión con Google.
--
-- Decisión de producto: la ÚNICA forma de entrar es con una cuenta creada
-- por un administrador. Un colegio reparte credenciales; no quiere que
-- cualquiera con un correo entre solo.
--
-- Esto va como migración aparte y no editando 0001 porque 0001 YA está
-- aplicada en producción. Editarla haría que el archivo y la base real
-- dijeran cosas distintas, y una instalación nueva quedaría con un
-- esquema diferente al de producción.
--
-- El email SE CONSERVA: sigue sirviendo para contacto y para recuperar una
-- cuenta. Lo que se va es el vínculo con la identidad de Google.
-- =====================================================================

ALTER TABLE users DROP COLUMN IF EXISTS google_sub;
