const { normalizeRequestedText, parseStrictOrderMessage } = require('../utils/normalization');

function createOrderService(orderRepository, settingsRepository) {
  return {
    processChatMessage(messagePayload, runtimeSettings) {
      const settings = runtimeSettings || settingsRepository.getSettings();
      const parsedOrder = parseStrictOrderMessage(messagePayload.rawMessage, settings.orderTriggerWord);

      if (!parsedOrder) {
        return null;
      }

      const normalizedOrderedText = normalizeRequestedText(parsedOrder.itemText, {
        stripEdgePunctuation: settings.stripEdgePunctuation
      });

      if (!normalizedOrderedText) {
        return null;
      }

      return orderRepository.insertOrder({
        created_at: new Date().toISOString(),
        channel_name: messagePayload.channelName || settings.channelName || settings.channelLogin,
        channel_user_id: messagePayload.channelUserId || settings.channelUserId || null,
        chatter_user_id: messagePayload.chatterUserId,
        chatter_user_login: messagePayload.chatterUserLogin,
        chatter_user_name: messagePayload.chatterUserName,
        raw_message: messagePayload.rawMessage,
        trigger_word: parsedOrder.triggerWord,
        ordered_text: parsedOrder.itemText,
        normalized_ordered_text: normalizedOrderedText,
        price_amount: parsedOrder.price,
        stream_started_at: messagePayload.streamStartedAt || null,
        stream_elapsed_seconds: Number.isFinite(messagePayload.streamElapsedSeconds)
          ? Math.max(0, Math.floor(messagePayload.streamElapsedSeconds))
          : null
      });
    }
  };
}

module.exports = {
  createOrderService
};
