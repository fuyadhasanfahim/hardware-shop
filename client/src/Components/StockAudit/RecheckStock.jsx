import { useContext, useEffect, useState } from "react";
import { CiSearch } from "react-icons/ci";
import { MdOutlineEdit } from "react-icons/md";
import { IoCheckmarkCircleOutline } from "react-icons/io5";
import Swal from "sweetalert2";
import { toast } from "react-toastify";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import excel from "../../assets/images/excel.png";
import pdf from "../../assets/images/pdf.png";
import { ContextData } from "../../Provider";
import useAxiosProtect from "../hooks/useAxiosProtect";

const RecheckStock = () => {
  const axiosProtect = useAxiosProtect();
  const { user, userName } = useContext(ContextData);

  const [recheckList, setRecheckList] = useState([]);
  const [downloadList, setDownloadList] = useState([]);
  const [count, setCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [reFetch, setReFetch] = useState(false);

  // Fetch paginated Recheck stock
  useEffect(() => {
    setLoading(true);
    axiosProtect
      .get("/stockAudit/recheck", {
        params: {
          userEmail: user?.email,
          page: currentPage,
          size: itemsPerPage,
          search: searchTerm,
        },
      })
      .then((res) => {
        if (res.data.success) {
          setRecheckList(res.data.result || []);
          setCount(res.data.count || 0);
        }
      })
      .catch((err) => {
        toast.error(err.response?.data?.message || "Failed to load recheck stock");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [reFetch, currentPage, itemsPerPage, searchTerm, user?.email]);

  // Fetch all unconfirmed stock for Excel & PDF export
  useEffect(() => {
    axiosProtect
      .get("/stockAudit/recheck", {
        params: {
          userEmail: user?.email,
          page: 1,
          size: 10000,
        },
      })
      .then((res) => {
        if (res.data.success) {
          setDownloadList(res.data.result || []);
        }
      })
      .catch((err) => {
        console.error(err);
      });
  }, [reFetch, user?.email]);

  // Search input handler
  const handleInputChange = (event) => {
    setSearchTerm(event.target.value);
    setCurrentPage(1);
  };

  // Direct confirm handler (as is)
  const handleDirectConfirm = (item) => {
    Swal.fire({
      title: "Confirm Stock?",
      html: `<div class="text-left text-sm space-y-1">
        <p><strong>Product:</strong> ${item.productTitle}</p>
        <p><strong>Quantity:</strong> ${parseFloat(item.purchaseQuantity).toFixed(2)} ${item.purchaseUnit}</p>
        <p><strong>Price:</strong> ৳${parseFloat(item.purchasePrice).toFixed(2)}</p>
      </div>`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#22c55e",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, Confirm",
      cancelButtonText: "Cancel",
    }).then((result) => {
      if (result.isConfirmed) {
        axiosProtect
          .post("/stockAudit/confirm", {
            productID: item.productID,
            physicalQuantity: item.purchaseQuantity,
            purchasePrice: item.purchasePrice,
            confirmedBy: userName || user?.displayName || user?.email || "ADMIN",
          })
          .then((res) => {
            if (res.data.success) {
              setReFetch(!reFetch);
              Swal.fire({
                text: "Stock confirmed successfully",
                icon: "success",
              });
            } else {
              toast.error(res.data?.message || "Failed to confirm stock");
            }
          })
          .catch((err) => {
            toast.error(err.response?.data?.message || "Server error while confirming stock");
          });
      }
    });
  };

  // Edit & confirm handler
  const handleEditAndConfirm = (e, item) => {
    e.preventDefault();
    const form = e.target;
    const updateQuantity = parseFloat(form.update_quantity.value);
    const updatePrice = parseFloat(form.update_price.value);

    if (isNaN(updateQuantity) || isNaN(updatePrice)) {
      toast.error("Please provide valid quantity and price");
      return;
    }

    axiosProtect
      .post("/stockAudit/confirm", {
        productID: item.productID,
        physicalQuantity: updateQuantity,
        purchasePrice: updatePrice,
        confirmedBy: userName || user?.displayName || user?.email || "ADMIN",
      })
      .then((res) => {
        if (res.data.success) {
          const modal = document.querySelector(`#modal_recheck_edit_${item._id}`);
          if (modal) {
            modal.close();
          }
          setReFetch(!reFetch);
          Swal.fire({
            text: "Stock updated & confirmed successfully",
            icon: "success",
          });
        } else {
          toast.error(res.data?.message || "Failed to update stock");
        }
      })
      .catch((err) => {
        toast.error(err.response?.data?.message || "Server error while updating stock");
      });
  };

  // Excel Export
  const downloadExcel = () => {
    const formattedData = downloadList.map((item) => ({
      "Product ID": item.productID,
      "Product Name": item.productTitle,
      Quantity: item.purchaseQuantity,
      Unit: item.purchaseUnit,
      Category: item.category,
      Brand: item.brand,
      Price: item.purchasePrice,
      Storage: item.storage,
    }));

    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Recheck_Stock");
    XLSX.writeFile(workbook, "recheck_stock.xlsx");
  };

  // PDF Export
  const downloadPDF = () => {
    const doc = new jsPDF();
    const tableColumn = [
      "Product ID",
      "Product Name",
      "Quantity",
      "Unit",
      "Price",
      "Storage",
    ];
    const tableRows = [];

    downloadList.forEach((item) => {
      const rowData = [
        item.productID,
        item.productTitle,
        parseFloat(item.purchaseQuantity).toFixed(2),
        item.purchaseUnit,
        parseFloat(item.purchasePrice).toFixed(2),
        item.storage,
      ];
      tableRows.push(rowData);
    });

    doc.text("Recheck Stock List", 14, 15);
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 20,
    });
    doc.save("recheck_stock.pdf");
  };

  // Pagination calculations
  const totalItem = count;
  const numberOfPages = Math.ceil(totalItem / itemsPerPage) || 1;

  const renderPageNumbers = () => {
    const pageNumbers = [];
    const maxPagesToShow = 5;
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
  };

  return (
    <div>
      {/* Header */}
      <div className="mt-5 pb-5">
        <div className="flex items-center justify-between">
          <div className="flex gap-2 items-center">
            <h2 className="text-2xl font-bold uppercase">Recheck Stock</h2>
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
          <div className="flex gap-2">
            <label className="flex gap-1 items-center border py-1 px-3 border-gray-500">
              <input
                onChange={handleInputChange}
                type="text"
                name="search"
                value={searchTerm}
                placeholder="Search"
                className="hover:outline-none outline-none"
                size="15"
              />
              <CiSearch />
            </label>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="table table-zebra">
          <thead>
            <tr className="border bg-green-200 text-black">
              <th>Product ID</th>
              <th>Product Name</th>
              <th className="text-center">Quantity</th>
              <th>Unit</th>
              <th className="text-center">Category</th>
              <th className="text-center">Brand</th>
              <th className="text-center">Purchase Price</th>
              <th className="text-center">Storage</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="9" className="text-center py-5">
                  Loading...
                </td>
              </tr>
            ) : recheckList.length > 0 ? (
              recheckList.map((item) => (
                <tr
                  key={item._id}
                  className={`${
                    item.purchaseQuantity <= item.reOrderQuantity ? "bg-yellow-100" : ""
                  }`}
                >
                  <td>{item.productID}</td>
                  <td>{item.productTitle}</td>
                  <td className="text-center font-bold">
                    {parseFloat(item.purchaseQuantity).toFixed(2)}
                  </td>
                  <td>{item.purchaseUnit}</td>
                  <td className="text-center">{item.category}</td>
                  <td className="text-center">{item.brand}</td>
                  <td className="text-center">
                    {parseFloat(item.purchasePrice).toFixed(2)}
                  </td>
                  <td className="text-center">{item.storage}</td>
                  <td>
                    <div className="flex items-center text-xl w-full gap-3">
                      {/* Confirm Button (✓) */}
                      <button
                        onClick={() => handleDirectConfirm(item)}
                        className="text-green-600 hover:text-green-700 cursor-pointer"
                        title="Confirm Stock"
                      >
                        <IoCheckmarkCircleOutline />
                      </button>

                      {/* Edit Button (✏️) */}
                      <button
                        onClick={() =>
                          document
                            .getElementById(`modal_recheck_edit_${item._id}`)
                            .showModal()
                        }
                        title="Edit Stock"
                      >
                        <MdOutlineEdit />
                      </button>

                      {/* Update Modal */}
                      <dialog
                        id={`modal_recheck_edit_${item._id}`}
                        className="modal text-left"
                      >
                        <div className="modal-box">
                          <h3 className="font-bold text-lg mb-3 uppercase">
                            UPDATING: {item.productTitle}
                          </h3>
                          <hr />
                          <form method="dialog">
                            <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2 text-white bg-red-400 hover:bg-red-500">
                              ✕
                            </button>
                          </form>
                          <form
                            onSubmit={(e) => handleEditAndConfirm(e, item)}
                            className="mt-5"
                          >
                            <p className="text-[16px] flex items-center gap-4 mb-3">
                              <span className="w-1/3 font-bold">Product ID:</span>
                              <input
                                type="text"
                                value={item.productID}
                                readOnly
                                className="border border-gray-300 py-1 px-2 text-gray-700 outline-none w-2/3"
                              />
                            </p>
                            <p className="text-[16px] flex items-center gap-4 mb-3">
                              <span className="w-1/3 font-bold">Update Quantity:</span>
                              <input
                                type="number"
                                step="any"
                                name="update_quantity"
                                defaultValue={item.purchaseQuantity}
                                required
                                className="border border-gray-300 py-1 px-2 text-gray-700 outline-none w-2/3"
                              />
                            </p>
                            <p className="text-[16px] flex items-center gap-4 mb-3">
                              <span className="w-1/3 font-bold">Update Price:</span>
                              <input
                                type="number"
                                step="any"
                                name="update_price"
                                defaultValue={item.purchasePrice}
                                required
                                className="border border-gray-300 py-1 px-2 text-gray-700 outline-none w-2/3"
                              />
                            </p>
                            <div className="flex justify-end gap-3 mt-4">
                              <button
                                type="reset"
                                className="bg-[#ffca28] hover:bg-yellow-400 text-gray-900 font-semibold py-1.5 px-6 cursor-pointer"
                              >
                                Reset
                              </button>
                              <button
                                type="submit"
                                className="bg-[#22c55e] hover:bg-green-600 text-white font-semibold py-1.5 px-6 cursor-pointer"
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
              ))
            ) : (
              <tr>
                <td colSpan="9" className="text-center py-5">
                  No products in Recheck Stock
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {count > 10 && (
        <div className="my-8 flex justify-center gap-1">
          <button
            onClick={handlePrevPage}
            className="py-2 px-3 bg-green-500 text-white hover:bg-gray-600"
            disabled={currentPage === 1}
          >
            Prev
          </button>
          {renderPageNumbers().map((page, index) => (
            <button
              key={index}
              onClick={() => typeof page === "number" && handlePageClick(page)}
              className={`py-2 px-5 bg-green-500 text-white hover:bg-gray-600 ${
                currentPage === page ? "!bg-gray-600" : ""
              }`}
              disabled={typeof page !== "number"}
            >
              {page}
            </button>
          ))}
          <button
            onClick={handleNextPage}
            className="py-2 px-3 bg-green-500 text-white hover:bg-gray-600"
            disabled={currentPage === numberOfPages}
          >
            Next
          </button>

          <select
            value={itemsPerPage}
            onChange={handleItemsPerPage}
            className="py-2 px-1 bg-green-500 text-white outline-none"
          >
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </div>
      )}
    </div>
  );
};

export default RecheckStock;
