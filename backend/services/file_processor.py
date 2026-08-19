import os

from pypdf import PdfReader

from docx import Document


def process_file(
    file_path,
    extension
):

    extension = extension.lower()


    # PDF

    if extension == ".pdf":

        return extract_pdf(
            file_path
        )


    # DOCX

    if extension == ".docx":

        return extract_docx(
            file_path
        )


    # DOC

    if extension == ".doc":

        return (
            "DOC file uploaded successfully. "
            "Text extraction for legacy DOC "
            "files is not enabled yet."
        )


    # Images

    if extension in [
        ".jpg",
        ".jpeg",
        ".png"
    ]:

        return (
            "Image uploaded successfully. "
            "Image understanding will be "
            "connected with a vision model."
        )


    return ""


def extract_pdf(file_path):

    reader = PdfReader(
        file_path
    )

    text = []


    for page in reader.pages:

        page_text = page.extract_text()

        if page_text:

            text.append(page_text)


    return "\n".join(text)


def extract_docx(file_path):

    document = Document(
        file_path
    )

    paragraphs = []


    for paragraph in document.paragraphs:

        if paragraph.text.strip():

            paragraphs.append(
                paragraph.text
            )


    return "\n".join(
        paragraphs
    )