const TABLE_NAME = 'access_requests';

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
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: Sequelize.INTEGER,
    },
    cpf: {
      allowNull: false,
      type: Sequelize.TEXT,
    },
    user_id: {
      allowNull: true,
      type: Sequelize.INTEGER,
      references: {
        model: 'app_users',
        key: 'id',
      },
      onDelete: 'SET NULL',
    },
    requested_at: {
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      type: Sequelize.DATE,
    },
    requested_by_ip: {
      allowNull: true,
      type: Sequelize.TEXT,
    },
    status: {
      allowNull: false,
      type: Sequelize.TEXT,
      defaultValue: 'pending',
    },
    full_name: {
      allowNull: true,
      type: Sequelize.TEXT,
    },
    admin_user_id: {
      allowNull: true,
      type: Sequelize.INTEGER,
      references: {
        model: 'app_users',
        key: 'id',
      },
      onDelete: 'SET NULL',
    },
    responded_at: {
      allowNull: true,
      type: Sequelize.DATE,
    },
  });
}

module.exports = {
  name: '20260410123000-create-access-requests',
  up,
};
