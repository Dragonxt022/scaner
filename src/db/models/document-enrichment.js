function defineDocumentEnrichment(sequelize, DataTypes) {
  return sequelize.define('DocumentEnrichment', {
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
    summaryModel: {
      field: 'summary_model',
      type: DataTypes.STRING,
    },
    summarySource: {
      field: 'summary_source',
      type: DataTypes.STRING,
    },
    summaryText: {
      field: 'summary_text',
      type: DataTypes.TEXT,
    },
    updatedAt: {
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'updated_at',
      type: DataTypes.DATE,
    },
  }, {
    createdAt: 'createdAt',
    freezeTableName: true,
    tableName: 'document_enrichments',
    timestamps: true,
    updatedAt: 'updatedAt',
  });
}

module.exports = { defineDocumentEnrichment };
