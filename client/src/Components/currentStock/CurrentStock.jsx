import { useContext, useEffect, useState } from "react";
import { CiSearch } from "react-icons/ci";
import { MdOutlineEdit } from "react-icons/md";
import Swal from "sweetalert2";
import { ContextData } from "../../Provider";
import useAxiosProtect from "../hooks/useAxiosProtect";
import excel from "../../assets/images/excel.png";
import pdf from "../../assets/images/pdf.png";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { toast } from "react-toastify";

const CurrentStock = () => {
  const axiosProtect = useAxiosProtect();
  const {
    user,
    stock,
    count,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    setSearchStock,
    searchStock,
    setStock,
    setCount,
    reFetch,
    setReFetch,
  } = useContext(ContextData);

  const [downloadStock, setDownloadStock] = useState([]);

  useEffect(() => {
    axiosProtect
      .get(`/stockBalance`, {
        params: {
          userEmail: user?.email,
        },
      })
      .then((res) => {
        setDownloadStock(res.data.result);
      })
      .catch((err) => {
        toast.error(err);
      });
  }, [reFetch]);

  // __________________________________________________________________________
  useEffect(() => {
    // Reset search term and current page on component mount
    setSearchStock("");
    setCurrentPage(1);

    return () => {
      // Cleanup function to reset search term and current page on component unmount
      setSearchStock("");
      setCurrentPage(1);
    };
  }, [setSearchStock, setCurrentPage]);
  // __________________________________________________________________________

  // get stock balance
  useEffect(() => {
    axiosProtect
      .get(`/stockBalance`, {
        params: {
          userEmail: user?.email,
          page: currentPage,
          size: itemsPerPage,
          search: searchStock,
        },
      })
      .then((res) => {
        setStock(res.data.result);
        setCount(res.data.count);
      })
      .catch((err) => {
        toast.error(err);
      });
  }, [reFetch, currentPage, itemsPerPage, searchStock]);

  // search input onchange
  const handleInputChange = (event) => {
    setSearchStock(event.target.value);
    setCurrentPage(1); // reset to first page on new search
  };

  // Update stock handler
  const handleUpdateStock = (e, id) => {
    e.preventDefault();
    const form = e.target;
    const updateQuantity = form.update_quantity.value;
    const updatePrice = form.update_price.value;

    const purchaseQuantity = parseFloat(updateQuantity);
    const purchasePrice = parseFloat(updatePrice);

    if (isNaN(purchaseQuantity) || isNaN(purchasePrice)) {
      toast.error("Please provide valid quantity and price");
      return;
    }

    const updateInfo = {
      purchaseQuantity,
      purchasePrice,
    };

    axiosProtect
      .put(`/updateStock/${id}`, updateInfo)
      .then((res) => {
        if (res.status === 200) {
          setReFetch(!reFetch);
          const modal = document.querySelector(`#update_stock_${id}`);
          if (modal) {
            modal.close();
          }
          Swal.fire({
            text: "Stock updated successfully",
            icon: "success",
          });
        } else {
          toast.error(res.data?.message || "Failed to update stock");
        }
      })
      .catch((err) => {
        toast.error(
          err.response?.data?.message || "Server error while updating stock"
        );
      });
  };

  // ...................................................................

  // Pagination
  const totalItem = count;
  const numberOfPages = Math.ceil(totalItem / itemsPerPage);

  const renderPageNumbers = () => {
    const pageNumbers = [];
    const maxPagesToShow = 5; // Maximum number of page buttons to show
    const halfMaxPagesToShow = Math.floor(maxPagesToShow / 2);
    const totalPages = numberOfPages;

    if (totalPages <= maxPagesToShow) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      if (currentPage <= halfMaxPagesToShow) {
        for (let i = 1; i <= maxPagesToShow; i++) {
          pageNumbers.push(i);
        }
        pageNumbers.push("...", totalPages);
      } else if (currentPage > totalPages - halfMaxPagesToShow) {
        pageNumbers.push(1, "...");
        for (let i = totalPages - maxPagesToShow + 1; i <= totalPages; i++) {
          pageNumbers.push(i);
        }
      } else {
        pageNumbers.push(1, "...");
        for (
          let i = currentPage - halfMaxPagesToShow;
          i <= currentPage + halfMaxPagesToShow;
          i++
        ) {
          pageNumbers.push(i);
        }
        pageNumbers.push("...", totalPages);
      }
    }

    return pageNumbers;
  };

  const handleItemsPerPage = (e) => {
    const val = parseInt(e.target.value);
    setItemsPerPage(val);
    setCurrentPage(1);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < numberOfPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePageClick = (page) => {
    setCurrentPage(page);
    // any other logic to handle page change
  };

  // ...................................................................
  const downloadExcel = () => {
    // Format the data to include only the desired columns
    const formattedData = downloadStock.map((stk) => ({
      "Product ID": stk.productID,
      "Product Name": stk.productTitle,
      Quantity: parseFloat(stk.purchaseQuantity || 0).toFixed(2),
      Unit: stk.purchaseUnit,
      "Purchase Price": parseFloat(stk.purchasePrice || 0).toFixed(2),
      "Sales Price": parseFloat(stk.salesPrice || 0).toFixed(2),
      "Total Value": (
        parseFloat(stk.purchaseQuantity || 0) *
        parseFloat(stk.purchasePrice || 0)
      ).toFixed(2),
      Category: stk.category,
      Brand: stk.brand,
      Storage: stk.storage,
      "Min Stock (Norms)": parseFloat(stk.reOrderQuantity || 0).toFixed(2),
    }));

    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Stocks");
    XLSX.writeFile(workbook, "stocks.xlsx");
  };
  // ...................................................................
  const downloadPDF = () => {
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    const tableColumn = [
      "Product ID",
      "Product Name",
      "Quantity",
      "Unit",
      "Purchase Price",
      "Sales Price",
      "Total Value",
      "Storage",
    ];
    const tableRows = [];

    downloadStock.forEach((stk) => {
      const stockData = [
        stk.productID,
        stk.productTitle,
        parseFloat(stk.purchaseQuantity || 0).toFixed(2),
        stk.purchaseUnit,
        parseFloat(stk.purchasePrice || 0).toFixed(2),
        parseFloat(stk.salesPrice || 0).toFixed(2),
        (
          parseFloat(stk.purchaseQuantity || 0) *
          parseFloat(stk.purchasePrice || 0)
        ).toFixed(2),
        stk.storage,
      ];
      tableRows.push(stockData);
    });

    doc.text("Current Stock Balance Report", 14, 15);
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 20,
      styles: { fontSize: 8 },
    });
    doc.save("stocks.pdf");
  };
  // ...................................................................

  return (
    <div className="px-4">
      <div className="mt-5 pb-5">
        <div className="flex items-center justify-between">
          <div className="flex gap-2 items-center">
            <h2 className="text-2xl">Current stock balance:</h2>
            <img
              src={excel}
              alt="Excel"
              className="w-[20px] h-[20%] cursor-pointer ml-5"
              onClick={downloadExcel}
            />
            <img
              src={pdf}
              alt="Pdf"
              className="w-[20px] h-[20%] cursor-pointer"
              onClick={downloadPDF}
            />
          </div>
          <label className="flex gap-1 items-center border py-1 px-3 rounded-md">
            <input
              onChange={handleInputChange}
              type="text"
              name="search"
              placeholder="Search"
              className=" hover:outline-none outline-none"
              size="13"
            />
            <CiSearch />
          </label>
        </div>
        <div>
          <div className="overflow-x-auto mt-5">
            <table className="table table-zebra">
              {/* head */}
              <thead>
                <tr className="border bg-green-200 text-black">
                  <th className="w-[10%]">Product ID</th>
                  <th>Product name</th>
                  <th className="w-[6%]">Quantity</th>
                  <th className="w-[8%]">Unit</th>
                  <th className="w-[15%] text-center">Category</th>
                  <th className="w-[8%]">Brand</th>
                  <th className="w-[5%]">Purchase Price</th>
                  <th className="w-[6%]">Storage</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {/* row 1 */}
                {stock &&
                  stock.map((stockItem) => (
                    <tr
                      key={stockItem._id}
                      className={`${
                        stockItem.purchaseQuantity <= stockItem.reOrderQuantity
                          ? "bg-yellow-100"
                          : ""
                      }`}
                    >
                      <td>{stockItem.productID}</td>
                      <td>{stockItem.productTitle}</td>
                      <td className="text-center">
                        {parseFloat(stockItem.purchaseQuantity).toFixed(2)}
                      </td>
                      <td>{stockItem.purchaseUnit}</td>
                      <td className="text-center">{stockItem.category}</td>
                      <td className="text-center">{stockItem.brand}</td>
                      <td className="text-center">
                        {parseFloat(stockItem.purchasePrice).toFixed(2)}
                      </td>
                      <td className="text-center">{stockItem.storage}</td>
                      <td>
                        <div className="flex items-center text-xl w-full gap-3">
                          <button
                            onClick={() =>
                              document
                                .getElementById(`update_stock_${stockItem._id}`)
                                .showModal()
                            }
                          >
                            <MdOutlineEdit />
                          </button>

                          {/* Update Stock Modal */}
                          <dialog
                            id={`update_stock_${stockItem._id}`}
                            className="modal text-left"
                          >
                            <div className="modal-box max-w-lg w-full relative p-6">
                              <h3 className="font-bold text-lg mb-3 uppercase text-gray-800 pr-8">
                                UPDATING: {stockItem.productTitle}
                              </h3>
                              <hr className="my-3 border-gray-200" />
                              <form method="dialog">
                                <button className="btn btn-sm btn-circle btn-ghost absolute right-3 top-3 text-white bg-red-400 hover:bg-red-500 border-none">
                                  ✕
                                </button>
                              </form>
                              <form
                                onSubmit={(e) =>
                                  handleUpdateStock(e, stockItem._id)
                                }
                                className="mt-5 space-y-4"
                              >
                                <div className="flex items-center justify-between gap-4">
                                  <label className="font-bold text-gray-800 text-[15px] w-1/3">
                                    Product ID
                                  </label>
                                  <input
                                    type="text"
                                    value={stockItem.productID}
                                    readOnly
                                    className="border border-gray-300 rounded-lg py-2 px-3 text-gray-700 outline-none w-2/3 bg-white font-medium"
                                  />
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                  <label className="font-bold text-gray-800 text-[15px] w-1/3">
                                    Update Quantity
                                  </label>
                                  <input
                                    type="number"
                                    step="any"
                                    name="update_quantity"
                                    defaultValue={stockItem.purchaseQuantity}
                                    required
                                    className="border border-gray-300 rounded-lg py-2 px-3 text-gray-700 outline-none w-2/3 focus:border-green-500"
                                  />
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                  <label className="font-bold text-gray-800 text-[15px] w-1/3">
                                    Update Price
                                  </label>
                                  <input
                                    type="number"
                                    step="any"
                                    name="update_price"
                                    defaultValue={stockItem.purchasePrice}
                                    required
                                    className="border border-gray-300 rounded-lg py-2 px-3 text-gray-700 outline-none w-2/3 focus:border-green-500"
                                  />
                                </div>
                                <div className="flex justify-end gap-3 pt-3">
                                  <button
                                    type="reset"
                                    className="bg-[#ffca28] hover:bg-yellow-400 text-gray-900 font-semibold py-2 px-6 rounded-lg transition-colors cursor-pointer text-[15px]"
                                  >
                                    Reset
                                  </button>
                                  <button
                                    type="submit"
                                    className="bg-[#22c55e] hover:bg-green-600 text-white font-semibold py-2 px-6 rounded-lg transition-colors cursor-pointer text-[15px]"
                                  >
                                    Update
                                  </button>
                                </div>
                              </form>
                            </div>
                          </dialog>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {/* Pagination */}
      {count > 10 && (
        <div className="my-8 flex justify-center gap-1">
          <button
            onClick={handlePrevPage}
            className="py-2 px-3 bg-green-500 text-white rounded-md hover:bg-gray-600"
            disabled={currentPage === 1}
          >
            Prev
          </button>
          {renderPageNumbers().map((page, index) => (
            <button
              key={index}
              onClick={() => typeof page === "number" && handlePageClick(page)}
              className={`py-2 px-5 bg-green-500 text-white rounded-md hover:bg-gray-600 ${
                currentPage === page ? "!bg-gray-600" : ""
              }`}
              disabled={typeof page !== "number"}
            >
              {page}
            </button>
          ))}
          <button
            onClick={handleNextPage}
            className="py-2 px-3 bg-green-500 text-white rounded-md hover:bg-gray-600"
            disabled={currentPage === numberOfPages}
          >
            Next
          </button>

          <select
            value={itemsPerPage}
            onChange={handleItemsPerPage}
            name=""
            id=""
            className="py-2 px-1 rounded-md bg-green-500 text-white outline-none"
          >
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
          </select>
        </div>
      )}
    </div>
  );
};

export default CurrentStock;
