function defineAppSetting(sequelize, DataTypes) {
  return sequelize.define('AppSetting', {
    key: {
      allowNull: false,
      primaryKey: true,
      type: DataTypes.STRING,
    },
    updatedAt: {
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'updated_at',
      type: DataTypes.DATE,
    },
    value: {
      allowNull: false,
      type: DataTypes.TEXT,
    },
  }, {
    createdAt: false,
    freezeTableName: true,
    tableName: 'app_settings',
    timestamps: true,
    updatedAt: 'updatedAt',
  });
}

module.exports = { defineAppSetting };
