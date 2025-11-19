'use strict'
require('dotenv').config()
const { merge } = require('webpack-merge')
const prodEnv = require('./prod.env')

module.exports = merge(prodEnv, {
  NODE_ENV: '"development"',
  VUE_APP_CESIUM_TOKEN: JSON.stringify(process.env.VUE_APP_CESIUM_TOKEN || ''),
  VUE_APP_BACKEND_URL: JSON.stringify(process.env.VUE_APP_BACKEND_URL || 'http://localhost:8000')
})