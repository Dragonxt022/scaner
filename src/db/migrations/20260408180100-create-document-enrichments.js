const TABLE_NAME = 'document_enrichments';

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
    created_at: {
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      type: Sequelize.DATE,
    },
    document_id: {
      allowNull: false,
      primaryKey: true,
      type: Sequelize.INTEGER,
    },
    summary_model: {
      type: Sequelize.STRING,
    },
    summary_source: {
      type: Sequelize.STRING,
    },
    summary_text: {
      type: Sequelize.TEXT,
    },
    updated_at: {
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      type: Sequelize.DATE,
    },
  });
}

module.exports = {
  name: '20260408180100-create-document-enrichments',
  up,
};
