#!/usr/bin/env node
// dummy sensor sending random values
// defined by environment
// TEST_SAMPLES: if set number of samples to send before terminating
// COMPONENT_TYPE: name of the component type
// COMPONENT_NAME: name of the component
// LOG_LEVEL: log level
"use strict";
const dgram = require("dgram");
const util = require("util");
const PD = require("probability-distributions");
const winston = require("winston");
const fs = require("fs");
const sensorSpecsFileName = "/etc/oisp/sensorSpecs.json";
const actuatorSpecsFileName = "/etc/oisp/actuatorSpecs.json";
const assert = require("assert").strict;
const config = require("./config.json");
const oispSdk = require("@open-iot-service-platform/oisp-sdk-js");
const api = oispSdk(config).api.rest;
const COMMAND_ALREADY_EXISTS = 1409

const username = process.env.USERNAME;
const password = process.env.PASSWORD;
const accountId = process.env.ACCOUNTID;
const deviceId = process.env.DEVICEID;

var logLevel = process.env.LOG_LEVEL;
if (logLevel === undefined) {
    logLevel = "info";
}
const logger = winston.createLogger({
    level: logLevel,
    transports: [
        new winston.transports.Console()
    ]
});

const default_port = 41234;
const default_host = "127.0.0.1";
const default_sensorSpecs = [
    {
        agents: [
            {
                port: default_port,
                host: default_host
            }
        ],
        name: "tempSensor",
        componentName: "temp",
        componentType: "temperature.v1.0",
        type: "number",
        sleep: 5000,
        sigma: 0.3,
        startValue: 20
    }
];

const default_actuatorSpecs = [
    {
        agents: [
            {
                port: default_port,
                host: default_host
            }
        ],
        name: "switchActuator",
        componentName: "switch",
        componentType: "powerswitch.v1.0",
        type: "boolean"
    }
]

const defaultListenPort = 41235;
var listenPort = defaultListenPort;
if (process.env.LISTEN_PORT) {
    listenPort = process.env.LISTEN_PORT;
}

var values = {};
var numSamples = 0;
var testSamples;

var sensorSpecs = [];
var actuatorSpecs = [];

if (fs.existsSync(sensorSpecsFileName)) {
    var jsondata = fs.readFileSync(sensorSpecsFileName);
    sensorSpecs = JSON.parse(jsondata);
    logger.info("SensorSpec found in /etc/oisp. Loaded: " +
        JSON.stringify(sensorSpecs));
} else {
    sensorSpecs = default_sensorSpecs;
    logger.info("SensorSpec NOT found in /etc/oisp. Default: " +
        JSON.stringify(sensorSpecs));
}

if (fs.existsSync(actuatorSpecsFileName)) {
    var jsondata = fs.readFileSync(actuatorSpecsFileName);
    actuatorSpecs = JSON.parse(jsondata);
    logger.info("ActuatorSpec found in /etc/oisp. Loaded: " +
        JSON.stringify(actuatorSpecs));
} else {
    actuatorSpecs = default_actuatorSpecs;
    logger.info("ActuatorSpec NOT found in /etc/oisp. Default: " +
        JSON.stringify(actuatorSpecs));
}

if (process.env.TEST_SAMPLES) {
    testSamples = process.env.TEST_SAMPLES;
} else {
    testSamples = 10;
}

const sleep = util.promisify(setTimeout);

function registerComponentToAgent(component, agent) {
    const client = dgram.createSocket("udp4");
    logger.verbose("Registering component: " + JSON.stringify(component) +
        " at url " + agent.host + ":" + agent.port);
    const compMsg = Buffer.from(JSON.stringify(component), "utf-8");
    const send = util.promisify(client.send);
    const close = util.promisify(client.close);
    return send.apply(client, [compMsg, 0, compMsg.length, agent.port, agent.host])
        .then(() => {
            return close.apply(client);
        })
        .catch(err => {
            logger.error("Error: " + err);
            return close.apply(client);
        });
}

function registerComponent(component) {
    const promises = [];
    component.agents.forEach(agent => {
        var telemetry = {
            "n": component.componentName,
            "t": component.componentType
        };
        promises.push(registerComponentToAgent(telemetry, agent));
    });
    return Promise.all(promises);
}

function registerComponents(components) {
    const promises = [];
    components.forEach(component => {
        promises.push(registerComponent(component));
    });
    return Promise.all(promises);
}

function sendObservationToAgent(data, agent) {
    const client = dgram.createSocket("udp4");
    const send = util.promisify(client.send);
    const close = util.promisify(client.close);
    const dataMsg = Buffer.from(JSON.stringify(data), "utf-8");
    return send.apply(client, [dataMsg, 0, dataMsg.length, agent.port, agent.host])
        .then(() => {
            return close.apply(client);
        })
        .catch(err => {
            logger.error("Error: " + err);
            return close.apply(client);
        });
}

function sendObservation(component, data) {
    const promises = [];
    component.agents.forEach(agent => {
        promises.push(sendObservationToAgent(data, agent));
    });
    return Promise.all(promises);
}

function sendObservations(samples, sensors) {
    if (!samples) {
        samples = testSamples;
    }
    if (!sensors) {
        sensors = sensorSpecs;
    }
    const promises = [];
    sensors.forEach(component => {
        var promise = new Promise((resolve, reject) => {
            resolve();
        });
        for (var i = 0; i < samples; i++) {
            var value = values[component.name];
            if (component.type === "string") {
                value += Math.round(Math.random() * 100000000);
            }
            var telemetry = {
                "n": component.componentName,
                "v": value
            };
            var promise = promise
                .then(() => { return sendObservation(component, telemetry) })
                .then(() => { return sleep(5000) });
            if (component.type === "number") {
                var change = PD.rnorm(1, 0, component.sigma);
                value += change[0];
                values[component.name] = value;
            }
        }
        promises.push(promise);
    });
    return Promise.all(promises);
}

function sendActuation(userToken, accountId, actuatorCid, actuatorParamName, value) {
    const sendActuation = util.promisify(api.control.sendActuationCommand);
    var data = {
        userToken: userToken,
        accountId: accountId,
        body: {
            commands: [{
                componentId: actuatorCid,
                transport: "mqtt",
                parameters: [{
                    name: actuatorParamName,
                    value: value.toString()
                }]
            }],
            complexCommands: []
        },
    };
    return sendActuation.apply(api.control, [data]);
}

function getRandomInteger(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

var receivedActuations = 0;
var userToken = null;
var sensorCid = null;
var actuatorCid = null;
const switchOffCmdName = "switch_off_command3";
const actuatorParamName = "LED";
const ruleTestSamples = 3;
const actuationValues = [true, false, false, false, true];

const client = dgram.createSocket("udp4");

client.on("error", (err) => {
    logger.error("Actuation error: " + err);
    client.close();
    process.exit(1);
})

client.on("message", (msg, rinfo) => {
    msg = JSON.parse(msg.toString("utf-8"));
    assert.strictEqual(msg.component, actuatorSpecs[0].componentName,
        "Expected actuation for: " + actuatorSpecs[0].componentName + ", but got " +
        "actuation for: " + msg.component);
    assert.strictEqual(msg.argv, actuationValues[receivedActuations],
        "Expected actuation: " + actuationValues[receivedActuations] + " but got: " +
        msg.argv + ", by index: " + receivedActuations);
    receivedActuations++;
    if (receivedActuations === actuationValues.length) {
        logger.info("Actuation test successful!");
        client.close();
        process.exit(0);
    }
});

// initialize all values
sensorSpecs.forEach(function(spec) {
    values[spec.name] = spec.startValue;
});

logger.info("Registering components...");
sleep(5000).then(() => {
    return registerComponents(sensorSpecs);
});
    logger.info("Component registration successful!");
    return sleep(5000);
}).then(() => {
    logger.info("Sending observations...");
    return sendObservations();
}).then(() => {
    logger.info("Observation sending successful!");
    if (!username || !password || !accountId) {
        logger.info("User credentials not found, skipping actuation tests...");
        process.exit(0);
    }
    logger.info("User credentials found, continuing with actuation tests...");
    return registerComponents(actuatorSpecs);
}).then(() => {
    logger.info("Test switch registratiion successful!");
    const getToken = util.promisify(api.auth.getAuthToken);
    const data = {
        body: {
            username: username,
            password: password
        }
    };
    return getToken.apply(api.auth, [data]);
}).then(response => {
    logger.info("Login with credentials...");
    userToken = response.token;
    const getDevice = util.promisify(api.devices.getDeviceDetails);
    const data = {
        userToken: userToken,
        accountId: accountId,
        deviceId: deviceId
    };
    return getDevice.apply(api.devices, [data]);
}).then(response => {
    logger.info("Received device details...");
    const sensor = response.components.find(c => {
        return c.name === sensorSpecs[0].componentName;
    });
    const actuator = response.components.find(c => {
        return c.name === actuatorSpecs[0].componentName;
    });
    sensorCid = sensor.cid;
    actuatorCid = actuator.cid;
    const createCommand = util.promisify(api.control.saveComplexCommand);
    var data = {
        userToken: userToken,
        accountId: accountId,
        commandName: switchOffCmdName,
        body: {
            commands: [{
                componentId: actuatorCid,
                transport: "mqtt",
                parameters: [{
                    name: actuatorParamName,
                    value: "0"
                }]
            }]
        },
        deviceId: deviceId
    };
    return createCommand.apply(api.control, [data]).catch(err => {
        if (JSON.parse(err).code !== COMMAND_ALREADY_EXISTS) {
            throw err;
        }
    });
}).then(() => {
    logger.info("Created power off command...");
    const createRule = util.promisify(api.rules.createRule);
    var data = {
        userToken: userToken,
        accountId: accountId,
        body: {
            name: "oisp-tests-sensor-gte-rule",
            description: "OISP testing rule",
            priority: "Medium",
            type: "Regular",
            status: "Active",
            resetType: "Automatic",
            synchronizationStatus: "NotSync",
            actions: [{
                type: "actuation",
                target: [ switchOffCmdName ]
            }],
            population: {
                ids: [deviceId],
                attributes: null,
                tags: null
            },
            conditions: {
                operator: "OR",
                values: [{
                    component: {
                        dataType: "Number",
                        name: sensorSpecs[0].componentName,
                        cid: sensorCid
                    },
                    type: "basic",
                    values: ["0"],
                    operator: ">="
                }]
            }
        }
    };
    return createRule.apply(api.rules, [data]);
}).then((response) => {
    logger.info("Created basic rule with power off command...");
    client.bind(listenPort);
    return sleep(5000);
}).then(() => {
    logger.info("Device now listening for actuations...");
    return sendActuation(userToken, accountId, actuatorCid, actuatorParamName, 1);
}).then(() => {
    logger.info("Power on actuation sent!");
    return sendObservations(ruleTestSamples, [sensorSpecs[0]]);
}).then(() => {
    logger.info("Sent data for rule triggering...");
    return sendActuation(userToken, accountId, actuatorCid, actuatorParamName, 1);
}).then(() => {
    logger.info("Power on actuation sent!");
    return sleep(45000);
}).then(() => {
    throw "Timeout in the actuation test, exiting...";
}).catch(err => {
    logger.error(err);
    process.exit(1);
});
