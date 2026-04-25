from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db
from ..deps import current_admin
from ..services import excel_export


router = APIRouter(prefix="/export", tags=["export"])


@router.post("/excel")
def export_excel(
    body: schemas.ExportIn,
    db: Session = Depends(get_db),
    _: models.AdminUser = Depends(current_admin),
):
    data = excel_export.build_workbook(db, body)
    filename = f"survey-export-{datetime.now():%Y%m%d-%H%M%S}.xlsx"
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
