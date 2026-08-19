import os
import re
import requests

from dotenv import load_dotenv

load_dotenv()

HF_TOKEN = os.getenv("HF_TOKEN")

API_URL = "https://router.huggingface.co/v1/chat/completions"

MODEL = "deepseek-ai/DeepSeek-R1"


def clean_response(text: str):

    if not text:
        return ""

    # Remove <think>...</think>
    text = re.sub(
        r"<think>.*?</think>",
        "",
        text,
        flags=re.DOTALL | re.IGNORECASE
    )

    # Remove markdown code fences if unnecessary
    text = text.replace("```text", "")
    text = text.replace("```", "")

    return text.strip()


def generate_response(prompt: str):

    if not HF_TOKEN:
        raise Exception(
            "HF_TOKEN not found in .env"
        )

    headers = {
        "Authorization": f"Bearer {HF_TOKEN}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": MODEL,

        "messages": [
            {
                "role": "user",
                "content": prompt
            }
        ],

        "max_tokens": 700,

        "temperature": 0.5
    }

    response = requests.post(
        API_URL,
        headers=headers,
        json=payload,
        timeout=120
    )

    print("HF STATUS:", response.status_code)

    if response.status_code != 200:
        print("HF RESPONSE:", response.text)

        raise Exception(
            f"Hugging Face API Error: "
            f"{response.text}"
        )

    data = response.json()

    answer = data["choices"][0]["message"]["content"]

    return clean_response(answer)