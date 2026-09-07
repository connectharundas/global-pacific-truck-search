from datetime import datetime

from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

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


class Record(db.Model):
    __tablename__ = "record"

    id = db.Column(db.Integer, primary_key=True)

    sl_no = db.Column(db.String(64))
    doc_rcvd_date = db.Column(db.String(64))
    driver_name = db.Column(db.String(255))
    id_no = db.Column(db.String(64))

    truck = db.Column(db.String(64), index=True)
    normalized_truck = db.Column(db.String(64), index=True)

    trailer = db.Column(db.String(64), index=True)
    normalized_trailer = db.Column(db.String(64), index=True)

    transportor = db.Column(db.String(255))
    sub = db.Column(db.String(255))
    status = db.Column(db.String(64), index=True)
    reached = db.Column(db.String(64))
    loaded = db.Column(db.String(64))

    raw_data = db.Column(db.JSON)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_display_dict(self):
        raw = self.raw_data or {}

        item = {
            "SL NO": self.sl_no,
            "DOC RCVD DATE": self.doc_rcvd_date,
            "DRIVER NAME": self.driver_name,
            "ID NO": self.id_no,
            "TRUCK": self.truck,
            "TRAILER": self.trailer,
            "TRANSPORTOR": self.transportor,
            "SUB": self.sub,
            "STATUS": self.status,
            "REACHED": self.reached,
            "LOADED": self.loaded,
        }

        item["ALL_FIELDS"] = raw

        return item
