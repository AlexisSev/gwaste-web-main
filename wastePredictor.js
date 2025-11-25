// wastePredictor.js
const tf = require('@tensorflow/tfjs-node');

/**
 * ===============================
 * 1. CREATE THE MODEL
 * ===============================
 */
function createModel() {
  const model = tf.sequential();
  model.add(tf.layers.dense({ inputShape: [3], units: 10, activation: 'relu' }));
  model.add(tf.layers.dense({ units: 8, activation: 'relu' }));
  model.add(tf.layers.dense({ units: 1 })); // output: predicted volume (kg)

  model.compile({
    optimizer: tf.train.adam(0.01),
    loss: 'meanSquaredError'
  });

  return model;
}

/**
 * ===============================
 * 2. TRAINING FUNCTION
 * ===============================
 * x = [population, isRaining, hasEvent]
 * y = waste volume (kg)
 */
async function trainModel(model) {

  // Dummy training data – replace with your database values later
  const trainingData = [
    { x: [2000, 0, 0], y: 1200 },
    { x: [2500, 1, 0], y: 1600 },
    { x: [3000, 0, 1], y: 2200 },
    { x: [2200, 0, 1], y: 1500 },
    { x: [3500, 1, 1], y: 2800 },
    { x: [1800, 0, 0], y: 900 },
  ];

  const xs = tf.tensor(trainingData.map(d => d.x));
  const ys = tf.tensor(trainingData.map(d => d.y));

  console.log("Training model, please wait...");

  await model.fit(xs, ys, {
    epochs: 120,
    shuffle: true,
    validationSplit: 0.2
  });

  console.log("Model training complete!");
  
  // Save the model
  await model.save('file://./waste-model');
  console.log("Model saved to /waste-model");
}

/**
 * ===============================
 * 3. PREDICT FUNCTION
 * ===============================
 */
async function predictWaste(population, isRaining, hasEvent) {
  const model = await tf.loadLayersModel('file://./waste-model/model.json');

  const input = tf.tensor([[population, isRaining, hasEvent]]);
  const output = model.predict(input);
  const predictedValue = output.dataSync()[0];

  return predictedValue; // in kg
}

module.exports = { createModel, trainModel, predictWaste };
