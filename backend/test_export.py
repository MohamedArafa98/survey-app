import sys
sys.path.insert(0, r"C:\Users\HCHT7450\Desktop\Survey-app\backend")
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import pandas as pd
from app.db import Base
from app import models, schemas
from app.services import excel_export

# Setup DB connection
engine = create_engine("sqlite:///C:/Users/HCHT7450/AppData/Roaming/SurveyApp/data.db")
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

logging.basicConfig(level=logging.DEBUG)

def main():
    db = SessionLocal()
    try:
        # Get all survey IDs
        surveys = db.query(models.Survey).all()
        if not surveys:
            print("No surveys found.")
            return

        survey_ids = [s.id for s in surveys]
        print(f"Exporting surveys: {survey_ids}")

        req = schemas.ExportIn(
            survey_ids=survey_ids,
            include_aggregates=True,
            include_raw=True,
            include_comparison=False,
            include_occupation_breakdown=False,
            charts=[]
        )

        try:
            excel_bytes = excel_export.build_workbook(db, req)
            print(f"Export successful, generated {len(excel_bytes)} bytes.")
        except Exception as e:
            logging.exception("Export failed")
            
    finally:
        db.close()

if __name__ == "__main__":
    main()
