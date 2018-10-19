const { Worker, parentPort, workerData } = require("worker_threads");
const { createClass } = require("asteroid");
const WebSocket = require("ws");

//const Asteroid = createClass();

const Asteroid = createClass();
// Connect to a Meteor backend
const asteroid = new Asteroid({
  endpoint:
    "ws://" + workerData.endPtAdd + ":" + workerData.portNum + "/websocket",
  SocketConstructor: WebSocket
});

workerData.segment.forEach((element, i) => {
  element.email = new Date().getTime() + "@Test.jlsdk";
  element.username = "load" + new Date().getTime() + "@Test.jlsdk";
  asteroid
    .call(workerData.methodCall, element)
    .then(result => {
      console.log(workerData.label + " element " + i + ": Success");
      console.log(workerData.label + " element " + i + ": Result", result);
      parentPort.postMessage(result);
    })
    .catch((error, result) => {
      console.log(workerData.label + " element " + i + ": Error", error);
      parentPort.postMessage(error);
    });
});
