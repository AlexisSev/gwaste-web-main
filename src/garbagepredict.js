import * as tf from '@tensorflow/tfjs';

// Hash UUID/string to number
export function hashToNumber(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash % 1000);
}

// Normalize function
export function normalize(value, min, max) {
  return (value - min) / (max - min);
}

// Train and predict model
export async function trainAndPredict(data) {
  if (!data || !data.length) return null;

  // Prepare data
  const routeIds = data.map(d => hashToNumber(d.route_id));
  const wasteTypes = data.map(d => hashToNumber(d.waste_type));
  const collectionDurations = data.map(d => d.collection_duration);

  const minRoute = Math.min(...routeIds);
  const maxRoute = Math.max(...routeIds);
  const minWaste = Math.min(...wasteTypes);
  const maxWaste = Math.max(...wasteTypes);

  const xs = tf.tensor2d(
    data.map(d => [
      normalize(hashToNumber(d.route_id), minRoute, maxRoute),
      normalize(hashToNumber(d.waste_type), minWaste, maxWaste),
    ])
  );

  const ys = tf.tensor2d(collectionDurations.map(d => [d]));

  // Define model
  const model = tf.sequential();
  model.add(tf.layers.dense({ inputShape: [2], units: 32, activation: 'relu' }));
  model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
  model.add(tf.layers.dense({ units: 1 }));

  model.compile({ optimizer: 'adam', loss: 'meanSquaredError' });

  // Train
  await model.fit(xs, ys, { epochs: 100 });

  // Example: predict for first route
  const predTensor = model.predict(
    tf.tensor2d([[normalize(routeIds[0], minRoute, maxRoute), normalize(wasteTypes[0], minWaste, maxWaste)]])
  );

  const predValue = Math.max(predTensor.dataSync()[0], 0); // hours
  return predValue;
}
