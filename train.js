// train.js
const { createModel, trainModel } = require("./wastePredictor");

async function run() {
  const model = createModel();
  await trainModel(model);
}

run();
