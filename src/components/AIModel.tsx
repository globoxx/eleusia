import * as tf from '@tensorflow/tfjs';

const MOBILE_NET_INPUT_WIDTH = 224;
const MOBILE_NET_INPUT_HEIGHT = 224;
const CLASS_NAMES = ["Refused", "Accepted"]; // Put your class names here

export type ImageElement = HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | ImageData;

const MyModel = {
  featureExtractor: null as tf.GraphModel | null,
  model: null as tf.Sequential | null,

  loadFeatureExtractor: async () => {
    const URL = 'https://www.kaggle.com/models/google/mobilenet-v3/TfJs/small-100-224-feature-vector/1';
    MyModel.featureExtractor = await tf.loadGraphModel(URL, {fromTFHub: true});

    // Warm up the model by passing zeros through it once.
    tf.tidy(function () {
      MyModel.featureExtractor.predict(tf.zeros([1, MOBILE_NET_INPUT_HEIGHT, MOBILE_NET_INPUT_WIDTH, 3]));
    });

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
    return tf.tidy(() => {
      let tensor = tf.browser.fromPixels(image)
        .resizeBilinear([MOBILE_NET_INPUT_HEIGHT, MOBILE_NET_INPUT_WIDTH], true)
        .div(255.0)
        .expandDims();
      if (MyModel.featureExtractor) {
        return (MyModel.featureExtractor.predict(tensor) as tf.Tensor).squeeze();
      }
      throw new Error("Feature extractor not loaded");
    });
  },

  trainModel: async (images: ImageElement[], labels: number[]) => {
    return new Promise<void>(async (resolve, reject) => {
      let xs, ys
      try {
        xs = tf.stack(images.map(image => MyModel.preprocessImage(image)));
        ys = tf.oneHot(tf.tensor1d(labels, 'int32'), CLASS_NAMES.length);
        if (MyModel.model) {
          await MyModel.model.fit(xs, ys, {
            epochs: 10,
            batchSize: 5,
            shuffle: true
          });
          console.log('Model trained');
          resolve();
        } else {
          reject(new Error("Model not loaded"));
        }
      } catch(error) {
        reject(error);
      } finally {
        if (xs) xs.dispose();
        if (ys) ys.dispose();
      }
    });
  },

  predictImage: (image: ImageElement) => {
    return new Promise<Uint8Array | Float32Array | Int32Array>((resolve, reject) => {
      let imageFeatures
      try {
        imageFeatures = MyModel.preprocessImage(image);
        if (MyModel.model) {
          const predictionLabel = (MyModel.model.predict(imageFeatures.expandDims()) as tf.Tensor).squeeze().dataSync();
          resolve(predictionLabel);
        } else {
          reject(new Error("Model not loaded"));
        }
      } catch(error) {
        reject(error);
      } finally {
        if (imageFeatures) imageFeatures.dispose();
      }
    });
  },
};

export default MyModel;