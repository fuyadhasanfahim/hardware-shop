/**
 * Stock Audit Controller
 * Handles incoming HTTP requests and responses for Stock Audit
 */

class StockAuditController {
  constructor(stockAuditService) {
    this.service = stockAuditService;
  }

  getRecheckStock = async (req, res) => {
    try {
      const { search, page, size, category, storage } = req.query;
      const data = await this.service.getRecheckStock({
        search,
        page,
        size,
        category,
        storage,
      });
      res.status(200).json({ success: true, ...data });
    } catch (error) {
      console.error("Error in getRecheckStock controller:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch recheck stock",
      });
    }
  };

  confirmStockItem = async (req, res) => {
    try {
      const { productID, physicalQuantity, purchasePrice, confirmedBy } = req.body;

      if (!productID) {
        return res.status(400).json({
          success: false,
          message: "Product ID is required",
        });
      }

      const result = await this.service.confirmStockItem({
        productID,
        physicalQuantity,
        purchasePrice,
        confirmedBy: confirmedBy || req.user?.email || "ADMIN",
      });

      res.status(200).json({
        success: true,
        message: "Stock item confirmed successfully",
        ...result,
      });
    } catch (error) {
      console.error("Error in confirmStockItem controller:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to confirm stock item",
      });
    }
  };

  getConfirmedStock = async (req, res) => {
    try {
      const { search, page, size, category, storage } = req.query;
      const data = await this.service.getConfirmedStock({
        search,
        page,
        size,
        category,
        storage,
      });
      res.status(200).json({ success: true, ...data });
    } catch (error) {
      console.error("Error in getConfirmedStock controller:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch confirmed stock",
      });
    }
  };

  revertStockItem = async (req, res) => {
    try {
      const { productID } = req.params;

      if (!productID) {
        return res.status(400).json({
          success: false,
          message: "Product ID is required",
        });
      }

      const result = await this.service.revertStockItem(productID);
      res.status(200).json({
        success: true,
        message: "Stock item reverted to Recheck Stock successfully",
        ...result,
      });
    } catch (error) {
      console.error("Error in revertStockItem controller:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to revert stock item",
      });
    }
  };

  getAuditMetrics = async (req, res) => {
    try {
      const metrics = await this.service.getAuditMetrics();
      res.status(200).json({ success: true, ...metrics });
    } catch (error) {
      console.error("Error in getAuditMetrics controller:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch audit metrics",
      });
    }
  };
}

module.exports = StockAuditController;
