from fastapi import FastAPI, responses
from pydantic import BaseModel
import uvicorn

app = FastAPI()

class LoginRequest(BaseModel):
    is_authenticated:bool

@app.post("/v1/auth/login")
async def login(request: LoginRequest):
    if request.is_authenticated:
        return responses.JSONResponse({
            "success": True,
            "message": "autenticado pa, como debe de ser"
        }, status_code=200)
    else:
        return responses.JSONResponse({
            "success": False,
            "message": "a tu casa infiltrado"
        }, status_code=404)

if __name__ == "__main__":
    uvicorn.run(app, host="localhost", port=9000)