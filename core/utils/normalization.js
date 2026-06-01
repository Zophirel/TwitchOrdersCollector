function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeRequestedText(value, options = {}) {
  const shouldStripEdgePunctuation = options.stripEdgePunctuation !== false;
  let normalized = String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

  if (shouldStripEdgePunctuation) {
    normalized = normalized.replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, '');
  }

  return normalized;
}

function parseStrictRequestMessage(rawMessage, triggerWord) {
  const safeTriggerWord = String(triggerWord || '').trim();
  const raw = String(rawMessage || '');

  if (!safeTriggerWord) {
    return null;
  }

  const expression = new RegExp(`^${escapeRegExp(safeTriggerWord)}\\s+(.+)$`, 'u');
  const match = raw.match(expression);

  if (!match) {
    return null;
  }

  const requestedText = match[1].trim();
  if (!requestedText) {
    return null;
  }

  return {
    triggerWord: safeTriggerWord,
    requestedText
  };
}

function parseStrictOrderMessage(rawMessage, triggerWord) {
  const safeTriggerWord = String(triggerWord || '').trim();
  const raw = String(rawMessage || '');

  if (!safeTriggerWord) {
    return null;
  }

  const expression = new RegExp(`^${escapeRegExp(safeTriggerWord)}\\s+(.+?)\\s+(-?\\d+(?:[.,]\\d{1,2})?)$`, 'u');
  const match = raw.match(expression);

  if (!match) {
    return null;
  }

  const itemText = match[1].trim();
  const priceRaw = match[2].trim();
  const price = Number(priceRaw.replace(',', '.'));

  if (!itemText || !Number.isFinite(price) || price < 0) {
    return null;
  }

  return {
    triggerWord: safeTriggerWord,
    itemText,
    price,
    priceRaw
  };
}

module.exports = {
  normalizeRequestedText,
  parseStrictRequestMessage,
  parseStrictOrderMessage
};
