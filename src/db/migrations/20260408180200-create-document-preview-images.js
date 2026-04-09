const TABLE_NAME = 'document_preview_images';

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
    file_size: {
      type: Sequelize.INTEGER,
    },
    height: {
      type: Sequelize.INTEGER,
    },
    mime_type: {
      allowNull: false,
      defaultValue: 'image/png',
      type: Sequelize.STRING,
    },
    relative_path: {
      allowNull: false,
      type: Sequelize.STRING,
    },
    updated_at: {
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      type: Sequelize.DATE,
    },
    width: {
      type: Sequelize.INTEGER,
    },
  });
}

module.exports = {
  name: '20260408180200-create-document-preview-images',
  up,
};
