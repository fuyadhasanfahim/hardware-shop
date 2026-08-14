/**
 * Stock Audit Routes
 * Mounts feature endpoints for Physical Stock Audit
 */

const express = require("express");
const StockAuditService = require("./stockAudit.service");
const StockAuditController = require("./stockAudit.controller");

function createStockAuditRouter(database) {
  const router = express.Router();
  const service = new StockAuditService(database);
  const controller = new StockAuditController(service);

  // Endpoints for Recheck Stock
  router.get("/stockAudit/recheck", controller.getRecheckStock);
  router.post("/stockAudit/confirm", controller.confirmStockItem);

  // Endpoints for Confirmed Stock
  router.get("/stockAudit/confirmed", controller.getConfirmedStock);
  router.delete("/stockAudit/revert/:productID", controller.revertStockItem);

  // Overall Audit KPIs & Metrics
  router.get("/stockAudit/metrics", controller.getAuditMetrics);

  return router;
}

module.exports = createStockAuditRouter;
