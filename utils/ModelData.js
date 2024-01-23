class ModelData {
  static TYPES = ["real", "anime", "gal"];
  static DEFAULT_TYPE = "anime";
  static MAPPING = {
      "real": "galdreamer",
      "anime": "galmix",
      "perfectcg": "galdream",
  };

  static isValidModelType(modelType) {
      return ModelData.TYPES.includes(modelType);
  }

  static isValidModelName(modelName) {
      return Object.values(ModelData.MAPPING).includes(modelName);
  }

  static getModelName(modelType) {
      if (!ModelData.MAPPING[modelType]) {
          throw new Error(`Invalid model type: ${modelType}`);
      }
      return ModelData.MAPPING[modelType];
  }
}

module.exports = ModelData;