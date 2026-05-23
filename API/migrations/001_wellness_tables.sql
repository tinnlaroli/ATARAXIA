-- Wellness schema (local dev migration)
DROP TABLE IF EXISTS stress_assessment CASCADE;
DROP TABLE IF EXISTS wellness_destination CASCADE;

CREATE TABLE wellness_destination (
  id_destino VARCHAR(20) PRIMARY KEY,
  nombre_lugar VARCHAR(200) NOT NULL,
  estado VARCHAR(100),
  nivel_aislamiento NUMERIC(4,3) NOT NULL CHECK (nivel_aislamiento >= 0 AND nivel_aislamiento <= 1),
  restauracion_pasiva NUMERIC(4,3) NOT NULL CHECK (restauracion_pasiva >= 0 AND restauracion_pasiva <= 1),
  demanda_fisica NUMERIC(4,3) NOT NULL CHECK (demanda_fisica >= 0 AND demanda_fisica <= 1),
  categoria_principal VARCHAR(50) NOT NULL,
  latitude DECIMAL(10,6),
  longitude DECIMAL(10,6),
  fuente VARCHAR(50) DEFAULT 'manual',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_wellness_estado ON wellness_destination(estado);
CREATE INDEX idx_wellness_categoria ON wellness_destination(categoria_principal);
CREATE INDEX idx_wellness_active ON wellness_destination(is_active) WHERE is_active = TRUE;

CREATE TABLE stress_assessment (
  id_assessment SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES "user"(user_id) ON DELETE CASCADE,
  q1_energia_cognitiva SMALLINT NOT NULL CHECK (q1_energia_cognitiva BETWEEN 1 AND 3),
  q2_tension_fisica SMALLINT NOT NULL CHECK (q2_tension_fisica BETWEEN 1 AND 4),
  q3_rumiacion SMALLINT NOT NULL CHECK (q3_rumiacion BETWEEN 1 AND 3),
  q4_activacion_negativa SMALLINT NOT NULL CHECK (q4_activacion_negativa BETWEEN 1 AND 3),
  perfil_estres VARCHAR(40) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_stress_assessment_user ON stress_assessment(user_id, created_at DESC);
