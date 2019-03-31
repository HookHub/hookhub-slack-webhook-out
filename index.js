/* eslint-disable camelcase */
const debug = require('debug')('hookhub:hook:slack-webhook-out')
debug('Loading hookhub:hook:slack-webhook-out')

const express = require('express')
const router = express.Router()
const smb = require('slack-message-builder')
const rp = require('request-promise')

var config = null
var configurable = function (newConfig) {
  config = newConfig
}

// Functions
function stackRegistration (req, res, next) {
  res.locals.hookhub.stack.push('hookhub-slack-webhook-out')
  next()
}

function defaultHandler (req, res, next) {
  debug('Handling request')

  if (!config) {
    throw new Error('Missing configuration')
  }

  if (!res.locals.hookhub.doc) {
    throw new Error('Missing hookhub.doc')
  }

  if (res.locals.hookhub.result.result !== 'OK') {
    throw new Error('Broken flow')
  }

  let post_body = generateMessage(res.locals.hookhub.doc)

  var post_options = {
    method: 'POST',
    uri: config.credentials.url,
    body: post_body,
    json: true // Automatically stringifies the body to JSON
  }

  rp(post_options).then(function (data) {
    res.locals.hookhub.result = {
      result: 'OK',
      message: data
    }
    next()
  }).catch(function (err) {
    res.locals.hookhub.result = {
      result: 'ERROR',
      message: err
    }
    next('error')
  })
}

var generateMessage = function (hookhub_doc) {
  var slack_message = smb()
    .username(config.options.username)
    .iconEmoji(config.options.icon_emoji)
    .channel(config.options.channel)

  switch (hookhub_doc.type) {
    case 'push':
      hookhub_doc.messages.forEach(function (commit) {
        slack_message = slack_message
          .text("The following commit(s) got pushed to '" + hookhub_doc.topic + "':\r\r")
          .attachment()
          .fallback(commit.message)
          .color('#0000cc')
          .authorName(hookhub_doc.author.name)
          .authorLink(hookhub_doc.author.url)
          .authorIcon(hookhub_doc.author.avatar)
          .title('Commit: ' + commit.title)
          .titleLink(commit.url)
          .text(commit.message)
          .footer('Via: hookhub:hook:slack-webhook-out')
          .ts(Math.round(Date.parse(commit.timestamp) / 1000))
          .end()
      })
      break
    default:
      slack_message = slack_message.text("We received a new '" + hookhub_doc.type + "' notification for '" + hookhub_doc.topic + "', but we didn't know what to do with this event!")
      break
  }

  return slack_message.json()
}

// Routes
router.all('/', stackRegistration, defaultHandler)

module.exports = router
module.exports.configurable = configurable
