import os
import re
import time
import uuid
import base64
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from groq import Groq

load_dotenv()

# =========================
# CONFIG
# =========================

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

MODEL = "qwen/qwen3.6-27b"

MAX_FILE_SIZE = 20 * 1024 * 1024

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# Files remain available while backend is running
FILE_STORE = {}

# =========================
# GROQ CLIENT
# =========================

client = None

if GROQ_API_KEY:
    client = Groq(api_key=GROQ_API_KEY)

# =========================
# FASTAPI
# =========================

app = FastAPI(
    title="Nova AI Chatboard",
    version="3.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# =========================
# REQUEST MODEL
# =========================

class ChatRequest(BaseModel):
    message: str = ""
    file_id: Optional[str] = None
    context: Optional[str] = ""
    history: Optional[list] = []

# =========================
# CLEAN AI RESPONSE
# =========================

def clean_response(text):
    if not text:
        return ""

    text = str(text)

    text = re.sub(
        r"<think>[\s\S]*?</think>",
        "",
        text,
        flags=re.IGNORECASE
    )

    text = re.sub(
        r"<think>[\s\S]*$",
        "",
        text,
        flags=re.IGNORECASE
    )

    text = text.replace("***", "")
    text = text.replace("**", "")
    text = text.replace("```", "")

    text = re.sub(
        r"\n{3,}",
        "\n\n",
        text
    )

    return text.strip()

# =========================
# PDF TEXT
# =========================

def extract_pdf(path):
    try:
        import pymupdf

        doc = pymupdf.open(str(path))
        pages = []

        for page in doc:
            text = page.get_text()
            if text.strip():
                pages.append(text)

        doc.close()

        return "\n\n".join(pages).strip()

    except Exception as e:
        print("PDF ERROR:", repr(e))
        return ""

# =========================
# DOCX TEXT
# =========================

def extract_docx(path):
    try:
        from docx import Document

        doc = Document(str(path))
        text = []

        for paragraph in doc.paragraphs:
            value = paragraph.text.strip()

            if value:
                text.append(value)

        return "\n".join(text).strip()

    except Exception as e:
        print("DOCX ERROR:", repr(e))
        return ""

# =========================
# DOC TEXT
# =========================

def extract_doc(path):
    try:
        import subprocess

        result = subprocess.run(
            ["antiword", str(path)],
            capture_output=True,
            text=True,
            timeout=30
        )

        if result.returncode == 0:
            return result.stdout.strip()

    except Exception as e:
        print("DOC ERROR:", repr(e))

    return ""

# =========================
# TXT TEXT
# =========================

def extract_txt(path):
    try:
        return path.read_text(
            encoding="utf-8",
            errors="ignore"
        ).strip()

    except Exception as e:
        print("TXT ERROR:", repr(e))
        return ""

# =========================
# FILE CONTENT
# =========================

def extract_file_content(path, content_type, filename):
    extension = Path(filename).suffix.lower()

    if extension == ".pdf":
        return extract_pdf(path)

    if extension == ".docx":
        return extract_docx(path)

    if extension == ".doc":
        return extract_doc(path)

    if extension == ".txt":
        return extract_txt(path)

    if content_type.startswith("image/"):
        return f"Image file: {filename}"

    return ""

# =========================
# LIMIT CONTEXT
# =========================

def limit_context(text, maximum=50000):
    if not text:
        return ""

    if len(text) <= maximum:
        return text

    return (
        text[:maximum]
        + "\n\n[Remaining file content omitted]"
    )

# =========================
# IMAGE OPTIMIZATION
# =========================

def prepare_image(path):
    """
    Groq base64 image requests have a smaller encoded-size limit.
    Original upload can still be up to 20 MB.
    This function creates a smaller temporary JPEG for AI analysis.
    """

    try:
        from PIL import Image

        image = Image.open(path)

        if image.mode not in ("RGB", "L"):
            image = image.convert("RGB")

        max_dimension = 1800

        width, height = image.size

        if width > max_dimension or height > max_dimension:
            ratio = min(
                max_dimension / width,
                max_dimension / height
            )

            new_size = (
                int(width * ratio),
                int(height * ratio)
            )

            image = image.resize(
                new_size,
                Image.LANCZOS
            )

        optimized_path = (
            path.parent
            / f"{path.stem}_ai.jpg"
        )

        quality = 85

        image.save(
            optimized_path,
            "JPEG",
            quality=quality,
            optimize=True
        )

        # Reduce more if necessary
        while optimized_path.stat().st_size > 3_000_000 and quality > 45:
            quality -= 10

            image.save(
                optimized_path,
                "JPEG",
                quality=quality,
                optimize=True
            )

        return optimized_path

    except Exception as e:
        print("IMAGE OPTIMIZATION ERROR:", repr(e))
        return path

# =========================
# IMAGE TO BASE64
# =========================

def image_to_data_url(path):
    optimized_path = prepare_image(path)

    data = optimized_path.read_bytes()

    encoded = base64.b64encode(data).decode("utf-8")

    return (
        f"data:image/jpeg;base64,{encoded}"
    )

# =========================
# SYSTEM PROMPT
# =========================

def build_system_prompt(filename="", file_context=""):
    prompt = """
You are Nova, a helpful AI assistant.

Important rules:
- Your name is Nova.
- Answer the user directly.
- Never show internal reasoning.
- Never show <think> tags.
- Never show chain-of-thought.
- Never output ***.
- Do not use unnecessary markdown decoration.
- Answer in the same language as the user.
- If the user asks in Hindi, answer in Hindi.
- If the user asks in English, answer in English.
- Be clear and easy to understand.
- If a file is attached, use its content to answer questions.
- The user can ask multiple questions about the same file.
- Never ask the user to upload the same file again when its file_id is available.
- Do not invent information that is not present in the file.
"""

    if filename:
        prompt += f"""

Uploaded file:
{filename}
"""

    if file_context:
        prompt += f"""

FILE CONTENT:
----------------
{file_context}
----------------

Use this content whenever the user's question is related to the file.
"""

    return prompt.strip()

# =========================
# HISTORY
# =========================

def build_history(history):
    if not history:
        return []

    messages = []

    for item in history[-12:]:
        if not isinstance(item, dict):
            continue

        role = item.get("role")
        content = item.get("content")

        if role not in ["user", "assistant"]:
            continue

        if not content:
            continue

        messages.append({
            "role": role,
            "content": str(content)
        })

    return messages

# =========================
# ROOT
# =========================

@app.get("/")
async def root():
    return {
        "status": "online",
        "assistant": "Nova",
        "model": MODEL
    }

# =========================
# HEALTH
# =========================

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "groq": bool(GROQ_API_KEY),
        "model": MODEL
    }

# =========================
# UPLOAD
# =========================

@app.post("/api/upload")
async def upload_file(
    file: UploadFile = File(...)
):
    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="Invalid filename."
        )

    filename = file.filename
    extension = Path(filename).suffix.lower()

    allowed = {
        ".pdf",
        ".doc",
        ".docx",
        ".txt",
        ".jpg",
        ".jpeg",
        ".png",
        ".webp",
        ".gif"
    }

    if extension not in allowed:
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported file type. "
                "Use PDF, DOC, DOCX, TXT, JPG, "
                "JPEG, PNG, WEBP or GIF."
            )
        )

    content = await file.read()

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="Maximum file size is 20 MB."
        )

    file_id = str(uuid.uuid4())

    saved_name = f"{file_id}{extension}"
    file_path = UPLOAD_DIR / saved_name

    try:
        file_path.write_bytes(content)

    except Exception as e:
        print("SAVE ERROR:", repr(e))

        raise HTTPException(
            status_code=500,
            detail="Could not save file."
        )

    extracted_text = extract_file_content(
        file_path,
        file.content_type or "",
        filename
    )

    extracted_text = limit_context(
        extracted_text
    )

    FILE_STORE[file_id] = {
        "id": file_id,
        "filename": filename,
        "path": str(file_path),
        "type": file.content_type or "",
        "size": len(content),
        "text": extracted_text
    }

    return {
        "success": True,
        "file_id": file_id,
        "filename": filename,
        "file_name": filename,
        "file_type": file.content_type or "",
        "size": len(content),
        "text": extracted_text,
        "file_context": extracted_text,
        "message": "File uploaded successfully."
    }

# =========================
# FILE INFO
# =========================

@app.get("/api/file/{file_id}")
async def get_file(file_id: str):
    data = FILE_STORE.get(file_id)

    if not data:
        raise HTTPException(
            status_code=404,
            detail="File not found."
        )

    return {
        "success": True,
        "file_id": file_id,
        "filename": data["filename"],
        "file_type": data["type"],
        "size": data["size"],
        "text": data["text"]
    }

# =========================
# DELETE FILE
# =========================

@app.delete("/api/file/{file_id}")
async def delete_file(file_id: str):
    data = FILE_STORE.get(file_id)

    if not data:
        return {
            "success": True,
            "message": "File already deleted."
        }

    try:
        path = Path(data["path"])

        if path.exists():
            path.unlink()

        ai_path = path.with_name(
            f"{path.stem}_ai.jpg"
        )

        if ai_path.exists():
            ai_path.unlink()

    except Exception as e:
        print("DELETE FILE ERROR:", repr(e))

    FILE_STORE.pop(file_id, None)

    return {
        "success": True,
        "message": "File deleted successfully."
    }

# =========================
# CHAT
# =========================

@app.post("/api/chat")
async def chat(request: ChatRequest):
    start_time = time.perf_counter()

    if not client:
        raise HTTPException(
            status_code=500,
            detail=(
                "GROQ_API_KEY is missing. "
                "Add GROQ_API_KEY to backend/.env"
            )
        )

    message = request.message.strip()

    filename = ""
    file_context = request.context or ""
    stored_file = None

    # -------------------------
    # GET EXISTING FILE
    # -------------------------

    if request.file_id:
        stored_file = FILE_STORE.get(
            request.file_id
        )

        if stored_file:
            filename = stored_file["filename"]

            if not file_context:
                file_context = stored_file["text"]

    file_context = limit_context(
        file_context
    )

    system_prompt = build_system_prompt(
        filename,
        file_context
    )

    # -------------------------
    # IMAGE
    # -------------------------

    is_image = False

    if stored_file:
        is_image = stored_file["type"].startswith(
            "image/"
        )

    # -------------------------
    # IMAGE CHAT
    # -------------------------

    if is_image:
        try:
            image_path = Path(
                stored_file["path"]
            )

            image_url = image_to_data_url(
                image_path
            )

            user_text = message or (
                "Analyze this image carefully. "
                "Tell me what is visible in it, "
                "including objects, people, text, "
                "colors, layout and important details."
            )

            messages = [
                {
                    "role": "system",
                    "content": system_prompt
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": user_text
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": image_url
                            }
                        }
                    ]
                }
            ]

            response = client.chat.completions.create(
                model=MODEL,
                messages=messages,
                temperature=0.7,
                max_completion_tokens=1200,
                top_p=0.8,
                reasoning_effort="none",
                stream=False
            )

            answer = (
                response
                .choices[0]
                .message
                .content
            )

        except Exception as e:
            print("")
            print("==============================")
            print("GROQ IMAGE ERROR")
            print("==============================")
            print(repr(e))
            print("==============================")
            print("")

            raise HTTPException(
                status_code=500,
                detail=f"Image analysis failed: {str(e)}"
            )

    # -------------------------
    # TEXT / PDF / DOC
    # -------------------------

    else:
        messages = [
            {
                "role": "system",
                "content": system_prompt
            }
        ]

        messages.extend(
            build_history(
                request.history
            )
        )

        if message:
            messages.append({
                "role": "user",
                "content": message
            })
        else:
            messages.append({
                "role": "user",
                "content": (
                    "Please analyze the uploaded "
                    "file and explain what it contains."
                )
            })

        try:
            response = client.chat.completions.create(
                model=MODEL,
                messages=messages,
                temperature=0.7,
                max_completion_tokens=1200,
                top_p=0.8,
                reasoning_effort="none",
                stream=False
            )

            answer = (
                response
                .choices[0]
                .message
                .content
            )

        except Exception as e:
            print("")
            print("==============================")
            print("GROQ ERROR")
            print("==============================")
            print(repr(e))
            print("==============================")
            print("")

            raise HTTPException(
                status_code=500,
                detail=f"AI request failed: {str(e)}"
            )

    # -------------------------
    # CLEAN ANSWER
    # -------------------------

    answer = clean_response(answer)

    if not answer:
        answer = "I could not generate a response."

    response_time = round(
        time.perf_counter() - start_time,
        2
    )

    print("")
    print("==============================")
    print("NOVA RESPONSE")
    print("Model:", MODEL)
    print("File:", filename or "None")
    print("Response time:", response_time, "seconds")
    print("==============================")
    print("")

    return {
        "success": True,
        "reply": answer,
        "response": answer,
        "answer": answer,
        "responseTime": response_time,
        "model": MODEL,
        "file_id": request.file_id,
        "file_name": filename
    }

# =========================
# STARTUP
# =========================

print("")
print("======================================")
print(" NOVA AI CHATBOARD BACKEND")
print("======================================")
print("Model:", MODEL)
print(
    "Groq:",
    "Configured" if GROQ_API_KEY else "NOT CONFIGURED"
)
print("Upload directory:", UPLOAD_DIR)
print("Maximum file size: 20 MB")
print("Image analysis: ENABLED")
print("Multiple file questions: ENABLED")
print("======================================")
print("")