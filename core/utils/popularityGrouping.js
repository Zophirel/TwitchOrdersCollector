function splitWords(value) {
  return String(value || '').trim().split(/\s+/).filter(Boolean);
}

function buildPrefixSupportMap(itemTexts) {
  const supportMap = new Map();

  itemTexts.forEach((itemText) => {
    const words = splitWords(itemText);
    for (let index = 1; index < words.length; index += 1) {
      const prefix = words.slice(0, index).join(' ');
      if (!supportMap.has(prefix)) {
        supportMap.set(prefix, new Set());
      }

      supportMap.get(prefix).add(itemText);
    }
  });

  return supportMap;
}

function chooseGroupKey(itemText, exactTextSet, prefixSupportMap) {
  const words = splitWords(itemText);
  if (words.length <= 1) {
    return itemText;
  }

  let best = null;

  for (let index = 1; index < words.length; index += 1) {
    const prefix = words.slice(0, index).join(' ');
    const supportedItems = prefixSupportMap.get(prefix);
    const supportCount = supportedItems ? supportedItems.size : 0;
    const hasExactPrefixRequest = exactTextSet.has(prefix);

    if (!hasExactPrefixRequest && supportCount < 2) {
      continue;
    }

    const score = (hasExactPrefixRequest ? 1000 : 0) + (supportCount * 10) + index;
    if (!best || score > best.score) {
      best = {
        key: prefix,
        score
      };
    }
  }

  return best ? best.key : itemText;
}

function buildPopularityGroups(aggregatedItems, popularityGroupTailOrder = []) {
  const normalizedItems = aggregatedItems
    .map((item) => String(item.normalized_requested_text || '').trim())
    .filter(Boolean);
  const exactTextSet = new Set(normalizedItems);
  const prefixSupportMap = buildPrefixSupportMap(normalizedItems);
  const groups = new Map();
  const tailOrder = Array.isArray(popularityGroupTailOrder)
    ? popularityGroupTailOrder.map((value) => String(value || '').trim()).filter(Boolean)
    : [];
  const tailIndexMap = new Map(tailOrder.map((key, index) => [key, index]));

  aggregatedItems.forEach((item) => {
    const normalizedText = String(item.normalized_requested_text || '').trim();
    const requestCount = Number(item.request_count || 0);
    const effectiveRequestCount = Number(item.effective_request_count || requestCount || 0);
    const latestRequestAt = item.latest_request_at || null;
    const groupKey = chooseGroupKey(normalizedText, exactTextSet, prefixSupportMap);
    const suffix = normalizedText === groupKey ? '' : normalizedText.slice(groupKey.length).trim();

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        key: groupKey,
        label: groupKey,
        totalRequestCount: 0,
        effectiveRequestCount: 0,
        directRequestCount: 0,
        latestRequestAt,
        items: []
      });
    }

    const group = groups.get(groupKey);
    group.totalRequestCount += requestCount;
    group.effectiveRequestCount += effectiveRequestCount;
    if (!group.latestRequestAt || (latestRequestAt && latestRequestAt > group.latestRequestAt)) {
      group.latestRequestAt = latestRequestAt;
    }

    if (!suffix) {
      group.directRequestCount += requestCount;
    }

    group.items.push({
      normalizedText,
      label: suffix || groupKey,
      isDirect: !suffix,
      requestCount,
      effectiveRequestCount,
      latestRequestAt
    });
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      items: group.items.sort((left, right) => {
        if (left.isDirect !== right.isDirect) {
          return left.isDirect ? -1 : 1;
        }

        if (right.effectiveRequestCount !== left.effectiveRequestCount) {
          return right.effectiveRequestCount - left.effectiveRequestCount;
        }

        if (right.requestCount !== left.requestCount) {
          return right.requestCount - left.requestCount;
        }

        return left.label.localeCompare(right.label);
      })
    }))
    .sort((left, right) => {
      const leftTailIndex = tailIndexMap.has(left.key) ? tailIndexMap.get(left.key) : -1;
      const rightTailIndex = tailIndexMap.has(right.key) ? tailIndexMap.get(right.key) : -1;

      if (leftTailIndex !== rightTailIndex) {
        if (leftTailIndex === -1) {
          return -1;
        }

        if (rightTailIndex === -1) {
          return 1;
        }

        return leftTailIndex - rightTailIndex;
      }

      if (right.effectiveRequestCount !== left.effectiveRequestCount) {
        return right.effectiveRequestCount - left.effectiveRequestCount;
      }

      if (right.totalRequestCount !== left.totalRequestCount) {
        return right.totalRequestCount - left.totalRequestCount;
      }

      return left.label.localeCompare(right.label);
    });
}

module.exports = {
  buildPopularityGroups
};
