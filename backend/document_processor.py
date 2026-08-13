import fitz  # PyMuPDF
import docx
import re

def extract_text_from_pdf(file_path: str) -> str:
    text = ""
    with fitz.open(file_path) as doc:
        for page in doc:
            text += page.get_text() + "\n"
    return text

def extract_text_from_docx(file_path: str) -> str:
    doc = docx.Document(file_path)
    text = "\n".join([para.text for para in doc.paragraphs])
    return text

def extract_text_from_txt(file_path: str) -> str:
    with open(file_path, 'r', encoding='utf-8') as f:
        return f.read()

def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    if not text or not text.strip():
        return []

    chunks = []
    start = 0
    text_len = len(text)
    
    while start < text_len:
        end = min(start + chunk_size, text_len)
        
        # Adjust end to sentence boundary if not at end of text
        if end < text_len:
            last_period = max(
                text.rfind('. ', start, end),
                text.rfind('! ', start, end),
                text.rfind('? ', start, end),
                text.rfind('\n', start, end)
            )
            if last_period != -1 and last_period > start + chunk_size // 2:
                end = last_period + 1  # Include the punctuation
        
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)

        # Ensure forward progress: always advance by at least 1 character
        new_start = end - overlap
        if new_start <= start:
            new_start = end
        start = new_start
            
    # Remove exact duplicates while preserving order
    seen = set()
    unique_chunks = []
    for c in chunks:
        if c not in seen:
            seen.add(c)
            unique_chunks.append(c)
    return unique_chunks
