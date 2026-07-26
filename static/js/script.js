document.addEventListener("DOMContentLoaded", function () {

    const searchBox = document.getElementById("searchBox");
    const resultList = document.getElementById("resultList");
    const resultCount = document.getElementById("resultCount");
    const downloadBtn = document.getElementById("downloadBtn");
    const tabButtons = document.querySelectorAll(".tab-btn");

    let currentStatus = "All";
    let debounceTimer = null;

    const STATUS_CLASS = {
        "In Transit": "status-in-transit",
        "Reached": "status-reached",
        "Loaded": "status-loaded",
        "Pending": "status-pending"
    };

    function renderCards(rows) {

        resultCount.textContent = rows.length;

        if (rows.length === 0) {
            resultList.innerHTML = `<div class="empty-state">No Records Found</div>`;
            return;
        }

        let html = "";

        rows.forEach(function (row, index) {

            const status = row["COMPUTED_STATUS"] || "Pending";
            const statusClass = STATUS_CLASS[status] || "status-pending";
            const isExact = row["match_type"] === "exact";

            html += `
                <div class="truck-card${isExact ? " match-exact" : ""}">
                    <div class="truck-card-top">
                        <div class="truck-no">${row["TRUCK"] || ""}</div>
                        <div class="truck-index">#${index + 1}</div>
                    </div>
                    <div class="trailer-no">Trailer ${row["TRAILER"] || "-"}</div>
                    <div class="truck-card-grid">
                        <div>
                            <div class="field-label">Driver</div>
                            <div class="field-value">${row["DRIVER NAME"] || "-"}</div>
                        </div>
                        <div>
                            <div class="field-label">ID No</div>
                            <div class="field-value">${row["ID NO"] || "-"}</div>
                        </div>
                        <div>
                            <div class="field-label">Transporter</div>
                            <div class="field-value">${row["TRANSPORTOR"] || "-"}</div>
                        </div>
                        <div>
                            <div class="field-label">Sub</div>
                            <div class="field-value">${row["SUB"] || "-"}</div>
                        </div>
                        <div>
                            <div class="field-label">Doc Rcvd</div>
                            <div class="field-value">${row["DOC RCVD DATE"] || "-"}</div>
                        </div>
                        <div>
                            <div class="field-label">Reached</div>
                            <div class="field-value">${row["REACHED"] || "-"}</div>
                        </div>
                    </div>
                    <div class="truck-card-badges">
                        <span class="status-badge ${statusClass}">${status}</span>
                    </div>
                </div>
            `;

        });

        resultList.innerHTML = html;
    }

    function fetchResults() {

        const keyword = searchBox.value.trim();

        fetch(`/search?q=${encodeURIComponent(keyword)}&status=${encodeURIComponent(currentStatus)}`)
            .then(function (res) {
                return res.json();
            })
            .then(function (data) {
                renderCards(data);
            })
            .catch(function () {
                resultList.innerHTML = `<div class="empty-state">Error loading data.</div>`;
            });
    }

    // ============================
    // LIVE SEARCH (debounced)
    // ============================

    searchBox.addEventListener("input", function () {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(fetchResults, 200);
    });

    // ============================
    // FILTER TABS
    // ============================

    tabButtons.forEach(function (btn) {
        btn.addEventListener("click", function () {
            tabButtons.forEach(function (b) {
                b.classList.remove("active");
            });
            btn.classList.add("active");
            currentStatus = btn.dataset.status;
            fetchResults();
        });
    });

    // ============================
    // DOWNLOAD BUTTON
    // ============================

    downloadBtn.addEventListener("click", function () {

        const keyword = searchBox.value.trim();

        if (keyword === "" && currentStatus === "All") {
            alert("Please enter a search term or select a filter.");
            return;
        }

        window.location.href = `/download?q=${encodeURIComponent(keyword)}&status=${encodeURIComponent(currentStatus)}`;
    });

    // ============================
    // INITIAL LOAD
    // ============================

    fetchResults();

});
