const cron = require("node-cron");
const { format } = require("date-fns");
const sendSMS = require("./sendSMS");

/**
 * Sets up a daily summary cron job to send SMS summary to partners.
 * @param {import('mongodb').Db} db - The MongoDB database instance.
 */
const setupDailySummaryCron = (db) => {
    const time = process.env.TIME || "23:59";
    const [hour, minute] = time.split(":");
    const cronTime = `${minute} ${hour} * * *`;

    console.log(`[Cron] Daily summary scheduled for ${cronTime}`);

    cron.schedule(cronTime, async () => {
        try {
            const now = new Date();
            const dbDate = format(now, "dd.MM.yyyy"); // Matches format used in index.js
            const displayDate = format(now, "dd MMM, yyyy");

            const partners = (process.env.PARTNERS || "")
                .split(",")
                .map((p) => p.trim())
                .filter((p) => p);

            if (partners.length === 0) {
                console.warn(
                    "[Cron] No partners defined in environment variables for daily summary.",
                );
                return;
            }

            const salesInvoiceCollections = db.collection("salesInvoiceList");
            const purchaseInvoiceCollections = db.collection(
                "purchaseInvoiceList",
            );
            const customerDueCollections = db.collection("customerDueList");
            const supplierDueCollections = db.collection("supplierDueList");
            const transactionCollections = db.collection("transactionList");
            const mainBalanceCollections = db.collection("mainBalanceList");
            const dailySummaryCollections = db.collection("dailySummaryList");

            // Helper to ensure numeric values
            const toNum = (val) => Number(val || 0);

            // 1. Balance (Current Main Balance)
            const mainBalanceDoc = await mainBalanceCollections.findOne();
            const balance = toNum(mainBalanceDoc?.mainBalance);

            // 2. Sales Summary
            const salesInvoices = await salesInvoiceCollections
                .find({ date: dbDate })
                .toArray();
            const totalSales = salesInvoices.reduce(
                (acc, sale) => acc + toNum(sale.grandTotal),
                0,
            );
            const totalCashSales = salesInvoices.reduce(
                (acc, sale) => acc + toNum(sale.finalPayAmount),
                0,
            );
            const totalDueSale = salesInvoices.reduce(
                (acc, sale) => acc + toNum(sale.dueAmount),
                0,
            );

            // 3. Due Collection (Paid by customers today)
            const allCustomerDues = await customerDueCollections
                .find()
                .toArray();
            const totalDueCollection = allCustomerDues.reduce((acc, doc) => {
                const todaysPayments = doc.paymentHistory
                    ? doc.paymentHistory
                          .filter(
                              (p) =>
                                  p.date === dbDate &&
                                  p.paymentMethod !== "Return",
                          )
                          .reduce((sum, p) => sum + toNum(p.paidAmount), 0)
                    : 0;
                return acc + todaysPayments;
            }, 0);

            // 4. Purchase Summary
            const purchaseInvoices = await purchaseInvoiceCollections
                .find({ date: dbDate })
                .toArray();
            const totalCashPurchase = purchaseInvoices.reduce(
                (acc, p) => acc + toNum(p.finalPayAmount),
                0,
            );

            // 5. Due Given (Paid to suppliers today)
            const allSupplierDues = await supplierDueCollections
                .find()
                .toArray();
            const totalDueGiven = allSupplierDues.reduce((acc, doc) => {
                const todaysPayments = doc.paymentHistory
                    ? doc.paymentHistory
                          .filter(
                              (p) =>
                                  p.date === dbDate &&
                                  p.paymentMethod !== "Return",
                          )
                          .reduce((sum, p) => sum + toNum(p.paidAmount), 0)
                    : 0;
                return acc + todaysPayments;
            }, 0);

            // 6. Expense
            const transactions = await transactionCollections
                .find({ $and: [{ date: dbDate }, { type: "Cost" }] })
                .toArray();
            const totalExpense = transactions.reduce(
                (acc, trans) => acc + toNum(trans.totalBalance),
                0,
            );

            // 7. Profit (From Daily Summary Table)
            const dailySummaryDoc = await dailySummaryCollections.findOne({
                date: dbDate,
            });
            const totalProfit = toNum(dailySummaryDoc?.totalProfit);

            // 8. Today Balance Calculation
            // Formula: (Cash Sales + Due Collection) - (Cash Purchase + Due Given + Expense)
            const todayBalance =
                totalCashSales +
                totalDueCollection -
                (totalCashPurchase + totalDueGiven + totalExpense);

            const totalBalance = balance + todayBalance;

            const message = `Mojumdar Hath Treders
Daily Summary - ${displayDate}:
Balance: ${balance.toFixed(2)}
Total Sell: ${totalSales.toFixed(2)}
Cash: ${totalCashSales.toFixed(2)}
Due Sale: ${totalDueSale.toFixed(2)}
Due Collection: ${totalDueCollection.toFixed(2)}

Cash on purchase: ${totalCashPurchase.toFixed(2)}
Due Given: ${totalDueGiven.toFixed(2)}
Expense: ${totalExpense.toFixed(2)}
Profit: ${totalProfit.toFixed(2)}

Today balance: ${todayBalance.toFixed(2)} taka
Total Balance: ${totalBalance.toFixed(2)} taka`;

            // 9. Send Batch SMS (One to Many)
            const response = await sendSMS({ number: partners, message });
            console.log(
                `[Cron] Bulk SMS Response from Gateway:`,
                JSON.stringify(response),
            );

            console.log(
                `[Cron] Daily summary processing complete for ${partners.length} partners for ${dbDate}.`,
            );
        } catch (error) {
            console.error("[Cron] Error in daily summary cron:", error);
        }
    });
};

module.exports = { setupDailySummaryCron };
