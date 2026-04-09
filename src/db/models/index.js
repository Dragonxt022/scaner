const { DataTypes } = require('sequelize');
const { getSequelize } = require('../sequelize');
const { defineAppSetting } = require('./app-setting');
const { defineDocumentEnrichment } = require('./document-enrichment');
const { defineDocumentPreviewImage } = require('./document-preview-image');

let models;

function defineModels() {
  if (models) {
    return models;
  }

  const sequelize = getSequelize();

  models = {
    AppSetting: defineAppSetting(sequelize, DataTypes),
    DocumentEnrichment: defineDocumentEnrichment(sequelize, DataTypes),
    DocumentPreviewImage: defineDocumentPreviewImage(sequelize, DataTypes),
    sequelize,
  };

  return models;
}

module.exports = {
  defineModels,
};
