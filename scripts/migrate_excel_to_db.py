"""One-time import of data/sampledata.xlsx into the database.

Usage: python scripts/migrate_excel_to_db.py [path/to/file.xlsx]
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
from ingest import replace_all_records

DEFAULT_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "sampledata.xlsx")


def main():
    file_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_FILE

    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        sys.exit(1)

    with app.app_context():
        from models import db
        db.create_all()

        with open(file_path, "rb") as f:
            count = replace_all_records(f)

        print(f"Imported {count} records from {file_path}")


if __name__ == "__main__":
    main()
