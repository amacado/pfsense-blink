const async  = require('async');
const https  = require('https');
const axios  = require('axios').default;
const Blink1 = require('node-blink1');
const env    = require('dotenv').config()
const log    = require('npmlog')

// setup date string for logging https://github.com/npm/npmlog/issues/33#issuecomment-342785666
Object.defineProperty(log, 'heading', { get: () => { return new Date().toISOString() } })
log.headingStyle = { bg: '', fg: 'white' }

const temperatureThresholds = {
    50: {r: 36, g: 189, b: 46}, // green
    60: {r: 246, g: 225, b: 36}, // yellow
    70: {r: 188, g: 19, b: 19}, // red
}

if (env.error) {
    throw env.error
}

const pfSenseApiBaseUrl       = env.parsed.PFSENSE_API_BASE_URL;
const credentialsClientId     = env.parsed.PFSENSE_API_CLIENT;
const credentialsClientSecret = env.parsed.PFSENSE_API_TOKEN;
const checkStatusInterval     = env.parsed.CHECK_STATUS_INTERVAL;

const apiClientInstance = axios.create(
    {
        baseURL: pfSenseApiBaseUrl,
        timeout: 1000,
        httpsAgent: new https.Agent(
            {
                rejectUnauthorized: false // allow self sign certificates
            })
    });

apiClientInstance.interceptors.request.use(function (config) {
    config.headers.Authorization = credentialsClientId + ' ' + credentialsClientSecret;
    return config;
}, function (error) {
    // Do something with request error
    return Promise.reject(error);
});


function apiRequestTemperature() {
    apiClientInstance.get('/api/v1/status/system')
        .then(function (response) {
            // handle success
            let measuredTemperature     = response.data.data.temp_c;
            let maximumReachedThreshold = null;
            for (let threshold in temperatureThresholds) {
                if (measuredTemperature >= threshold) {
                    maximumReachedThreshold = threshold;
                }
            }

            log.http('','Fetched temperature %d matches threshold >= %d', measuredTemperature, maximumReachedThreshold);
            blink1.fadeToRGB(1000, temperatureThresholds[maximumReachedThreshold].r, temperatureThresholds[maximumReachedThreshold].g, temperatureThresholds[maximumReachedThreshold].b);

        })
        .catch(function (error) {
            // handle error
            flashError();
            log.error(error);

        })
        .then(function () {
            // always executed
        });
}

function flashError() {
    blink1.writePatternLine(200, 255, 0, 0, 0);
    blink1.writePatternLine(200, 0, 0, 0, 1);
    blink1.playLoop(0, 1, 3);
}

const blink1Devices = Blink1.devices();
log.info('', 'Found blink1 devices %j serials', blink1Devices);

const blink1DeviceSerial = blink1Devices[0];
log.info('', 'Using blink1 device with serial %s', blink1DeviceSerial);

var blink1 = new Blink1(blink1DeviceSerial);


setInterval(() => {
    apiRequestTemperature();
}, checkStatusInterval)

