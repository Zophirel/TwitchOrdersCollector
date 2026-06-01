function createDashboardService(requestRepository, orderRepository) {
  return {
    getDashboardSummary(popularityDemotions = {}) {
      const stats = requestRepository.getStatsSummary();
      const orderStats = orderRepository.getStatsSummary();
      return {
        totalRequests: stats.total_requests || 0,
        uniqueItems: stats.unique_items || 0,
        uniqueChatters: stats.unique_chatters || 0,
        totalOrders: orderStats.total_orders || 0,
        grossOrderValue: Number(orderStats.gross_order_value || 0),
        latestRequests: requestRepository.listRecentRequests({}).slice(0, 10),
        latestOrders: orderRepository.listRecentOrders({}).slice(0, 10),
        topItems: requestRepository.listTopRequestedItems(10, popularityDemotions)
      };
    }
  };
}

module.exports = {
  createDashboardService
};
