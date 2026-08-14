import { useContext, useEffect, useState } from "react";
import { CiSearch } from "react-icons/ci";
import { IoArrowUndoOutline } from "react-icons/io5";
import excel from "../../assets/images/excel.png";
import pdf from "../../assets/images/pdf.png";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import Swal from "sweetalert2";
import { toast } from "react-toastify";
import moment from "moment";
import { ContextData } from "../../Provider";
import useAxiosProtect from "../hooks/useAxiosProtect";

const ConfirmedStock = () => {
  const axiosProtect = useAxiosProtect();
  const { user } = useContext(ContextData);

  const [confirmedList, setConfirmedList] = useState([]);
  const [downloadList, setDownloadList] = useState([]);
  const [count, setCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [reFetch, setReFetch] = useState(false);

  // Fetch paginated confirmed stock
  useEffect(() => {
    setLoading(true);
    axiosProtect
      .get("/stockAudit/confirmed", {
        params: {
          userEmail: user?.email,
          page: currentPage,
          size: itemsPerPage,
          search: searchTerm,
        },
      })
      .then((res) => {
        if (res.data.success) {
          setConfirmedList(res.data.result || []);
          setCount(res.data.count || 0);
        }
      })
      .catch((err) => {
        toast.error(err.response?.data?.message || "Failed to load confirmed stock");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [reFetch, currentPage, itemsPerPage, searchTerm, user?.email]);

  // Fetch all confirmed stock for Excel & PDF export
  useEffect(() => {
    axiosProtect
      .get("/stockAudit/confirmed", {
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

  // Revert / Undo confirm handler
  const handleRevert = (item) => {
    Swal.fire({
      title: "Revert this item?",
      text: `Are you sure you want to return "${item.productTitle}" back to Recheck Stock?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#eab308",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, Revert",
      cancelButtonText: "Cancel",
    }).then((result) => {
      if (result.isConfirmed) {
        axiosProtect
          .delete(`/stockAudit/revert/${item.productID}`)
          .then((res) => {
            if (res.data.success) {
              setReFetch(!reFetch);
              Swal.fire({
                text: "Item returned to Recheck Stock successfully",
                icon: "success",
              });
            } else {
              toast.error(res.data?.message || "Failed to revert item");
            }
          })
          .catch((err) => {
            toast.error(err.response?.data?.message || "Server error while reverting");
          });
      }
    });
  };

  // Excel Export
  const downloadExcel = () => {
    const formattedData = downloadList.map((item) => ({
      "Product ID": item.productID,
      "Product Name": item.productTitle,
      "Counted Qty": parseFloat(item.countedQuantity || 0).toFixed(2),
      "System Qty": parseFloat(item.systemQuantity || 0).toFixed(2),
      Variance: parseFloat(item.differenceQuantity || 0).toFixed(2),
      Unit: item.purchaseUnit,
      "Purchase Price": parseFloat(item.purchasePrice || 0).toFixed(2),
      "Sales Price": parseFloat(item.salesPrice || 0).toFixed(2),
      "Total Value": (
        parseFloat(item.countedQuantity || 0) *
        parseFloat(item.purchasePrice || 0)
      ).toFixed(2),
      Category: item.category,
      Brand: item.brand,
      Storage: item.storage,
      "Confirmed At": moment(item.confirmedAt).format("DD/MM/YYYY hh:mm A"),
      "Confirmed By": item.confirmedBy,
    }));

    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Confirmed_Stock");
    XLSX.writeFile(workbook, "confirmed_stock.xlsx");
  };

  // PDF Export
  const downloadPDF = () => {
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    const tableColumn = [
      "Product ID",
      "Product Name",
      "Counted",
      "System",
      "Unit",
      "Purchase Price",
      "Sales Price",
      "Total Value",
      "Storage",
      "Confirmed At",
      "By",
    ];
    const tableRows = [];

    downloadList.forEach((item) => {
      const rowData = [
        item.productID,
        item.productTitle,
        parseFloat(item.countedQuantity || 0).toFixed(2),
        parseFloat(item.systemQuantity || 0).toFixed(2),
        item.purchaseUnit,
        parseFloat(item.purchasePrice || 0).toFixed(2),
        parseFloat(item.salesPrice || 0).toFixed(2),
        (
          parseFloat(item.countedQuantity || 0) *
          parseFloat(item.purchasePrice || 0)
        ).toFixed(2),
        item.storage,
        moment(item.confirmedAt).format("DD/MM/YY hh:mm A"),
        item.confirmedBy,
      ];
      tableRows.push(rowData);
    });

    doc.text("Confirmed Stock List Report", 14, 15);
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 20,
      styles: { fontSize: 8 },
    });
    doc.save("confirmed_stock.pdf");
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
    <div className="px-4">
      {/* Header */}
      <div className="mt-5 pb-5">
        <div className="flex items-center justify-between">
          <div className="flex gap-2 items-center">
            <h2 className="text-2xl font-bold uppercase">Confirmed Stock</h2>
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
              <th className="text-center">Counted Qty</th>
              <th className="text-center">System Qty</th>
              <th>Unit</th>
              <th className="text-center">Price</th>
              <th className="text-center">Total Value</th>
              <th className="text-center">Storage</th>
              <th className="text-center">Confirmed Date</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="10" className="text-center py-5">
                  Loading...
                </td>
              </tr>
            ) : confirmedList.length > 0 ? (
              confirmedList.map((item) => (
                <tr key={item._id}>
                  <td>{item.productID}</td>
                  <td>{item.productTitle}</td>
                  <td className="text-center font-bold">
                    {parseFloat(item.countedQuantity).toFixed(2)}
                  </td>
                  <td className="text-center">
                    {parseFloat(item.systemQuantity).toFixed(2)}
                  </td>
                  <td>{item.purchaseUnit}</td>
                  <td className="text-center">
                    {parseFloat(item.purchasePrice).toFixed(2)}
                  </td>
                  <td className="text-center font-bold">
                    {(item.countedQuantity * item.purchasePrice).toFixed(2)}
                  </td>
                  <td className="text-center">{item.storage}</td>
                  <td className="text-center text-xs">
                    {moment(item.confirmedAt).format("DD/MM/YYYY hh:mm A")}
                  </td>
                  <td>
                    <div className="flex items-center text-xl w-full gap-3">
                      <button
                        onClick={() => handleRevert(item)}
                        className="text-amber-500 hover:text-amber-700 cursor-pointer"
                        title="Revert to Recheck"
                      >
                        <IoArrowUndoOutline />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="10" className="text-center py-5">
                  No confirmed stock records yet
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

export default ConfirmedStock;
