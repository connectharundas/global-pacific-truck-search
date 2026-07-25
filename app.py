from flask import Flask, render_template, request, jsonify, send_file
import pandas as pd
import os
import io
import re

app = Flask(__name__)

# ==========================================================
# CONFIGURATION
# ==========================================================

EXCEL_FILE = "data/trucks.xlsx"

# Columns shown in the website
DISPLAY_COLUMNS = [
    "SLNO",
    "DOC RCVD DATE",
    "DRIVER NAME",
    "ID NO",
    "TRUCK NO",
    "TRAILER NO",
    "TRANSPORTOR",
    "SUB",
    "STATUS",
    "REACHED",
    "LOADED"
]


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
# SEARCH EXCEL
# ==========================================================

def search_excel(keyword):

    keyword = normalize(keyword)

    df = load_excel()

    if df.empty:
        return []

    exact_results = []

    partial_results = []

    for _, row in df.iterrows():

        truck = str(row.get("TRUCK NO", ""))

        trailer = str(row.get("TRAILER NO", ""))

        transportor = str(row.get("TRANSPORTOR", ""))

        truck_match = get_match_type(keyword, truck)

        trailer_match = get_match_type(keyword, trailer)

        transport_match = get_match_type(keyword, transportor)
                # ==================================================
        # EXACT TRUCK MATCH
        # ==================================================

        if truck_match == "exact":

            item = {}

            for col in DISPLAY_COLUMNS:
                item[col] = row.get(col, "")

            item["match_type"] = "exact"
            item["matched_column"] = "TRUCK NO"

            exact_results.append(item)

            continue


        # ==================================================
        # EXACT TRAILER MATCH
        # ==================================================

        if trailer_match == "exact":

            item = {}

            for col in DISPLAY_COLUMNS:
                item[col] = row.get(col, "")

            item["match_type"] = "exact"
            item["matched_column"] = "TRAILER NO"

            exact_results.append(item)

            continue


        # ==================================================
        # PARTIAL TRUCK MATCH
        # ==================================================

        if truck_match == "partial":

            item = {}

            for col in DISPLAY_COLUMNS:
                item[col] = row.get(col, "")

            item["match_type"] = "partial"
            item["matched_column"] = "TRUCK NO"

            partial_results.append(item)

            continue


        # ==================================================
        # PARTIAL TRAILER MATCH
        # ==================================================

        if trailer_match == "partial":

            item = {}

            for col in DISPLAY_COLUMNS:
                item[col] = row.get(col, "")

            item["match_type"] = "partial"
            item["matched_column"] = "TRAILER NO"

            partial_results.append(item)

            continue


        # ==================================================
        # TRANSPORTOR MATCH
        # ==================================================

        if transport_match:

            item = {}

            for col in DISPLAY_COLUMNS:
                item[col] = row.get(col, "")

            item["match_type"] = "transportor"
            item["matched_column"] = "TRANSPORTOR"

            partial_results.append(item)

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

        columns=DISPLAY_COLUMNS

    )


# ==========================================================
# AJAX SEARCH
# ==========================================================

@app.route("/search")
def search():

    keyword = request.args.get("q", "").strip()

    if keyword == "":
        return jsonify([])

    results = search_excel(keyword)

    return jsonify(results)
# ==========================================================
# DOWNLOAD SEARCH RESULT
# ==========================================================

@app.route("/download")
def download():

    keyword = request.args.get("q", "").strip()

    if keyword == "":
        return jsonify({"error": "Search keyword required"}), 400

    df = load_excel()

    keyword_normalized = normalize(keyword)

    export_rows = []

    for _, row in df.iterrows():

        truck = normalize(row.get("TRUCK NO", ""))
        trailer = normalize(row.get("TRAILER NO", ""))
        transportor = normalize(row.get("TRANSPORTOR", ""))

        if (
            keyword_normalized in truck
            or keyword_normalized in trailer
            or keyword_normalized in transportor
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

    return send_file(
        output,
        as_attachment=True,
        download_name=f"Truck_Search_{keyword}.xlsx",
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