-- Token usage tracking table for monthly hard limits
CREATE TABLE token_usage (
  id SERIAL PRIMARY KEY,
  month_year DATE NOT NULL,
  total_tokens BIGINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(month_year)
);

CREATE INDEX idx_token_usage_month ON token_usage(month_year);
