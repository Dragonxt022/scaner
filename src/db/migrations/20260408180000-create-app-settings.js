const TABLE_NAME = 'app_settings';

async function tableExists(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  return tables
    .map((item) => (typeof item === 'string' ? item : item.tableName || item.table_name || ''))
    .some((item) => String(item).toLowerCase() === tableName.toLowerCase());
}

async function up({ queryInterface, Sequelize }) {
  if (await tableExists(queryInterface, TABLE_NAME)) {
    return;
  }

  await queryInterface.createTable(TABLE_NAME, {
    key: {
      allowNull: false,
      primaryKey: true,
      type: Sequelize.STRING,
    },
    updated_at: {
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      type: Sequelize.DATE,
    },
    value: {
      allowNull: false,
      type: Sequelize.TEXT,
    },
  });
}

module.exports = {
  name: '20260408180000-create-app-settings',
  up,
};
