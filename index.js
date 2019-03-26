/* eslint-disable camelcase */
const debug = require('debug')('hookhub:hook:slack-webhook-out')
debug('Loading hookhub:hook:slack-webhook-out')

const express = require('express')
const router = express.Router()
const smb = require('slack-message-builder')
const rp = require('request-promise')

var config = null

/* Default handler. */
router.use('/', function (req, res, next) {
  if (!config) { throw new Error('Missing configuration') }

  if (!res.hookhub.doc) { throw new Error('Missing hookhub.doc') }

  debug('Handling request')

  let post_body = generateMessage(res.hookhub.doc)

  var post_options = {
    method: 'POST',
    uri: config.credentials.url,
    body: post_body,
    json: true // Automatically stringifies the body to JSON
  }

  rp(post_options).then(function (data) {
    return {
      result: 'OK',
      message: data
    }
  }).catch(function (err) {
    return {
      result: 'ERROR',
      message: err
    }
  }).then(function (result_set) {
    res.send(result_set)
  })
})

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

module.exports = router
module.exports.configurable = true
module.exports.config = config
