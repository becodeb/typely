-- Nuevas secciones de la tienda. NULL conserva el aspecto de serie.
ALTER TABLE arcade_profile ADD COLUMN IF NOT EXISTS equipped_impact text;
ALTER TABLE arcade_profile ADD COLUMN IF NOT EXISTS equipped_ship text;
