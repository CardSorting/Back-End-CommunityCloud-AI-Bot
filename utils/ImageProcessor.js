const axios = require('axios');
const logger = require('../pino/status');
const sanitizeHtml = require('sanitize-html');
const ModelData = require('./ModelData');

class ImageProcessor {
  constructor(userId, prompt, modelType) {
    this.validateInputs(userId, prompt, modelType);

    this.userId = userId;
    this.prompt = this.sanitizeInput(prompt);
    this.modelType = modelType;
    this.modelName = this.getModelName();
  }

  validateInputs(userId, prompt, modelType) {
    if (!userId || typeof userId !== 'string') {
      throw new Error('UserId is required and must be a string.');
    }
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('Prompt is required and must be a string.');
    }
    if (!modelType || !ModelData.isValidModelType(modelType) && !ModelData.isValidModelName(modelType)) {
      throw new Error(`Invalid or missing modelType: ${modelType}`);
    }
  }

  sanitizeInput(input) {
    return sanitizeHtml(input);
  }

  getModelName() {
    if (ModelData.isValidModelType(this.modelType)) {
      return ModelData.MAPPING[this.modelType];
    } else if (ModelData.isValidModelName(this.modelType)) {
      return this.modelType;
    }
    throw new Error(`Invalid model type provided: ${this.modelType}`);
  }

  getJobConfiguration() {
    return {
      key: process.env['access_token'],
      model_id: this.modelName,
      prompt: this.prompt,
      negative_prompt: "",
      width: "512",
      height: "512",
      samples: "1",
      num_inference_steps: "40",
      safety_checker: "no",
      enhance_prompt: "yes",
      guidance_scale: 10,
      multi_lingual: "no",
      panorama: "no",
      self_attention: "yes",
      upscale: "no",
      embeddings_model: null,
      lora_model: null,
      tomesd: "yes",
      use_karras_sigmas: "yes",
      vae: null,
      lora_strength: null,
      scheduler: "UniPCMultistepScheduler",
      webhook: null,
      track_id: null
    };
  }

  validateAPIResponse(response) {
    if (response.status !== 200) {
      throw new Error(`Image generation API returned status code: ${response.status}`);
    }
    if (!response.data) {
      throw new Error('Unexpected response format from image generation API.');
    }
  }

  async fetchImageFromAPI() {
    try {
      const headers = {
        'Content-Type': 'application/json'
      };
      const config = this.getJobConfiguration();
      const response = await axios.post('https://stablediffusionapi.com/api/v4/dreambooth', config, { headers });
      this.validateAPIResponse(response);

      return response.data;

    } catch (error) {
      logger.error(`Failed to fetch image for user ${this.userId} from API: ${error.message}`);
      throw new Error(`Failed to fetch image from API: ${error.message}`);
    }
  }

  async waitForCompletion(requestId) {
    const poller = new JobStatusPoller(requestId);
    const finalStatus = await poller.waitForCompletion();

    if (finalStatus !== 'success') {
      throw new Error('Job failed or did not complete successfully.');
    }
  }

  async fetchQueuedImage(requestId) {
    try {
      const headers = {
        'Content-Type': 'application/json'
      };
      const data = {
        key: process.env['access_token'],
        request_id: requestId
      };
      const response = await axios.post('https://stablediffusionapi.com/api/v4/dreambooth/fetch', data, { headers });

      if (!response.data.output || response.data.output.length === 0) {
        throw new Error('No output URL found in API response.');
      }

      return response.data.output[0];

    } catch (error) {
      logger.error(`Failed to fetch queued image for requestId ${requestId}: ${error.message}`);
      throw new Error(`Failed to fetch queued image: ${error.message}`);
    }
  }

  async run() {
    try {
      const apiResponse = await this.fetchImageFromAPI();

      if (apiResponse.status === 'processing') {
        await this.waitForCompletion(apiResponse.id);
        const outputUrl = await this.fetchQueuedImage(apiResponse.id);
        return outputUrl;
      } else if (apiResponse.status === 'success') {
        if (!apiResponse.output || apiResponse.output.length === 0) {
          throw new Error('No output URL found in API response.');
        }
        return apiResponse.output[0];
      } else {
        throw new Error(`Image generation API returned status: ${apiResponse.status}`);
      }
    } catch (error) {
      logger.error(`Error in image generation for userId ${this.userId}: ${error.message}`);
      throw new Error(`Error in image generation: ${error.message}`);
    }
  }
}

module.exports = ImageProcessor;