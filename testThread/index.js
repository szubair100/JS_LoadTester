const { createClass } = require("asteroid");
const WebSocket = require("ws");
const { Worker } = require("worker_threads");
const path = require("path");
const ora = require("ora");
const inquirer = require("inquirer");
const { MongoClient } = require("mongodb");

let file = "";
let params = [];
let numOfThreads = 0;
let segmentSize = 0;

const NS_PER_SEC = 1e9;
const workerPath = path.resolve("./testThread/worker.js");
const segments = [];
const time = [];
workers = [];

// Sends data to the worker
const loadTest = (segment, label, endPtAdd, portNum, methodCall) => {
  new Promise(async (parentResolve, parentReject) => {
    try {
      const result = new Promise((resolve, reject) => {
        const worker = new Worker(workerPath, {
          workerData: { segment, label, endPtAdd, portNum, methodCall }
        });
        worker.on("message", resolve);
        worker.on("error", reject);
        worker.on("exit", code => {
          if (code !== 0)
            reject(new Error(`Worker stopped with exit code ${code}`));
        });
      });
      const finalResult = result;
      parentResolve(finalResult);
      //console.log(result);
    } catch (error) {
      parentReject(error);
    }
  });
};

// Seperate the work to each worker available into segments
function createThreadWorker() {
  return new Promise((resolve, reject) => {
    if (!(numOfThreads == 0)) {
      for (let segIndex = 0; segIndex < numOfThreads; segIndex++) {
        const start = segIndex * segmentSize;
        const end = start + segmentSize;
        const segment = params.slice(0, 2);
        segments.push(segment);
      }
      resolve();
    } else {
      reject("Thread count is Zero");
    }
  });
}

// The method handles benchmark and execution of the thread
const benchmarkFunction = async (params, funct, label, file) => {
  const spinner = ora(`Threading ${label} ...\n`).start();
  const startTime = process.hrtime();
  await funct(
    params,
    label,
    file.configuration.endPointAddress,
    file.configuration.portNumber,
    file.configuration.methodCall
  );
  const diffTime = process.hrtime(startTime);
  const diff = (diffTime[0] * NS_PER_SEC + diffTime[1]) / 1000000;
  time.push(diff);
  workers.push({ id: label, time: `${diff} ms` });
  spinner.succeed(`${label} Result: Finished in ${diff} ms`);
};

async function saveResult(json) {
  console.log("********************************", process.env.MONGO_URL);
  try {
    const client = await MongoClient.connect(process.env.MONGO_URL);
    console.log("client", client);
    const db = client.db("");
    const loadTestResults = db.collection("loadTestResults");

    loadTestResults.insert({ times: json, creDttm: new Date() });
    client.close();
  } catch (ex) {
    console.log("----------", ex.message);
  }
}

// The Start of the program
const run = async () => {
  const runNumber = process.env.npm_config_runNumber;
  console.log("Run Number", runNumber);
  const { testFile } = await inquirer.prompt([
    {
      type: "input",
      name: "testFile",
      message: 'Select Test Case (inlcude ".json"): ',
      default: "data.json"
    }
  ]);
  file = require("../data/" + testFile);
  param = file.data;
  numOfThreads = parseInt(file.configuration.threadNum);
  segmentSize = Math.ceil(params.length / numOfThreads);

  try {
    createThreadWorker()
      .then(() => {
        for (var i = 0; i < segments.length; i++) {
          benchmarkFunction(segments[i], loadTest, `Worker ${i}`, file);
        }
      })
      .then(() => {
        //   console.log(
        //     `Average Time: ${time.reduce((acc, val) => acc + val, 0) /
        //       time.length} ms \n`
        //   );
        //   console.log(`Worker Time: ${JSON.stringify(workers, null, 2)}`);

        workers.unshift({
          id: "Average Time",
          time: `${time.reduce((acc, val) => acc + val, 0) / time.length} ms`
        });
        //   workers.unshift({
        //     "Current Date and Time": new Date().toLocaleString()
        //   });

        saveResult(workers);
        //new Promise(() => {
        //   var fs = require("fs");
        //   var fileName = testFile.split(".")[0] + "Result.json";
        //   var i = 1;

        //   //}).then(() => {
          var json = JSON.stringify(workers, null, 2);
          console.log(fileName);
          fs.writeFile("./data/" + fileName, json, "utf8", error => {
            if (error) throw error;
        //   });
      });
    // })
    //.catch(err => console.log(err));
  } catch (error) {
    console.log(error);
  }
};

run();
