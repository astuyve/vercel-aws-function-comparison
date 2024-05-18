'use strict';
const axios = require('axios');

const { createMetricsLogger, Unit, StorageResolution } = require("aws-embedded-metrics");

const urls = {
  aws: process.env.COLD_START_LAMBDA,
  vercel: process.env.COLD_START_VERCEL,
  vercel_old_runtime: process.env.COLD_START_VERCEL_OLD_RUNTIME,
  lwa: process.env.COLD_START_LWA,
  hono: process.env.COLD_START_HONO,
  serverless_http: process.env.COLD_START_SERVERLESS_HTTP,
}

const invokeFunction = async (name, url) => {
  const start = Date.now()
  const res = await axios(url)
  const finished = Date.now()
  let requestToHandlerMs
  const { handlerRunTime, coldStartResult, processUptime } = res.data
  requestToHandlerMs = handlerRunTime - start

  const rtt = finished - start
  return {
    name,
    coldStartResult,
    processUptime,
    requestToHandlerMs: requestToHandlerMs,
    roundTripInvokeMs: rtt
  }
}
module.exports.benchmark = async (event) => {
  const metrics = createMetricsLogger();
  const results = await Promise.all(Object.entries(urls).map(async ([name, url]) => {
    return await invokeFunction(name, url)
  }))
  results.map((res) => {
    if (res.coldStartResult && res.processUptime <= 1.0) {
      metrics.putMetric(`${res.name}-latency`, res.roundTripInvokeMs, Unit.Milliseconds, StorageResolution.Standard);
    } else {
    console.log('probably not a cold start: ', res)
    }
  })
  await metrics.flush()
  return true
};
