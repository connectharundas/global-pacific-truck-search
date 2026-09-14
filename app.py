import os
from functools import wraps

import pandas as pd
import io

from flask import Flask, render_template, request, jsonify, send_file, session, redirect, url_for, flash
from dotenv import load_dotenv

from models import db, Record, DISPLAY_COLUMNS
from utils import normalize, get_match_type, date_only, LOADED_TAB
from ingest import replace_all_records

load_dotenv()

app = Flask(__name__)

app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-secret-key")
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ["DATABASE_URL"]
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {"pool_pre_ping": True}
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024  # 16MB upload limit

ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")

db.init_app(app)


# ==========================================================
# STATUS TABS
# ==========================================================

def get_status_tabs():

    tabs = ["All"]

    values = (
        db.session.query(Record.status)
        .filter(Record.status != "")
        .distinct()
        .order_by(Record.status)
        .all()
    )

    tabs += [v[0] for v in values]

    tabs.append(LOADED_TAB)

    return tabs


def row_matches_status(record, status_filter):

    if status_filter == "All":
        return True

    if status_filter == LOADED_TAB:
        return bool(str(record.loaded or "").strip())

    return str(record.status or "").strip() == status_filter


# ==========================================================
# SEARCH + FILTER
# ==========================================================

def search_records(keyword, status_filter="All"):

    keyword_normalized = normalize(keyword)

    query = Record.query

    if status_filter not in ("All", LOADED_TAB):
        query = query.filter(Record.status == status_filter)

    exact_results = []
    partial_results = []

    for record in query.all():

        if not row_matches_status(record, status_filter):
            continue

        if keyword_normalized == "":
            exact_results.append(record.to_display_dict())
            continue

        truck_match = get_match_type(keyword, record.truck or "")
        trailer_match = get_match_type(keyword, record.trailer or "")

        if truck_match == "exact":
            item = record.to_display_dict()
            item["match_type"] = "exact"
            item["matched_column"] = "TRUCK"
            exact_results.append(item)
            continue

        if trailer_match == "exact":
            item = record.to_display_dict()
            item["match_type"] = "exact"
            item["matched_column"] = "TRAILER"
            exact_results.append(item)
            continue

        if truck_match == "partial":
            item = record.to_display_dict()
            item["match_type"] = "partial"
            item["matched_column"] = "TRUCK"
            partial_results.append(item)
            continue

        if trailer_match == "partial":
            item = record.to_display_dict()
            item["match_type"] = "partial"
            item["matched_column"] = "TRAILER"
            partial_results.append(item)
            continue

    return exact_results + partial_results


# ==========================================================
# ADMIN AUTH
# ==========================================================

def login_required(view):

    @wraps(view)
    def wrapped(*args, **kwargs):

        if not session.get("admin"):
            return redirect(url_for("admin_login"))

        return view(*args, **kwargs)

    return wrapped


@app.route("/admin/login", methods=["GET", "POST"])
def admin_login():

    if request.method == "POST":

        password = request.form.get("password", "")

        if ADMIN_PASSWORD and password == ADMIN_PASSWORD:
            session["admin"] = True
            return redirect(url_for("admin_upload"))

        flash("Incorrect password")

    return render_template("admin_login.html")


@app.route("/admin/logout")
def admin_logout():

    session.pop("admin", None)

    return redirect(url_for("admin_login"))


@app.route("/admin/upload", methods=["GET", "POST"])
@login_required
def admin_upload():

    if request.method == "POST":

        file = request.files.get("file")

        if not file or not file.filename.lower().endswith(".xlsx"):
            flash("Please upload a valid .xlsx file")
            return redirect(url_for("admin_upload"))

        try:
            count = replace_all_records(file.stream)
            flash(f"Uploaded successfully — {count} records loaded.")
        except Exception as exc:
            db.session.rollback()
            flash(f"Upload failed: {exc}")

        return redirect(url_for("admin_upload"))

    return render_template("admin_upload.html", total_records=Record.query.count())


# ==========================================================
# HOME PAGE
# ==========================================================

@app.route("/")
def index():

    return render_template(

        "index.html",

        total_records=Record.query.count(),

        columns=DISPLAY_COLUMNS,

        status_tabs=get_status_tabs()

    )


# ==========================================================
# AJAX SEARCH / LIST / FILTER
# ==========================================================

@app.route("/search")
def search():

    keyword = request.args.get("q", "").strip()

    status_filter = request.args.get("status", "All").strip()

    results = search_records(keyword, status_filter)

    return jsonify(results)

# ==========================================================
# DOWNLOAD SEARCH RESULT
# ==========================================================

@app.route("/download")
def download():

    keyword = request.args.get("q", "").strip()

    status_filter = request.args.get("status", "All").strip()

    loaded_date = request.args.get("loaded_date", "").strip()

    if keyword == "" and status_filter == "All" and loaded_date == "":
        return jsonify({"error": "Search keyword, filter, or loaded date required"}), 400

    keyword_normalized = normalize(keyword)

    query = Record.query

    if status_filter not in ("All", LOADED_TAB):
        query = query.filter(Record.status == status_filter)

    export_rows = []

    for record in query.all():

        if not row_matches_status(record, status_filter):
            continue

        if loaded_date and date_only(record.loaded or "") != loaded_date:
            continue

        truck = normalize(record.truck or "")
        trailer = normalize(record.trailer or "")

        if (
            keyword_normalized == ""
            or keyword_normalized in truck
            or keyword_normalized in trailer
        ):
            export_rows.append(record.raw_data or {})

    export_df = pd.DataFrame(export_rows)

    output = io.BytesIO()

    with pd.ExcelWriter(output, engine="openpyxl") as writer:

        export_df.to_excel(
            writer,
            index=False,
            sheet_name="Search Result"
        )

    output.seek(0)

    label = keyword or loaded_date or status_filter.replace(" ", "_")

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

    return jsonify({

        "total_records": Record.query.count()

    })


# ==========================================================
# HEALTH CHECK
# ==========================================================

@app.route("/health")
def health():

    try:
        db.session.execute(db.select(db.func.count()).select_from(Record))
        db_status = "connected"
    except Exception:
        db_status = "unavailable"

    return jsonify({

        "status": "running",

        "records": Record.query.count() if db_status == "connected" else None,

        "database": db_status

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
