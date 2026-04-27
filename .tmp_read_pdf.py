import pdfplumber
p = r"C:/Users/lucas/Downloads/CodeGuard-AI-Report-code-guard-ai.pdf"
with pdfplumber.open(p) as pdf:
    for i, page in enumerate(pdf.pages, 1):
        print(f"--- PAGE {i} ---")
        print((page.extract_text() or "").strip())
