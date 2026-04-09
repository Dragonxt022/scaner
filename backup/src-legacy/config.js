require('dotenv').config({ override: true, quiet: true });

const config = {
  loginUrl: process.env.LOGIN_URL,
  consultaUrl: process.env.CONSULTA_URL,
  username: process.env.USERNAME,
  password: process.env.PASSWORD,
};

function validateConfig() {
  const missing = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Configuracao ausente: ${missing.join(', ')}`);
  }
}

module.exports = {
  ...config,
  validateConfig,
};
