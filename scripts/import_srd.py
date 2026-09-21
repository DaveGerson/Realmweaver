#!/usr/bin/env python3
"""Rebuild the bundled, page-addressable SRD from the official CC-BY PDF.

Requires PyMuPDF (`python -m pip install pymupdf`). No model-generated rules.
Usage: python scripts/import_srd.py /path/to/SRD_CC_v5.2.1.pdf
"""
import hashlib
import json
from pathlib import Path
import re
import sys
import fitz

ROOT = Path(__file__).resolve().parents[1]
SOURCE = 'https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf'
EXPECTED_SHA256 = '8974902d109d6e63672d7c490bde9ccf052410503d9cfa768237154fbc5e3d87'
SECTIONS = [(1, 'Legal and contents'), (5, 'Playing the Game'), (19, 'Character Creation'),
            (28, 'Classes'), (83, 'Character Origins'), (87, 'Feats'), (89, 'Equipment'),
            (104, 'Spells'), (176, 'Rules Glossary'), (192, 'Gameplay Toolbox'),
            (204, 'Magic Items'), (254, 'Monsters'), (344, 'Animals')]

def clean(text):
    text = text.replace('\u00ad', '').replace('\ufb01', 'fi').replace('\ufb02', 'fl')
    text = re.sub(r'([a-z])-\n([a-z])', r'\1\2', text)
    return text.strip()

def build(path):
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    if EXPECTED_SHA256 != 'TO_BE_PINNED' and digest != EXPECTED_SHA256:
        raise ValueError('Source checksum mismatch; review the new SRD before changing the pin.')
    doc = fitz.open(path)
    if len(doc) != 364 or '5.2.1' not in doc[0].get_text():
        raise ValueError('Expected the 364-page English SRD 5.2.1.')
    pages = []
    for index, page in enumerate(doc):
        number = index + 1
        text = clean(page.get_text())
        text = re.sub(r'^System Reference Document 5\.2\.1\n\d+\n', '', text)
        text = re.sub(r'^\d+\nSystem Reference Document 5\.2\.1\n', '', text)
        headings = []
        for block in page.get_text('dict')['blocks']:
            for line in block.get('lines', []):
                spans = line['spans']
                if any(s['size'] >= 12 and 'SemiBold' in s['font'] and 'SC700' not in s['font'] for s in spans):
                    heading = clean(''.join(s['text'] for s in spans))
                    if heading and heading not in headings:
                        headings.append(heading)
        section = next(title for start, title in reversed(SECTIONS) if number >= start)
        pages.append(dict(id=f'srd-5.2.1-p{number}', page=number, section=section, headings=headings, text=text))
    payload = dict(version='5.2.1', source=SOURCE, sha256=digest, pageCount=len(doc),
                   license='CC-BY-4.0', extraction='PyMuPDF text and heading extraction; line-end hyphenation removed.', pages=pages)
    target = ROOT / 'data/rules/srd-5.2.1.json'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n')
    print(f'Wrote {len(pages)} pages; SHA-256 {digest}; {target.stat().st_size:,} bytes')

if __name__ == '__main__':
    build(Path(sys.argv[1]))
