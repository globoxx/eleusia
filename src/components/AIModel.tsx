import * as tf from '@tensorflow/tfjs';

const MOBILE_NET_INPUT_WIDTH = 224;
const MOBILE_NET_INPUT_HEIGHT = 224;
const CLASS_NAMES = ['Refused', 'Accepted'];

export type ImageElement = HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | ImageData;

const MyModel = {
  featureExtractor: null as tf.GraphModel | null,
  model: null as tf.Sequential | null,
  featureCache: new Map<string, tf.Tensor>(),

  loadFeatureExtractor: async () => {
    if (MyModel.featureExtractor) return;

    const URL = 'https://www.kaggle.com/models/google/mobilenet-v3/TfJs/small-100-224-feature-vector/1';
    MyModel.featureExtractor = await tf.loadGraphModel(URL, { fromTFHub: true });

    const extractor = MyModel.featureExtractor;
    tf.tidy(() => {
      extractor.predict(tf.zeros([1, MOBILE_NET_INPUT_HEIGHT, MOBILE_NET_INPUT_WIDTH, 3]));
    });
  },

  loadModel: () => {
    MyModel.model?.dispose();
    MyModel.model = tf.sequential();
    MyModel.model.add(tf.layers.dense({ inputShape: [1024], units: 128, activation: 'relu' }));
    MyModel.model.add(tf.layers.dense({ units: CLASS_NAMES.length, activation: 'softmax' }));
    MyModel.model.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy'],
    });
  },

  resetModel: () => {
    MyModel.loadModel();
  },

  clearFeatureCache: () => {
    for (const tensor of MyModel.featureCache.values()) {
      tensor.dispose();
    }
    MyModel.featureCache.clear();
  },

  dispose: () => {
    MyModel.clearFeatureCache();
    MyModel.model?.dispose();
    MyModel.model = null;
  },

  preprocessImage: (image: ImageElement) => {
    const extractor = MyModel.featureExtractor;
    if (!extractor) {
      throw new Error('Feature extractor not loaded');
    }

    return tf.tidy(() => {
      const tensor = tf.browser
        .fromPixels(image)
        .resizeBilinear([MOBILE_NET_INPUT_HEIGHT, MOBILE_NET_INPUT_WIDTH], true)
        .div(255.0)
        .expandDims();

      return (extractor.predict(tensor) as tf.Tensor).squeeze();
    });
  },

  getImageFeatures: (imageUrl: string, image: ImageElement) => {
    const cachedFeatures = MyModel.featureCache.get(imageUrl);
    if (cachedFeatures) return cachedFeatures;

    const features = MyModel.preprocessImage(image);
    MyModel.featureCache.set(imageUrl, features);
    return features;
  },

  trainModel: async (examples: { imageUrl: string; image: ImageElement }[], labels: number[]) => {
    const model = MyModel.model;
    if (!model) {
      throw new Error('Model not loaded');
    }

    let xs: tf.Tensor | null = null;
    let ys: tf.Tensor | null = null;
    let labelsTensor: tf.Tensor1D | null = null;

    try {
      const features = examples.map(({ imageUrl, image }) => MyModel.getImageFeatures(imageUrl, image));
      xs = tf.stack(features);
      labelsTensor = tf.tensor1d(labels, 'int32');
      ys = tf.oneHot(labelsTensor, CLASS_NAMES.length);
      await model.fit(xs, ys, {
        epochs: 10,
        batchSize: 5,
        shuffle: true,
      });
    } finally {
      xs?.dispose();
      ys?.dispose();
      labelsTensor?.dispose();
    }
  },

  predictImage: async (image: ImageElement, imageUrl?: string) => {
    const model = MyModel.model;
    if (!model) {
      throw new Error('Model not loaded');
    }

    let imageFeatures: tf.Tensor | null = null;
    let expandedFeatures: tf.Tensor | null = null;
    let prediction: tf.Tensor | null = null;

    try {
      imageFeatures = imageUrl ? MyModel.getImageFeatures(imageUrl, image) : MyModel.preprocessImage(image);
      expandedFeatures = imageFeatures.expandDims();
      prediction = (model.predict(expandedFeatures) as tf.Tensor).squeeze();
      return Array.from(await prediction.data());
    } finally {
      if (!imageUrl) imageFeatures?.dispose();
      expandedFeatures?.dispose();
      prediction?.dispose();
    }
  },
};

export default MyModel;
