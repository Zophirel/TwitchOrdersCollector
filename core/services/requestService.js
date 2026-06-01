const { normalizeRequestedText, parseStrictRequestMessage } = require('../utils/normalization');

function createRequestService(requestRepository, settingsRepository) {
  return {
    processChatMessage(messagePayload, runtimeSettings) {
      const settings = runtimeSettings || settingsRepository.getSettings();
      const parsedRequest = parseStrictRequestMessage(messagePayload.rawMessage, settings.triggerWord);

      if (!parsedRequest) {
        return null;
      }

      const normalizedRequestedText = normalizeRequestedText(parsedRequest.requestedText, {
        stripEdgePunctuation: settings.stripEdgePunctuation
      });

      if (!normalizedRequestedText) {
        return null;
      }

      return requestRepository.insertRequest({
        created_at: new Date().toISOString(),
        channel_name: messagePayload.channelName || settings.channelName || settings.channelLogin,
        channel_user_id: messagePayload.channelUserId || settings.channelUserId || null,
        chatter_user_id: messagePayload.chatterUserId,
        chatter_user_login: messagePayload.chatterUserLogin,
        chatter_user_name: messagePayload.chatterUserName,
        raw_message: messagePayload.rawMessage,
        trigger_word: parsedRequest.triggerWord,
        requested_text: parsedRequest.requestedText,
        normalized_requested_text: normalizedRequestedText
      });
    }
  };
}

module.exports = {
  createRequestService
};
