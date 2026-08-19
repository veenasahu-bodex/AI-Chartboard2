from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.huggingface import generate_response


router = APIRouter()


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):

    message: str

    context: str = ""

    history: list[ChatMessage] = []


@router.post("/chat")
async def chat(request: ChatRequest):

    if not request.message.strip():

        raise HTTPException(
            status_code=400,
            detail="Message cannot be empty"
        )

    prompt_parts = []

    # System instruction

    prompt_parts.append(
        """
You are a helpful AI assistant.

IMPORTANT:
- Do not show your internal reasoning.
- Do not use <think> tags.
- Give only the final answer.
- Answer clearly and directly.
"""
    )

    # Uploaded file context

    if request.context.strip():

        prompt_parts.append(
            f"""
The user uploaded a file earlier.

Use this file content as context
for answering the user's questions.

FILE CONTENT:
{request.context}
"""
        )

    # Previous conversation

    if request.history:

        history_text = ""

        for item in request.history[-10:]:

            history_text += (
                f"{item.role.upper()}: "
                f"{item.content}\n"
            )

        prompt_parts.append(
            f"""
Previous conversation:

{history_text}
"""
        )

    # Current question

    prompt_parts.append(
        f"""
USER QUESTION:

{request.message}

Answer the user now.
"""
    )

    prompt = "\n".join(prompt_parts)

    try:

        answer = generate_response(prompt)

        return {
            "reply": answer
        }

    except Exception as error:

        print("CHAT ERROR:", error)

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )