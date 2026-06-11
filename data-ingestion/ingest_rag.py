import json
import time
import os

from google import genai
from pinecone import Pinecone

# Load API keys from environment variables (recommended for security)
GEMINI_API_KEY   = os.environ.get("GEMINI_API_KEY", "")
PINECONE_API_KEY = os.environ.get("PINECONE_API_KEY", "")
PINECONE_HOST    = os.environ.get("PINECONE_HOST", "")

CHUNK_SIZE    = 800
CHUNK_OVERLAP = 100

EMBED_DELAY_SECONDS = 1.2

# Path to the data directory (relative to this script's folder)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, "data")

FILES = [
    {
        "json": "orange_line.json",
        "txt":  "orange_line_info.txt",
        "line": "Orange Line Metro Train",
        "tag":  "orange_line",
    },
    {
        "json": "metro_bus.json",
        "txt":  "metro_bus_info.txt",
        "line": "Lahore Metro Bus",
        "tag":  "metro_bus",
    },
    {
        "json": "eco_bus.json",
        "txt":  "eco_bus_info.txt",
        "line": "Electro Eco-Bus",
        "tag":  "eco_bus",
    },
]


def chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    chunks = []
    start = 0
    while start < len(text):
        end = start + size
        chunks.append(text[start:end].strip())
        start += size - overlap
    return [c for c in chunks if c]


def json_to_text(data: dict) -> str:
    lines = [
        f"Transport Line: {data.get('line_name', '')}",
        f"Line ID: {data.get('line_id', '')}",
        "",
        "Stations:",
    ]
    for s in data.get("stations", []):
        interchange_note = ""
        if s.get("is_interchange"):
            connects = s.get("connects_to", "another line")
            interchange_note = f" [INTERCHANGE with {connects}]"

        notes = f" Note: {s['notes']}" if s.get("notes") else ""
        lines.append(
            f"  Station {s['id']}: {s['name']} | "
            f"Lat: {s['lat']}, Lng: {s['lng']} | "
            f"Type: {s.get('type', 'Surface')}"
            f"{interchange_note}{notes}"
        )
    return "\n".join(lines)


import requests

def get_embedding(text: str) -> list[float]:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key={GEMINI_API_KEY}"
    payload = {
        "model": "models/gemini-embedding-2",
        "content": {
            "parts": [{"text": text}]
        },
        "outputDimensionality": 768
    }
    response = requests.post(url, json=payload)
    if response.status_code != 200:
        raise ValueError(f"Gemini API Error: {response.text}")
    
    return response.json()["embedding"]["values"]


import sys
sys.stdout.reconfigure(encoding='utf-8')

def main():
    if not GEMINI_API_KEY:
        raise ValueError("Set your GEMINI_API_KEY in the script or as an env variable.")
    if not PINECONE_API_KEY:
        raise ValueError("Set your PINECONE_API_KEY in the script or as an env variable.")
    if not PINECONE_HOST:
        raise ValueError("Set your PINECONE_HOST (full https:// URL from Pinecone dashboard).")

    pc     = Pinecone(api_key=PINECONE_API_KEY)
    index  = pc.Index(host=PINECONE_HOST)

    all_vectors = []
    vector_id   = 0

    for file_config in FILES:
        tag = file_config["tag"]
        print(f"\n{'='*50}")
        print(f"Processing: {file_config['line']}")
        print(f"{'='*50}")

        json_path = os.path.join(DATA_DIR, file_config["json"])
        with open(json_path, "r", encoding="utf-8") as f:
            json_data = json.load(f)

        json_text   = json_to_text(json_data)
        json_chunks = chunk_text(json_text)
        print(f"  JSON -> {len(json_chunks)} chunk(s)")

        for i, chunk in enumerate(json_chunks):
            print(f"    Embedding JSON chunk {i+1}/{len(json_chunks)}...", end=" ", flush=True)
            embedding = get_embedding(chunk)
            all_vectors.append({
                "id":     f"{tag}_json_{vector_id}",
                "values": embedding,
                "metadata": {
                    "text":   chunk,
                    "source": file_config["json"],
                    "type":   "schedule",
                    "line":   file_config["line"],
                    "tag":    tag,
                },
            })
            vector_id += 1
            print("OK")
            time.sleep(EMBED_DELAY_SECONDS)

        txt_path = os.path.join(DATA_DIR, file_config["txt"])
        with open(txt_path, "r", encoding="utf-8") as f:
            txt_content = f.read()

        txt_chunks = chunk_text(txt_content)
        print(f"  TXT  -> {len(txt_chunks)} chunk(s)")

        for i, chunk in enumerate(txt_chunks):
            print(f"    Embedding TXT chunk {i+1}/{len(txt_chunks)}...", end=" ", flush=True)
            embedding = get_embedding(chunk)
            all_vectors.append({
                "id":     f"{tag}_txt_{vector_id}",
                "values": embedding,
                "metadata": {
                    "text":   chunk,
                    "source": file_config["txt"],
                    "type":   "knowledge",
                    "line":   file_config["line"],
                    "tag":    tag,
                },
            })
            vector_id += 1
            print("OK")
            time.sleep(EMBED_DELAY_SECONDS)

    print(f"\n{'='*50}")
    print(f"Upserting {len(all_vectors)} vectors to Pinecone...")
    BATCH_SIZE = 100
    for i in range(0, len(all_vectors), BATCH_SIZE):
        batch = all_vectors[i : i + BATCH_SIZE]
        index.upsert(vectors=batch)
        print(f"  Upserted batch {i//BATCH_SIZE + 1} ({len(batch)} vectors) OK")

    print("\nDONE! Your Pinecone index is ready for RAG queries.")
    stats = index.describe_index_stats()
    print(f"   Total vectors in index: {stats['total_vector_count']}")


if __name__ == "__main__":
    main()
