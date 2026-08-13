<p align="center">
  <img src="docs/hero.png" alt="RAG Visualizer — Ground AI responses with your documents" width="100%" />
</p>

<h1 align="center">RAG Visualizer</h1>

<p align="center">
  <strong>Compare standard AI knowledge with document-grounded RAG responses side-by-side.</strong>
</p>

<p align="center">
  <a href="#what-is-rag">What is RAG?</a> •
  <a href="#features">Features</a> •
  <a href="#how-it-works">How It Works</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#using-the-app--value-of-side-by-side">Using the App & Value of Side-by-Side</a> •
  <a href="#directory-structure">Directory Structure</a> •
  <a href="#tech-stack">Tech Stack</a>
</p>

---

## Overview

RAG Visualizer is an interactive, full-stack application designed to demonstrate the real-world value of **Retrieval-Augmented Generation (RAG)**. By presenting a **Standard AI Response** side-by-side with a **RAG-Grounded Response** in real time, the app visually highlights the contrast between generic LLM outputs and context-accurate, source-cited completions.

---

## What is RAG?

**Retrieval-Augmented Generation (RAG)** is an architectural pattern that enhances the capabilities of a Large Language Model (LLM) by dynamically feeding it relevant external data prior to generating a response. 

### Why is RAG Important and Useful?
Standard LLMs are trained on massive, public datasets. While highly capable, they suffer from critical limitations in production environments:
1. **Lack of Private Context**: They do not know about your private files, internal company documents, or real-time data.
2. **Knowledge Cutoff**: They cannot access information generated after their training data was frozen.
3. **Hallucination Risk**: When asked about specific details they don't know, they often invent plausible-sounding but completely incorrect details.

**RAG solves these problems** by splitting your documents into chunks, indexing them in a vector database, and querying them for semantically relevant matches whenever a user asks a question. This relevant context is passed directly to the model's prompt. The LLM acts as an intelligent reader and synthesizes a factual response grounded strictly in the provided data.

---

## Features

### 📁 Multi-Format Ingestion
Upload files or paste plain text directly into the RAG database:
- **PDF Extraction**: Uses PyMuPDF to extract text cleanly.
- **Word Extraction**: Uses `python-docx` to extract structured paragraph text.
- **Text Files**: Directly reads UTF-8 plain text notes and logs.
- **Raw Text Box**: Paste raw blocks of text and assign custom titles.

### 📚 Side-by-Side Comparison
Every question triggers two different completions concurrently:
- 🌐 **Standard Knowledge**: General response using the model's public training data.
- 🟢 **RAG Response**: Response strictly grounded in uploaded documents, featuring automatic citation of source chunks.

### 🎯 Smart Scope Enforcement
The RAG model prompt enforces boundary control:
- Questions related to the documents are answered with grounding.
- Completely out-of-scope questions (e.g. asking for cooking recipes on a banking app) trigger a warning badge and a polite redirect steering the conversation back to the document topics.

### 🔍 Local Semantic Search
- Powered by **ChromaDB**'s persistent vector client.
- Automatically generates embeddings locally using the default `all-MiniLM-L6-v2` transformer model via ONNX runtime—meaning no third-party APIs are called for embeddings.

---

## How It Works

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Front as Frontend (app.js)
    participant Back as Backend (main.py)
    participant Vector as Vector Store (ChromaDB)
    participant LLM as Google Gemini API

    User->>Front: Uploads Document / Enters Text
    Front->>Back: POST /api/upload
    Back->>Back: Extract Text & Chunk (Sentence-Aware)
    Back->>Vector: Add Chunk Embeddings
    Back-->>Front: JSON Response (Doc Metadata)

    User->>Front: Sends Chat Message / Question
    Front->>Back: POST /api/chat
    par Standard Path
        Back->>LLM: Generate Content (Unrestricted Prompt)
    and RAG Path
        Back->>Vector: Query closest chunks (Semantic Search)
        Vector-->>Back: Return relevant text chunks
        Back->>LLM: Generate Content (System Instruction + Context Chunks)
    end
    LLM-->>Back: Standard Response & Structured RAG Response
    Back-->>Front: JSON response (Standard + RAG Text + Citations)
    Front-->>User: Renders Side-by-Side message panels (Scrollable)
```

1. **Ingestion & Chunking**: Uploaded text is processed into chunks of ~500 characters, respecting sentence boundaries where possible.
2. **Indexing**: Chunks are embedded and stored in a local ChromaDB collection.
3. **Retrieval**: User queries trigger semantic similarity checks inside ChromaDB to retrieve the top 5 most relevant document chunks.
4. **Generation**: The context is appended to a strict prompt instructing the LLM (Gemini) to evaluate relevance, answer utilizing the context, and cite specific document sources.

---

## Getting Started

### Prerequisites
- **Python 3.10+**
- **Google Gemini API Key** (Free tier from [Google AI Studio](https://aistudio.google.com/apikey))

### Setup
1. **Clone the Repository**:
   ```bash
   git clone https://github.com/jcueto/rag-visualizer.git
   cd rag-visualizer
   ```

2. **Configure Virtual Environment**:
   ```bash
   cd backend
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. **Install Packages**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Add your API Key**:
   Create a `.env` file in the `backend/` directory:
   ```env
   GEMINI_API_KEY=your-api-key-here
   ```
   *(Note: `.env` is already configured in `.gitignore` so your API key will remain safe and will never be pushed to GitHub.)*

5. **Start the App**:
   ```bash
   python3 main.py
   ```
   Open **http://localhost:8000** in your web browser.

---

## Using the App & Value of Side-by-Side

### Step-by-Step Instructions
1. **Load Context**: In the left sidebar, upload a document (such as a company policy, research paper, financial statement, or private notes) or paste raw text. Ensure the "RAG Status" lights up green.
2. **Interact**: Ask questions about the uploaded content using the chat bar at the bottom.
3. **Analyze**: Compare the Standard Knowledge response on the left with the RAG Response on the right.

### Value of the Side-by-Side Comparison
Seeing the outputs next to each other illustrates how anchoring an LLM changes its response. Key values include:
- **Identifying Hallucinations**: You can immediately see when a standard model confidently makes up answers to specific queries vs. how a RAG model restricts its output to source material.
- **Observing the Context Delta**: Notice how standard responses are generic and high-level, whereas RAG responses contain precise terms, numbers, dates, and names retrieved directly from your documents.
- **Verification of Citations**: RAG outputs print interactive source chips at the bottom. You can see exactly which portions of your files informed the model, building trust in the output.

### Potential Queries to Try
1. **Specific Facts**: Upload a document and ask: *"What is my account number?"* or *"What is the policy for remote work?"*
   - *Observation*: The standard model will state it doesn't have access to your personal files or will hallucinate a generic response, while RAG returns the exact details.
2. **Out of Scope (Topic Guardrails)**: Ask: *"How do I bake a chocolate cake?"*
   - *Observation*: The standard model will give you a full recipe. The RAG model (unless you uploaded a recipe document) will flag a warning and politely redirect you back to the topics in your files.
3. **General Knowledge Synthesis**: Ask: *"Summarize the main themes here."*
   - *Observation*: Standard model gives general summarization tips; RAG generates a specific, structured summary of the uploaded document.

---

## Directory Structure

```
rag-visualizer/
├── README.md                  # Detailed overview & guide
├── .gitignore                 # Prevents pushing caches, DBs, and credentials
├── docs/
│   └── hero.png               # Visual header image mockup
├── backend/
│   ├── main.py                # FastAPI entry point, endpoints, & static mounting
│   ├── document_processor.py  # Ingestion & sentence-boundary chunking logic
│   ├── rag_engine.py          # ChromaDB connection & metadata registry
│   ├── llm_client.py          # Gemini API integrations & model versioning
│   ├── requirements.txt       # Python package dependencies
│   └── .env                   # (Local-only) API Key configuration
└── frontend/
    ├── index.html             # Main dashboard shell
    ├── styles.css             # iMessage dark mode responsive styling
    ├── pages.css              # Styling for helper pages
    ├── app.js                 # API bindings, UI events, and DOM rendering
    ├── about.html             # "Learn about this app" help page
    └── learn-rag.html         # "Learn about RAG" educational page
```

---

## Tech Stack

- **Backend Framework**: FastAPI (Uvicorn server)
- **Vector Database**: ChromaDB (local persistence client)
- **Language Model**: Google Gemini 3.6 Flash (via `google-genai` SDK)
- **Text Extractors**: PyMuPDF (PDFs) and `python-docx` (DOCX files)
- **Frontend Engine**: Vanilla HTML5, CSS3 (iMessage Theme), and JavaScript (ES6)
- **Markdown Processing**: `marked.js` with `DOMPurify` sanitizer
