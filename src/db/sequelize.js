const fs = require('node:fs');
const path = require('node:path');
const { Sequelize } = require('sequelize');
const config = require('../config');

let sequelize;

function buildSequelizeOptions() {
  const logging = config.dbLogging ? console.log : false;

  if (config.dbDialect === 'mysql') {
    return {
      database: config.dbName,
      dialect: 'mysql',
      host: config.dbHost,
      logging,
      password: config.dbPassword,
      port: config.dbPort,
      username: config.dbUser,
    };
  }

  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

  return {
    dialect: 'sqlite',
    logging,
    storage: config.dbPath,
  };
}

function getSequelize() {
  if (!sequelize) {
    const options = buildSequelizeOptions();
    sequelize = config.dbDialect === 'mysql'
      ? new Sequelize(options.database, options.username, options.password, options)
      : new Sequelize(options);
  }

  return sequelize;
}

async function authenticateDatabase() {
  const instance = getSequelize();
  await instance.authenticate();
  return {
    database: config.dbDialect === 'mysql' ? config.dbName : config.dbPath,
    dialect: config.dbDialect,
  };
}

async function closeSequelize() {
  if (sequelize) {
    await sequelize.close();
    sequelize = null;
  }
}

module.exports = {
  authenticateDatabase,
  closeSequelize,
  getSequelize,
};
