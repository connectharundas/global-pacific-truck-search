from flask import Flask, render_template, request, jsonify, send_file
import pandas as pd
import os
import io
import re

app = Flask(__name__)

# ==========================================================
# CONFIGURATION
# ==========================================================

EXCEL_FILE = "data/sampledata.xlsx"

# Columns shown in the website
DISPLAY_COLUMNS = [
    "SL NO",
    "DOC RCVD DATE",
    "DRIVER NAME",
    "ID NO",
    "TRUCK",
    "TRAILER",
    "TRANSPORTOR",
    "SUB",
    "STATUS",
    "REACHED",
    "LOADED"
]

STATUS_TABS = ["All", "In Transit", "Reached", "Loaded", "Pending"]


# ==========================================================
# LOAD EXCEL
# ==========================================================

def load_excel():

    if not os.path.exists(EXCEL_FILE):
        return pd.DataFrame()

    df = pd.read_excel(
        EXCEL_FILE,
        dtype=str
    )

    df.fillna("", inplace=True)

    # Remove unwanted spaces from column names
    df.columns = (
        df.columns
        .str.replace("\n", " ", regex=False)
        .str.replace("\r", " ", regex=False)
        .str.strip()
    )

    return df


# ==========================================================
# NORMALIZE
# ==========================================================

def normalize(value):

    value = str(value).upper().strip()

    value = value.replace(" ", "")

    # Remove leading hyphen
    value = re.sub(r"^-+", "", value)

    # Remove trailing hyphen
    value = re.sub(r"-+$", "", value)

    return value


# ==========================================================
# MATCH TYPE
# ==========================================================

def get_match_type(keyword, value):

    keyword = normalize(keyword)

    value = normalize(value)

    if keyword == value:
        return "exact"

    if keyword in value:
        return "partial"

    return None


# ==========================================================
# COMPUTED STATUS (drives badges + filter tabs)
# ==========================================================

def compute_status(row):

    if str(row.get("LOADED", "")).strip():
        return "Loaded"

    if str(row.get("REACHED", "")).strip():
        return "Reached"

    if str(row.get("STATUS", "")).strip().upper() == "SUBMITTED":
        return "In Transit"

    return "Pending"


# ==========================================================
# BUILD DISPLAY ITEM
# ==========================================================

def build_item(row, match_type=None, matched_column=None):

    item = {}

    for col in DISPLAY_COLUMNS:
        item[col] = row.get(col, "")

    item["COMPUTED_STATUS"] = compute_status(row)

    if match_type:
        item["match_type"] = match_type

    if matched_column:
        item["matched_column"] = matched_column

    return item


# ==========================================================
# SEARCH + FILTER EXCEL
# ==========================================================

def search_excel(keyword, status_filter="All"):

    keyword_normalized = normalize(keyword)

    df = load_excel()

    if df.empty:
        return []

    exact_results = []

    partial_results = []

    for _, row in df.iterrows():

        if status_filter != "All" and compute_status(row) != status_filter:
            continue

        if keyword_normalized == "":

            exact_results.append(build_item(row))

            continue

        truck = str(row.get("TRUCK", ""))

        trailer = str(row.get("TRAILER", ""))

        truck_match = get_match_type(keyword, truck)

        trailer_match = get_match_type(keyword, trailer)

        # ==================================================
        # EXACT TRUCK MATCH
        # ==================================================

        if truck_match == "exact":

            exact_results.append(build_item(row, "exact", "TRUCK"))

            continue


        # ==================================================
        # EXACT TRAILER MATCH
        # ==================================================

        if trailer_match == "exact":

            exact_results.append(build_item(row, "exact", "TRAILER"))

            continue


        # ==================================================
        # PARTIAL TRUCK MATCH
        # ==================================================

        if truck_match == "partial":

            partial_results.append(build_item(row, "partial", "TRUCK"))

            continue


        # ==================================================
        # PARTIAL TRAILER MATCH
        # ==================================================

        if trailer_match == "partial":

            partial_results.append(build_item(row, "partial", "TRAILER"))

            continue


    # Exact matches first
    results = exact_results + partial_results

    return results


# ==========================================================
# HOME PAGE
# ==========================================================

@app.route("/")
def index():

    df = load_excel()

    return render_template(

        "index.html",

        total_records=len(df),

        columns=DISPLAY_COLUMNS,

        status_tabs=STATUS_TABS

    )


# ==========================================================
# AJAX SEARCH / LIST / FILTER
# ==========================================================

@app.route("/search")
def search():

    keyword = request.args.get("q", "").strip()

    status_filter = request.args.get("status", "All").strip()

    if status_filter not in STATUS_TABS:
        status_filter = "All"

    results = search_excel(keyword, status_filter)

    return jsonify(results)

# ==========================================================
# DOWNLOAD SEARCH RESULT
# ==========================================================

@app.route("/download")
def download():

    keyword = request.args.get("q", "").strip()

    status_filter = request.args.get("status", "All").strip()

    if status_filter not in STATUS_TABS:
        status_filter = "All"

    if keyword == "" and status_filter == "All":
        return jsonify({"error": "Search keyword or filter required"}), 400

    df = load_excel()

    keyword_normalized = normalize(keyword)

    export_rows = []

    for _, row in df.iterrows():

        if status_filter != "All" and compute_status(row) != status_filter:
            continue

        truck = normalize(row.get("TRUCK", ""))
        trailer = normalize(row.get("TRAILER", ""))

        if (
            keyword_normalized == ""
            or keyword_normalized in truck
            or keyword_normalized in trailer
        ):

            export_rows.append(row.to_dict())

    export_df = pd.DataFrame(export_rows)

    output = io.BytesIO()

    with pd.ExcelWriter(output, engine="openpyxl") as writer:

        export_df.to_excel(
            writer,
            index=False,
            sheet_name="Search Result"
        )

    output.seek(0)

    label = keyword if keyword else status_filter.replace(" ", "_")

    return send_file(
        output,
        as_attachment=True,
        download_name=f"Truck_Search_{label}.xlsx",
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )


# ==========================================================
# TOTAL RECORDS API
# ==========================================================

@app.route("/total")
def total():

    df = load_excel()

    return jsonify({

        "total_records": len(df)

    })


# ==========================================================
# HEALTH CHECK
# ==========================================================

@app.route("/health")
def health():

    df = load_excel()

    return jsonify({

        "status": "running",

        "records": len(df),

        "excel_file": EXCEL_FILE

    })


# ==========================================================
# APPLICATION START
# ==========================================================

if __name__ == "__main__":

    app.run(

        host="0.0.0.0",

        port=int(os.environ.get("PORT", 5000)),

        debug=False

    )
