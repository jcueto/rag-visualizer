import os
import json
import chromadb
from datetime import datetime

DB_PATH = './chroma_db'
REGISTRY_PATH = './doc_registry.json'

class RagEngine:
    def __init__(self):
        self.client = chromadb.PersistentClient(path=DB_PATH)
        self.collection = self.client.get_or_create_collection(name="rag_documents")
        
        if not os.path.exists(REGISTRY_PATH):
            with open(REGISTRY_PATH, 'w') as f:
                json.dump([], f)
                
    def _load_registry(self):
        if not os.path.exists(REGISTRY_PATH):
            return []
        with open(REGISTRY_PATH, 'r') as f:
            try:
                return json.load(f)
            except:
                return []
                
    def _save_registry(self, data):
        with open(REGISTRY_PATH, 'w') as f:
            json.dump(data, f, indent=2)

    def add_document(self, doc_id: str, chunks: list[str], metadata: dict):
        registry = self._load_registry()
        
        ids = [f"{doc_id}_{i}" for i in range(len(chunks))]
        metadatas = [{"doc_id": doc_id, "title": metadata.get("title", ""), "type": metadata.get("type", "")} for _ in chunks]
        
        self.collection.add(
            documents=chunks,
            metadatas=metadatas,
            ids=ids
        )
        
        registry.append({
            "id": doc_id,
            "title": metadata.get("title", ""),
            "type": metadata.get("type", ""),
            "chunks": len(chunks),
            "created_at": datetime.utcnow().isoformat() + "Z"
        })
        self._save_registry(registry)
        
    def remove_document(self, doc_id: str):
        self.collection.delete(where={"doc_id": doc_id})
        
        registry = self._load_registry()
        registry = [doc for doc in registry if doc.get("id") != doc_id]
        self._save_registry(registry)
        
    def query(self, question: str, n_results: int = 5) -> dict:
        results = self.collection.query(
            query_texts=[question],
            n_results=n_results
        )
        return results

    def get_all_documents(self) -> list[dict]:
        return self._load_registry()

    def get_document_count(self) -> int:
        return len(self._load_registry())
        
    def get_topic_summary(self) -> str:
        try:
            results = self.collection.get(limit=10)
            if not results or not results.get("documents"):
                return "No documents available."
            
            docs = results["documents"]
            summary = " ".join(docs)
            return summary[:500] + ("..." if len(summary) > 500 else "")
        except Exception as e:
            return ""

rag_engine = RagEngine()
