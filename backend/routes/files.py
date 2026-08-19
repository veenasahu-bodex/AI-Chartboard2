import os
import shutil

from fastapi import (
    APIRouter,
    UploadFile,
    File,
    HTTPException
)

from services.file_processor import process_file


router = APIRouter()


# ==========================================
# UPLOAD DIRECTORY
# ==========================================

UPLOAD_DIR = "uploads"

os.makedirs(
    UPLOAD_DIR,
    exist_ok=True
)


# ==========================================
# ALLOWED FILE TYPES
# ==========================================

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".doc",
    ".docx",
    ".jpg",
    ".jpeg",
    ".png"
}


# ==========================================
# MAX FILE SIZE
# 20 MB
# ==========================================

MAX_FILE_SIZE = 20 * 1024 * 1024


# ==========================================
# UPLOAD FILE
# ==========================================

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...)
):

    if not file.filename:

        raise HTTPException(
            status_code=400,
            detail="No file selected."
        )


    filename = file.filename

    extension = os.path.splitext(
        filename
    )[1].lower()


    # ======================================
    # CHECK FILE TYPE
    # ======================================

    if extension not in ALLOWED_EXTENSIONS:

        raise HTTPException(
            status_code=400,

            detail=(
                "Unsupported file type. "
                "Allowed files: "
                "PDF, DOC, DOCX, JPG, JPEG, PNG"
            )
        )


    # ======================================
    # READ FILE
    # ======================================

    try:

        content = await file.read()

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=f"Unable to read file: {error}"
        )


    # ======================================
    # CHECK FILE SIZE
    # ======================================

    if len(content) > MAX_FILE_SIZE:

        raise HTTPException(
            status_code=400,

            detail=(
                "File is too large. "
                "Maximum file size is 20 MB."
            )
        )


    # ======================================
    # SAFE FILENAME
    # ======================================

    safe_filename = os.path.basename(
        filename
    )


    file_path = os.path.join(
        UPLOAD_DIR,
        safe_filename
    )


    # ======================================
    # SAVE FILE
    # ======================================

    try:

        with open(
            file_path,
            "wb"
        ) as output_file:

            output_file.write(content)

    except Exception as error:

        raise HTTPException(
            status_code=500,

            detail=(
                f"Unable to save file: {error}"
            )
        )


    # ======================================
    # EXTRACT CONTENT
    # ======================================

    try:

        extracted_text = process_file(
            file_path,
            extension
        )

    except Exception as error:

        print(
            "FILE PROCESSING ERROR:",
            error
        )

        extracted_text = ""


    # ======================================
    # RESPONSE
    # ======================================

    return {

        "success": True,

        "message":
            "File uploaded successfully.",

        "filename":
            safe_filename,

        "file_type":
            extension,

        "file_size":
            len(content),

        "text":
            extracted_text or "",

    }


# ==========================================
# DELETE FILE
# ==========================================

@router.delete("/file/{filename}")
async def delete_file(
    filename: str
):

    if not filename:

        raise HTTPException(
            status_code=400,
            detail="Filename is required."
        )


    # Prevent path traversal

    safe_filename = os.path.basename(
        filename
    )


    file_path = os.path.join(
        UPLOAD_DIR,
        safe_filename
    )


    # ======================================
    # CHECK FILE EXISTS
    # ======================================

    if not os.path.exists(file_path):

        return {

            "success": True,

            "message":
                "File already removed."

        }


    # ======================================
    # DELETE FILE
    # ======================================

    try:

        os.remove(
            file_path
        )

    except Exception as error:

        raise HTTPException(
            status_code=500,

            detail=(
                f"Unable to delete file: {error}"
            )
        )


    return {

        "success": True,

        "message":
            "File deleted successfully.",

        "filename":
            safe_filename

    }