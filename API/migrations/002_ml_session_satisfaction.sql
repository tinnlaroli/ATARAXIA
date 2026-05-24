-- Encuesta post-resultado (1 pregunta) ligada a ml_recommendation_session
CREATE TABLE IF NOT EXISTS ml_session_satisfaction (
  id SERIAL PRIMARY KEY,
  session_id INT NOT NULL UNIQUE REFERENCES ml_recommendation_session(id) ON DELETE CASCADE,
  user_id VARCHAR(64) NOT NULL,
  fit_rating SMALLINT NOT NULL CHECK (fit_rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ml_session_satisfaction_created
  ON ml_session_satisfaction (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ml_session_satisfaction_rating
  ON ml_session_satisfaction (fit_rating);
