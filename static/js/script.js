$(document).ready(function () {

    // ============================
    // LIVE SEARCH
    // ============================

    $("#searchBox").on("keyup", function () {

        let keyword = $(this).val().trim();

        if (keyword === "") {

            $("#tableBody").html(`
                <tr>
                    <td colspan="11" class="text-center">
                        Search Truck Number...
                    </td>
                </tr>
            `);

            $("#resultCount").text("0");

            return;
        }

        $.ajax({

            url: "/search",

            type: "GET",

            data: {
                q: keyword
            },

            success: function (data) {

                $("#resultCount").text(data.length);

                let html = "";

                if (data.length === 0) {

                    html = `
                        <tr>
                            <td colspan="11" class="text-center text-danger">
                                No Records Found
                            </td>
                        </tr>
                    `;

                    $("#tableBody").html(html);

                    return;
                }

                data.forEach(function (row) {

                    let rowClass = "";

                    if (row.match_type === "exact") {

                        rowClass = "table-warning";

                    } else if (row.match_type === "partial") {

                        rowClass = "table-success";

                    } else {

                        rowClass = "table-info";

                    }

                    html += `<tr class="${rowClass}">`;

                    html += `<td>${row["SLNO"] || ""}</td>`;

                    html += `<td>${row["DOC RCVD DATE"] || ""}</td>`;

                    html += `<td>${row["DRIVER NAME"] || ""}</td>`;

                    html += `<td>${row["ID NO"] || ""}</td>`;

                    // ============================
                    // TRUCK NO HIGHLIGHT
                    // ============================

                    let truckNo = row["TRUCK NO"] || "";

                    if (row.match_type === "exact") {

                        truckNo = `<span class="exact-match">${truckNo}</span>`;

                    } else if (row.match_type === "partial") {

                        truckNo = `<span class="partial-match">${truckNo}</span>`;

                    }

                    html += `<td>${truckNo}</td>`;

                    html += `<td>${row["TRAILER NO"] || ""}</td>`;

                    html += `<td>${row["TRANSPORTOR"] || ""}</td>`;

                    html += `<td>${row["SUB"] || ""}</td>`;

                    // ============================
                    // STATUS BADGE
                    // ============================

                    let status = row["STATUS"] || "";

                    let statusClass = "bg-secondary";

                    if (status.toUpperCase().includes("SUBMITTED")) {

                        statusClass = "bg-primary";

                    } else if (status.toUpperCase().includes("LOADED")) {

                        statusClass = "bg-success";

                    } else if (status.toUpperCase().includes("REACHED")) {

                        statusClass = "bg-warning text-dark";

                    }

                    html += `
                        <td>
                            <span class="badge ${statusClass}">
                                ${status}
                            </span>
                        </td>
                    `;

                    html += `<td>${row["REACHED"] || ""}</td>`;

                    html += `<td>${row["LOADED"] || ""}</td>`;

                    html += `</tr>`;

                });

                $("#tableBody").html(html);

            },

            error: function () {

                $("#tableBody").html(`
                    <tr>
                        <td colspan="11" class="text-center text-danger">
                            Error loading data.
                        </td>
                    </tr>
                `);

            }

        });

    });

    // ============================
    // DOWNLOAD BUTTON
    // ============================

    $("#downloadBtn").click(function () {

        let keyword = $("#searchBox").val().trim();

        if (keyword === "") {

            alert("Please enter a Truck No, Trailer No or Transportor.");

            return;

        }

        window.location.href = "/download?q=" + encodeURIComponent(keyword);

    });

});