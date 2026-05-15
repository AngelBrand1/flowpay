from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from flowpay.auth.adapters.router import router as auth_router
from flowpay.ledger.adapters.router import router as ledger_router
from flowpay.transfers.adapters.router import router as transfers_router
from flowpay.shared.errors import FlowPayHTTPError

app = FastAPI(title="FlowPay API", version="0.1.0")

app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(ledger_router, tags=["wallet"])
app.include_router(transfers_router, tags=["transfers"])


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.exception_handler(FlowPayHTTPError)
async def handle_flowpay_error(_: Request, exc: FlowPayHTTPError):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message": exc.message}},
    )


@app.exception_handler(RequestValidationError)
async def handle_validation_error(_: Request, __: RequestValidationError):
    return JSONResponse(
        status_code=400,
        content={"error": {"code": "invalid_request", "message": "Validation failed"}},
    )
