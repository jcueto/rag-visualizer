import os
import json
from google import genai
from google.genai import types

_client = None

def _load_env_file():
    """Try to load API key from a .env file if env var is not set."""
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ.setdefault(key.strip(), value.strip())

def get_client():
    global _client
    if _client is not None:
        return _client
    _load_env_file()
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("Warning: GEMINI_API_KEY environment variable not set.")
        print("Set it via: export GEMINI_API_KEY='your-key' or create a .env file in the backend/ directory.")
    _client = genai.Client(api_key=api_key)
    return _client

def get_standard_response(question: str) -> str:
    client = get_client()
    try:
        response = client.models.generate_content(
            model='gemini-3.6-flash',
            contents=question,
            config=types.GenerateContentConfig(
                system_instruction="You are a helpful, knowledgeable assistant. Answer any question thoroughly and accurately."
            )
        )
        return response.text
    except Exception as e:
        return f"Error: {str(e)}"

def get_rag_response(question: str, context_chunks: list[str], sources: list[dict], topic_summary: str) -> dict:
    client = get_client()
    
    context_str = "\n\n---\n\n".join(context_chunks)
    sources_str = json.dumps(sources)
    
    prompt = f"""
    Context topics summary: {topic_summary}
    
    Provided Context:
    {context_str}
    
    User Question:
    {question}
    
    Sources: {sources_str}
    """
    
    sys_instruction = """
    You are an AI assistant powered by a RAG (Retrieval-Augmented Generation) system.
    ONLY use the provided context to answer the user's question.
    If the question is related to the general topic area of the context, you may answer using context + general knowledge about that topic.
    If the question is COMPLETELY unrelated to the context topics, set is_relevant=false and politely explain what topics you can help with, steering the user back.
    Always cite which source documents informed your answer.
    
    Return your response strictly as JSON with this schema:
    {
      "text": "The answer to the user's question, or the polite redirect...",
      "is_relevant": true|false
    }
    """
    
    try:
        response = client.models.generate_content(
            model='gemini-3.6-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=sys_instruction,
                response_mime_type="application/json"
            )
        )
        
        resp_json = json.loads(response.text)
        return {
            "text": resp_json.get("text", ""),
            "is_relevant": resp_json.get("is_relevant", True)
        }
    except Exception as e:
        return {
            "text": f"Error generating RAG response: {str(e)}",
            "is_relevant": False
        }
