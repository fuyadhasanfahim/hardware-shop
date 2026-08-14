/**
 * Stock Audit Service
 * Handles database operations for Physical Stock Audit / Verification
 * Keeps live stockList isolated from confirmedStockList
 */

class StockAuditService {
  constructor(database) {
    this.database = database;
    this.stockCollection = database.collection("stockList");
    this.confirmedStockCollection = database.collection("confirmedStockList");
    this.ensureIndexes();
  }

  /**
   * Ensure necessary indexes for fast query performance
   */
  async ensureIndexes() {
    try {
      await this.confirmedStockCollection.createIndex(
        { productID: 1 },
        { unique: true }
      );
      await this.confirmedStockCollection.createIndex({ confirmedAt: -1 });
    } catch (err) {
      console.error("Error creating indexes in confirmedStockList:", err);
    }
  }

  /**
   * Get all unconfirmed products for Recheck Stock page
   */
  async getRecheckStock({ search, page = 1, size = 20, category, storage }) {
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(size) || 20;
    const skip = (pageNum - 1) * limitNum;

    // Get list of already confirmed product IDs (Strict API Version 1 compliant)
    const confirmedDocs = await this.confirmedStockCollection
      .find({}, { projection: { productID: 1, _id: 0 } })
      .toArray();
    const confirmedProductIDs = confirmedDocs.map((doc) => doc.productID);

    const query = {
      productID: { $nin: confirmedProductIDs },
    };

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");
      const orConditions = [
        { productTitle: searchRegex },
        { category: searchRegex },
        { brand: searchRegex },
        { storage: searchRegex },
      ];

      const searchNumber = Number(search.trim());
      if (!isNaN(searchNumber)) {
        orConditions.push({ productID: searchNumber });
      }

      query.$or = orConditions;
    }

    if (category && category !== "All") {
      query.category = category;
    }

    if (storage && storage !== "All") {
      query.storage = storage;
    }

    const [result, count, totalItems, totalConfirmed] = await Promise.all([
      this.stockCollection.find(query).skip(skip).limit(limitNum).toArray(),
      this.stockCollection.countDocuments(query),
      this.stockCollection.countDocuments(),
      this.confirmedStockCollection.countDocuments(),
    ]);

    return {
      result,
      count,
      totalItems,
      totalConfirmed,
      currentPage: pageNum,
      totalPages: Math.ceil(count / limitNum),
    };
  }

  /**
   * Confirm a product item into confirmedStockList
   * Either as-is or with adjusted physical count and purchase price
   */
  async confirmStockItem({ productID, physicalQuantity, purchasePrice, confirmedBy }) {
    const numericProductID = Number(productID);
    if (isNaN(numericProductID)) {
      throw new Error("Invalid Product ID");
    }

    // Find original product in live stock
    const originalProduct = await this.stockCollection.findOne({
      productID: numericProductID,
    });

    if (!originalProduct) {
      throw new Error("Product not found in stock list");
    }

    const systemQty = Number(originalProduct.purchaseQuantity) || 0;
    const countedQty =
      physicalQuantity !== undefined && physicalQuantity !== null && physicalQuantity !== ""
        ? Number(physicalQuantity)
        : systemQty;
    const finalPrice =
      purchasePrice !== undefined && purchasePrice !== null && purchasePrice !== ""
        ? Number(purchasePrice)
        : Number(originalProduct.purchasePrice) || 0;

    const varianceQty = countedQty - systemQty;

    const confirmedDoc = {
      productID: originalProduct.productID,
      productTitle: originalProduct.productTitle,
      category: originalProduct.category || "",
      brand: originalProduct.brand || "",
      purchaseUnit: originalProduct.purchaseUnit || "Piece",
      storage: originalProduct.storage || "",
      systemQuantity: systemQty,
      countedQuantity: countedQty,
      differenceQuantity: varianceQty,
      purchasePrice: finalPrice,
      salesPrice: originalProduct.salesPrice || 0,
      reOrderQuantity: originalProduct.reOrderQuantity || 0,
      confirmedAt: new Date(),
      confirmedBy: confirmedBy || "ADMIN",
      status: "confirmed",
      originalStockId: originalProduct._id,
    };

    // Upsert into isolated confirmedStockList
    const result = await this.confirmedStockCollection.updateOne(
      { productID: numericProductID },
      { $set: confirmedDoc },
      { upsert: true }
    );

    return {
      success: true,
      confirmedDoc,
      isNewConfirmation: result.upsertedCount > 0,
    };
  }

  /**
   * Get all confirmed stock items for Confirmed Stock page
   */
  async getConfirmedStock({ search, page = 1, size = 20, category, storage }) {
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(size) || 20;
    const skip = (pageNum - 1) * limitNum;

    const query = {};

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");
      const orConditions = [
        { productTitle: searchRegex },
        { category: searchRegex },
        { brand: searchRegex },
        { storage: searchRegex },
      ];

      const searchNumber = Number(search.trim());
      if (!isNaN(searchNumber)) {
        orConditions.push({ productID: searchNumber });
      }

      query.$or = orConditions;
    }

    if (category && category !== "All") {
      query.category = category;
    }

    if (storage && storage !== "All") {
      query.storage = storage;
    }

    const [result, count, totalValResult, totalItems] = await Promise.all([
      this.confirmedStockCollection
        .find(query)
        .sort({ confirmedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .toArray(),
      this.confirmedStockCollection.countDocuments(query),
      this.confirmedStockCollection
        .aggregate([
          {
            $group: {
              _id: null,
              totalAuditedValue: {
                $sum: {
                  $multiply: [
                    { $ifNull: ["$countedQuantity", 0] },
                    { $ifNull: ["$purchasePrice", 0] },
                  ],
                },
              },
              totalCountedUnits: { $sum: { $ifNull: ["$countedQuantity", 0] } },
            },
          },
        ])
        .toArray(),
      this.stockCollection.countDocuments(),
    ]);

    const totalAuditedValue =
      totalValResult.length > 0 ? totalValResult[0].totalAuditedValue : 0;
    const totalCountedUnits =
      totalValResult.length > 0 ? totalValResult[0].totalCountedUnits : 0;

    return {
      result,
      count,
      totalItems,
      totalAuditedValue,
      totalCountedUnits,
      currentPage: pageNum,
      totalPages: Math.ceil(count / limitNum),
    };
  }

  /**
   * Revert a confirmed stock item back to Recheck Stock
   */
  async revertStockItem(productID) {
    const numericProductID = Number(productID);
    if (isNaN(numericProductID)) {
      throw new Error("Invalid Product ID");
    }

    const deleteResult = await this.confirmedStockCollection.deleteOne({
      productID: numericProductID,
    });

    if (deleteResult.deletedCount === 0) {
      throw new Error("Item not found in confirmed stock list");
    }

    return { success: true, message: "Item reverted to Recheck Stock successfully" };
  }

  /**
   * Get high-level audit progress metrics
   */
  async getAuditMetrics() {
    const [totalItems, confirmedCount, valResult] = await Promise.all([
      this.stockCollection.countDocuments(),
      this.confirmedStockCollection.countDocuments(),
      this.confirmedStockCollection
        .aggregate([
          {
            $group: {
              _id: null,
              totalValue: {
                $sum: {
                  $multiply: [
                    { $ifNull: ["$countedQuantity", 0] },
                    { $ifNull: ["$purchasePrice", 0] },
                  ],
                },
              },
            },
          },
        ])
        .toArray(),
    ]);

    const totalAuditedValue = valResult.length > 0 ? valResult[0].totalValue : 0;
    const remainingCount = totalItems - confirmedCount;
    const completionPercentage = totalItems > 0 ? ((confirmedCount / totalItems) * 100).toFixed(1) : 0;

    return {
      totalItems,
      confirmedCount,
      remainingCount,
      completionPercentage,
      totalAuditedValue,
    };
  }
}

module.exports = StockAuditService;
