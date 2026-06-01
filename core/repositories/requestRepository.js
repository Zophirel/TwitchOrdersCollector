const { buildPopularityGroups } = require('../utils/popularityGrouping');

function toDemotionMap(popularityDemotions = {}) {
  return Object.entries(popularityDemotions || {}).reduce((accumulator, [key, value]) => {
    const normalizedKey = String(key || '').trim();
    const numericValue = Number(value || 0);

    if (normalizedKey && Number.isFinite(numericValue) && numericValue > 0) {
      accumulator[normalizedKey] = numericValue;
    }

    return accumulator;
  }, {});
}

function withEffectiveScores(items, popularityDemotions = {}) {
  const demotionMap = toDemotionMap(popularityDemotions);

  return items.map((item) => {
    const normalizedText = String(item.normalized_requested_text || '').trim();
    const requestCount = Number(item.request_count || 0);
    const demotionCount = Number(demotionMap[normalizedText] || 0);

    return {
      ...item,
      request_count: requestCount,
      demotion_count: demotionCount,
      effective_request_count: requestCount - demotionCount
    };
  });
}

function sortAggregatedItems(items) {
  return [...items].sort((left, right) => {
    if (right.effective_request_count !== left.effective_request_count) {
      return right.effective_request_count - left.effective_request_count;
    }

    if (right.request_count !== left.request_count) {
      return right.request_count - left.request_count;
    }

    if ((right.latest_request_at || '') !== (left.latest_request_at || '')) {
      return String(right.latest_request_at || '').localeCompare(String(left.latest_request_at || '')) * -1;
    }

    return String(left.normalized_requested_text || '').localeCompare(String(right.normalized_requested_text || ''));
  });
}

function createRequestRepository(database) {
  return {
    insertRequest(requestRecord) {
      database.run(
        `
          INSERT INTO requests (
            created_at,
            channel_name,
            channel_user_id,
            chatter_user_id,
            chatter_user_login,
            chatter_user_name,
            raw_message,
            trigger_word,
            requested_text,
            normalized_requested_text
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          requestRecord.created_at,
          requestRecord.channel_name,
          requestRecord.channel_user_id,
          requestRecord.chatter_user_id,
          requestRecord.chatter_user_login,
          requestRecord.chatter_user_name,
          requestRecord.raw_message,
          requestRecord.trigger_word,
          requestRecord.requested_text,
          requestRecord.normalized_requested_text
        ]
      );
      return database.get('SELECT * FROM requests ORDER BY id DESC LIMIT 1');
    },
    listRecentRequests(filters = {}) {
      const conditions = [];
      const parameters = [];

      if (filters.userId) {
        conditions.push('chatter_user_id = ?');
        parameters.push(filters.userId);
      }

      if (filters.itemText) {
        conditions.push('normalized_requested_text LIKE ?');
        parameters.push(`%${filters.itemText.toLowerCase()}%`);
      }

      const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      return database.all(`
        SELECT *
        FROM requests
        ${whereClause}
        ORDER BY datetime(created_at) DESC
        LIMIT 200
      `, parameters);
    },
    listTopRequestedItems(limit = 10, popularityDemotions = {}) {
      const aggregatedItems = database.all(`
        SELECT
          normalized_requested_text,
          COUNT(*) AS request_count,
          MAX(created_at) AS latest_request_at
        FROM requests
        GROUP BY normalized_requested_text
      `);

      return sortAggregatedItems(withEffectiveScores(aggregatedItems, popularityDemotions))
        .slice(0, limit);
    },
    listPopularityGroups(limit = 200, popularityDemotions = {}, popularityGroupTailOrder = []) {
      const aggregatedItems = database.all(`
        SELECT
          normalized_requested_text,
          COUNT(*) AS request_count,
          MAX(created_at) AS latest_request_at
        FROM requests
        GROUP BY normalized_requested_text
      `);

      return buildPopularityGroups(
        sortAggregatedItems(withEffectiveScores(aggregatedItems, popularityDemotions)).slice(0, limit),
        popularityGroupTailOrder
      );
    },
    listUsers() {
      return database.all(`
        SELECT
          chatter_user_id,
          chatter_user_login,
          chatter_user_name,
          COUNT(*) AS request_count,
          MAX(created_at) AS latest_request_at
        FROM requests
        GROUP BY chatter_user_id, chatter_user_login, chatter_user_name
        ORDER BY request_count DESC, latest_request_at DESC
      `);
    },
    listRequestsByUser(chatterUserId) {
      return database.all(`
        SELECT *
        FROM requests
        WHERE chatter_user_id = ?
        ORDER BY datetime(created_at) DESC
      `, [chatterUserId]);
    },
    listRequestsByItem(normalizedItem) {
      return database.all(`
        SELECT *
        FROM requests
        WHERE normalized_requested_text = ?
        ORDER BY datetime(created_at) DESC
      `, [normalizedItem]);
    },
    getStatsSummary() {
      return database.get(`
        SELECT
          COUNT(*) AS total_requests,
          COUNT(DISTINCT normalized_requested_text) AS unique_items,
          COUNT(DISTINCT chatter_user_id) AS unique_chatters
        FROM requests
      `);
    }
  };
}

module.exports = {
  createRequestRepository
};
