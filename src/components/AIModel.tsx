import * as tf from '@tensorflow/tfjs';

const CLASS_NAMES = ["Refused", "Accepted"]; // Put your class names here

export type ImageElement = HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | ImageData;

const MyModel = {
  featureExtractor: null as tf.GraphModel | null,
  model: null as tf.Sequential | null,

  loadFeatureExtractor: async () => {
    const URL = 'https://tfhub.dev/google/tfjs-model/imagenet/mobilenet_v3_small_100_224/feature_vector/5/default/1';
    MyModel.featureExtractor = await tf.loadGraphModel(URL, {fromTFHub: true});
    console.log('Feature extractor loaded');
  },

  loadModel: () => {
    MyModel.model = tf.sequential();
    MyModel.model.add(tf.layers.dense({inputShape: [1024], units: 128, activation: 'relu'}));
    MyModel.model.add(tf.layers.dense({units: CLASS_NAMES.length, activation: 'softmax'}));
    MyModel.model.compile({
      optimizer: 'adam',
      loss: CLASS_NAMES.length === 2 ? 'binaryCrossentropy' : 'categoricalCrossentropy',
      metrics: ['accuracy']
    });
    console.log('Model loaded');
  },

  resetModel: () => {
    MyModel.loadModel();
  },

  preprocessImage: (image: ImageElement) => {
    let tensor = tf.browser.fromPixels(image)
      .resizeBilinear([224, 224])
      .div(255.0)
      .expandDims();
    if (MyModel.featureExtractor) {
      return (MyModel.featureExtractor.predict(tensor) as tf.Tensor).squeeze();
    }
    throw new Error("Feature extractor not loaded");
  },

  trainModel: async (images: ImageElement[], labels: number[]) => {
    const xs = tf.stack(images.map(image => MyModel.preprocessImage(image)));
    const ys = tf.oneHot(tf.tensor1d(labels, 'int32'), CLASS_NAMES.length);
    if (MyModel.model) {
      await MyModel.model.fit(xs, ys, {
        epochs: 10,
        shuffle: true
      });
      xs.dispose();
      ys.dispose();
      console.log('Model trained');
    } else {
      throw new Error("Model not loaded");
    }
  },

  predictImage: (image: ImageElement) => {
    const imageFeatures = MyModel.preprocessImage(image);
    if (MyModel.model) {
      const predictionLabel = (MyModel.model.predict(imageFeatures.expandDims()) as tf.Tensor).squeeze().argMax().dataSync()[0];
      imageFeatures.dispose();
      return predictionLabel;
    }
    throw new Error("Model not loaded");
  },
};

export default MyModel;