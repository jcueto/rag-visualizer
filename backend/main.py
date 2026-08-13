import os
import uuid
from typing import Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import uvicorn

import document_processor
from rag_engine import rag_engine
import llm_client

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOADS_DIR = "uploads"
os.makedirs(UPLOADS_DIR, exist_ok=True)

class ChatRequest(BaseModel):
    message: str

@app.post("/api/upload")
async def upload_document(
    file: Optional[UploadFile] = File(None),
    raw_text: Optional[str] = Form(None),
    title: Optional[str] = Form(None)
):
    if not file and not raw_text:
        raise HTTPException(status_code=400, detail="Must provide either a file or raw_text")
        
    doc_id = str(uuid.uuid4())
    text_content = ""
    doc_type = "raw"
    doc_title = title or "Untitled Document"

    if file:
        file_path = os.path.join(UPLOADS_DIR, file.filename)
        with open(file_path, "wb") as buffer:
            buffer.write(await file.read())
            
        ext = file.filename.split('.')[-1].lower()
        if ext == 'pdf':
            text_content = document_processor.extract_text_from_pdf(file_path)
            doc_type = "pdf"
        elif ext == 'docx':
            text_content = document_processor.extract_text_from_docx(file_path)
            doc_type = "docx"
        elif ext == 'txt':
            text_content = document_processor.extract_text_from_txt(file_path)
            doc_type = "txt"
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format")
            
        doc_title = title or file.filename
    else:
        text_content = raw_text
        doc_type = "raw"

    chunks = document_processor.chunk_text(text_content)
    
    metadata = {
        "title": doc_title,
        "type": doc_type
    }
    
    rag_engine.add_document(doc_id, chunks, metadata)
    
    registry = rag_engine.get_all_documents()
    for d in registry:
        if d['id'] == doc_id:
            return d
            
    return {"id": doc_id, "title": doc_title, "type": doc_type, "chunks": len(chunks)}

@app.get("/api/documents")
async def get_documents():
    docs = rag_engine.get_all_documents()
    return {"documents": docs, "total": len(docs)}

@app.delete("/api/documents/{doc_id}")
async def delete_document(doc_id: str):
    rag_engine.remove_document(doc_id)
    return {"success": True, "message": "Document removed"}

@app.post("/api/chat")
async def chat(req: ChatRequest):
    question = req.message
    
    std_resp = llm_client.get_standard_response(question)
    
    doc_count = rag_engine.get_document_count()
    if doc_count == 0:
        return {
            "standard_response": {"text": std_resp},
            "rag_response": {
                "text": "No documents uploaded yet.",
                "sources": [],
                "is_relevant": False
            }
        }
        
    results = rag_engine.query(question, n_results=5)
    
    context_chunks = []
    sources = []
    
    if results and results.get("documents") and len(results["documents"]) > 0:
        for i, chunk_list in enumerate(results["documents"]):
            for j, chunk in enumerate(chunk_list):
                context_chunks.append(chunk)
                meta = results["metadatas"][i][j] if results.get("metadatas") else {}
                sources.append({
                    "doc_title": meta.get("title", "Unknown"),
                    "chunk_preview": chunk[:100] + "..."
                })
                
    topic_summary = rag_engine.get_topic_summary()
    
    rag_resp_data = llm_client.get_rag_response(question, context_chunks, sources, topic_summary)
    
    return {
        "standard_response": {"text": std_resp},
        "rag_response": {
            "text": rag_resp_data.get("text", ""),
            "sources": sources,
            "is_relevant": rag_resp_data.get("is_relevant", True)
        }
    }

@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "documents_count": rag_engine.get_document_count()
    }

frontend_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")
if os.path.exists(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")
else:
    print(f"Warning: Frontend directory {frontend_path} not found. Static files will not be served.")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
