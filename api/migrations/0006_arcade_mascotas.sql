-- Acompañante puramente visual. NULL significa volar sin mascota.
ALTER TABLE arcade_profile ADD COLUMN IF NOT EXISTS equipped_pet text;
