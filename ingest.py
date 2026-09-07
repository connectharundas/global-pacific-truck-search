import pandas as pd

from models import Record, db
from utils import normalize, clean_columns

FIXED_COLUMN_MAP = {
    "sl_no": "SL NO",
    "doc_rcvd_date": "DOC RCVD DATE",
    "driver_name": "DRIVER NAME",
    "id_no": "ID NO",
    "truck": "TRUCK",
    "trailer": "TRAILER",
    "transportor": "TRANSPORTOR",
    "sub": "SUB",
    "status": "STATUS",
    "reached": "REACHED",
    "loaded": "LOADED",
}


def replace_all_records(file_stream):
    """Parse an uploaded .xlsx file and replace all Record rows with its contents.

    Returns the number of rows inserted.
    """

    df = pd.read_excel(file_stream, dtype=str)

    df.fillna("", inplace=True)

    df.columns = clean_columns(df.columns)

    records = []

    for _, row in df.iterrows():
        raw = row.to_dict()

        truck = str(raw.get("TRUCK", ""))
        trailer = str(raw.get("TRAILER", ""))

        records.append(Record(
            sl_no=str(raw.get(FIXED_COLUMN_MAP["sl_no"], "")),
            doc_rcvd_date=str(raw.get(FIXED_COLUMN_MAP["doc_rcvd_date"], "")),
            driver_name=str(raw.get(FIXED_COLUMN_MAP["driver_name"], "")),
            id_no=str(raw.get(FIXED_COLUMN_MAP["id_no"], "")),
            truck=truck,
            normalized_truck=normalize(truck),
            trailer=trailer,
            normalized_trailer=normalize(trailer),
            transportor=str(raw.get(FIXED_COLUMN_MAP["transportor"], "")),
            sub=str(raw.get(FIXED_COLUMN_MAP["sub"], "")),
            status=str(raw.get(FIXED_COLUMN_MAP["status"], "")),
            reached=str(raw.get(FIXED_COLUMN_MAP["reached"], "")),
            loaded=str(raw.get(FIXED_COLUMN_MAP["loaded"], "")),
            raw_data=raw,
        ))

    Record.query.delete()
    db.session.bulk_save_objects(records)
    db.session.commit()

    return len(records)
