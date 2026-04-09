function defineDocumentPreviewImage(sequelize, DataTypes) {
  return sequelize.define('DocumentPreviewImage', {
    createdAt: {
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'created_at',
      type: DataTypes.DATE,
    },
    documentId: {
      allowNull: false,
      field: 'document_id',
      primaryKey: true,
      type: DataTypes.INTEGER,
    },
    fileSize: {
      field: 'file_size',
      type: DataTypes.INTEGER,
    },
    height: {
      type: DataTypes.INTEGER,
    },
    mimeType: {
      allowNull: false,
      defaultValue: 'image/png',
      field: 'mime_type',
      type: DataTypes.STRING,
    },
    relativePath: {
      allowNull: false,
      field: 'relative_path',
      type: DataTypes.STRING,
    },
    updatedAt: {
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'updated_at',
      type: DataTypes.DATE,
    },
    width: {
      type: DataTypes.INTEGER,
    },
  }, {
    createdAt: 'createdAt',
    freezeTableName: true,
    tableName: 'document_preview_images',
    timestamps: true,
    updatedAt: 'updatedAt',
  });
}

module.exports = { defineDocumentPreviewImage };
