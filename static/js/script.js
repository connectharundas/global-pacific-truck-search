document.addEventListener("DOMContentLoaded", function () {

    const searchBox = document.getElementById("searchBox");
    const resultList = document.getElementById("resultList");
    const resultCount = document.getElementById("resultCount");
    const downloadBtn = document.getElementById("downloadBtn");
    const tabButtons = document.querySelectorAll(".tab-btn");
    const modalOverlay = document.getElementById("detailModal");
    const modalBody = document.getElementById("detailModalBody");
    const modalClose = document.getElementById("detailModalClose");

    let currentStatus = "All";
    let currentRows = [];
    let debounceTimer = null;

    const BADGE_PALETTE = [
        "badge-color-1",
        "badge-color-2",
        "badge-color-3",
        "badge-color-4",
        "badge-color-5"
    ];

    const STATUS_BADGE_MAP = {
        "RECEIVED": "badge-color-received",
        "RECIEVED": "badge-color-received",
        "SUBMITTED": "badge-color-submitted",
        "ALREADY HAVING": "badge-color-already-having"
    };

    function badgeClassFor(status) {
        const normalized = status.trim().toUpperCase();

        if (STATUS_BADGE_MAP[normalized]) {
            return STATUS_BADGE_MAP[normalized];
        }

        let hash = 0;
        for (let i = 0; i < status.length; i++) {
            hash = (hash * 31 + status.charCodeAt(i)) >>> 0;
        }
        return BADGE_PALETTE[hash % BADGE_PALETTE.length];
    }

    function gatePassClassFor(dateStr) {
        if (!dateStr) {
            return "";
        }
        const parsed = new Date(dateStr);
        if (isNaN(parsed.getTime())) {
            return "";
        }
        return parsed.getTime() < Date.now() ? "gatepass-expired" : "gatepass-valid";
    }

    function renderCards(rows) {

        currentRows = rows;
        resultCount.textContent = rows.length;

        if (rows.length === 0) {
            resultList.innerHTML = `<div class="empty-state">No Records Found</div>`;
            return;
        }

        let html = "";

        rows.forEach(function (row, index) {

            const status = row["STATUS"] || "-";
            const statusClass = badgeClassFor(status);
            const isExact = row["match_type"] === "exact";
            const gatePassRaw = row["ALL_FIELDS"] ? row["ALL_FIELDS"]["GATE PASS EXPIRE DATE"] : "";
            const gatePassClass = gatePassClassFor(gatePassRaw);

            html += `
                <div class="truck-card${isExact ? " match-exact" : ""}" data-row-index="${index}">
                    <div class="truck-card-top">
                        <div class="truck-no">${row["TRUCK"] || ""}</div>
                        <span class="status-badge ${statusClass}">${status}</span>
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
                            <div class="field-label">Gate Pass Expiry</div>
                            <div class="field-value ${gatePassClass}">${gatePassRaw || "-"}</div>
                        </div>
                        <div>
                            <div class="field-label">Reached</div>
                            <div class="field-value">${row["REACHED"] || "-"}</div>
                        </div>
                    </div>
                    <div class="truck-card-hint">Tap to view more details</div>
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
    // DRILL-DOWN MODAL
    // ============================

    function openDetail(row) {

        const fields = row["ALL_FIELDS"] || {};
        const keys = Object.keys(fields);

        let html = "";

        keys.forEach(function (key) {
            html += `
                <div class="detail-row">
                    <div class="detail-label">${key}</div>
                    <div class="detail-value">${fields[key] || "-"}</div>
                </div>
            `;
        });

        modalBody.innerHTML = html;
        modalOverlay.classList.add("open");
    }

    function closeDetail() {
        modalOverlay.classList.remove("open");
    }

    resultList.addEventListener("click", function (e) {
        const card = e.target.closest(".truck-card");
        if (!card) {
            return;
        }
        const index = Number(card.dataset.rowIndex);
        const row = currentRows[index];
        if (row) {
            openDetail(row);
        }
    });

    modalClose.addEventListener("click", closeDetail);

    modalOverlay.addEventListener("click", function (e) {
        if (e.target === modalOverlay) {
            closeDetail();
        }
    });

    // ============================
    // INITIAL LOAD
    // ============================

    fetchResults();

});
