import os

from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
import uvicorn

EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
PORT = int(os.getenv("PORT", "8001"))

app = FastAPI()
# Load the model once at startup to keep requests fast and consistent.
model = SentenceTransformer(EMBEDDING_MODEL)


class TextData(BaseModel):
    text: str


@app.get("/health")
def health_check() -> dict:
    return {"status": "ok"}


@app.post("/embed")
def get_embedding(data: TextData) -> dict:
    vector = model.encode(data.text).tolist()
    return {"embedding": vector}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=PORT)
