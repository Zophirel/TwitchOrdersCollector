function createOrderRepository(database) {
  return {
    insertOrder(orderRecord) {
      database.run(
        `
          INSERT INTO orders (
            created_at,
            channel_name,
            channel_user_id,
            chatter_user_id,
            chatter_user_login,
            chatter_user_name,
            raw_message,
            trigger_word,
            ordered_text,
            normalized_ordered_text,
            price_amount,
            stream_started_at,
            stream_elapsed_seconds
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          orderRecord.created_at,
          orderRecord.channel_name,
          orderRecord.channel_user_id,
          orderRecord.chatter_user_id,
          orderRecord.chatter_user_login,
          orderRecord.chatter_user_name,
          orderRecord.raw_message,
          orderRecord.trigger_word,
          orderRecord.ordered_text,
          orderRecord.normalized_ordered_text,
          orderRecord.price_amount,
          orderRecord.stream_started_at,
          orderRecord.stream_elapsed_seconds
        ]
      );

      return database.get('SELECT * FROM orders ORDER BY id DESC LIMIT 1');
    },
    listRecentOrders(filters = {}) {
      const conditions = [];
      const parameters = [];

      if (filters.userId) {
        conditions.push('chatter_user_id = ?');
        parameters.push(filters.userId);
      }

      if (filters.itemText) {
        conditions.push('normalized_ordered_text LIKE ?');
        parameters.push(`%${String(filters.itemText || '').toLowerCase()}%`);
      }

      const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      return database.all(`
        SELECT *
        FROM orders
        ${whereClause}
        ORDER BY datetime(created_at) DESC
        LIMIT 200
      `, parameters);
    },
    listOrderUsers() {
      return database.all(`
        SELECT
          chatter_user_id,
          chatter_user_login,
          chatter_user_name,
          COUNT(*) AS order_count,
          MAX(created_at) AS latest_order_at
        FROM orders
        GROUP BY chatter_user_id, chatter_user_login, chatter_user_name
        ORDER BY order_count DESC, latest_order_at DESC
      `);
    },
    updateOrder(orderId, updates) {
      database.run(
        `
          UPDATE orders
          SET
            ordered_text = ?,
            normalized_ordered_text = ?,
            price_amount = ?
          WHERE id = ?
        `,
        [
          updates.ordered_text,
          updates.normalized_ordered_text,
          updates.price_amount,
          orderId
        ]
      );

      return database.get('SELECT * FROM orders WHERE id = ?', [orderId]);
    },
    deleteOrder(orderId) {
      const existingOrder = database.get('SELECT * FROM orders WHERE id = ?', [orderId]);

      if (!existingOrder) {
        return null;
      }

      database.run('DELETE FROM orders WHERE id = ?', [orderId]);
      return existingOrder;
    },
    restoreOrder(orderRecord) {
      database.run(
        `
          INSERT INTO orders (
            id,
            created_at,
            channel_name,
            channel_user_id,
            chatter_user_id,
            chatter_user_login,
            chatter_user_name,
            raw_message,
            trigger_word,
            ordered_text,
            normalized_ordered_text,
            price_amount,
            stream_started_at,
            stream_elapsed_seconds
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          orderRecord.id,
          orderRecord.created_at,
          orderRecord.channel_name,
          orderRecord.channel_user_id,
          orderRecord.chatter_user_id,
          orderRecord.chatter_user_login,
          orderRecord.chatter_user_name,
          orderRecord.raw_message,
          orderRecord.trigger_word,
          orderRecord.ordered_text,
          orderRecord.normalized_ordered_text,
          orderRecord.price_amount,
          orderRecord.stream_started_at,
          orderRecord.stream_elapsed_seconds
        ]
      );

      return database.get('SELECT * FROM orders WHERE id = ?', [orderRecord.id]);
    },
    getStatsSummary() {
      return database.get(`
        SELECT
          COUNT(*) AS total_orders,
          COALESCE(SUM(price_amount), 0) AS gross_order_value
        FROM orders
      `);
    }
  };
}

module.exports = {
  createOrderRepository
};
