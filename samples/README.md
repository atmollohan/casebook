# Sample files for live demos

Everything in this folder is **synthetic**. No real patient, identifier, specimen, or clinical
record is represented here. Sample names use the `SYN-DEMO` prefix so it is obvious on screen
that a record is fabricated.

Upload these during a demo to show the data pipeline working end to end. Every file below is
already inside the app's allowlist and far under the 25 MB limit, so nothing rejects.

Regenerate at any time with:

```bash
npm run samples
```

The generator is deterministic — same bytes every run — so regenerating never creates noise in
a diff. It is also the provenance record: if a file here is ever questioned, `scripts/samples.ts`
is where the fabrication is defined.

## What each file demonstrates

| File                      | Shows                                                                    |
| ------------------------- | ------------------------------------------------------------------------ |
| `tumor_wes_variants.vcf`  | 420 SNVs across 8 genes, rendered as a variant table with DP/AF/CLNSIG   |
| `structural_variants.vcf` | DEL/DUP/INV calls, to show a second genomics file with different content |
| `serial_cbc.csv`          | 18-point blood-count series, good for showing a trend across time        |
| `panel_qc.tsv`            | Tab-separated quality-control table with a PASS/REVIEW column            |
| `coverage_regions.bed`    | Interval file of targeted regions                                        |
| `genes.gff`               | GFF3 gene/mRNA annotations for the same genes                            |
| `reference_excerpt.fasta` | Two 2.5 kb reference sequence excerpts                                   |
| `lab_results.json`        | Structured panel report, previewed with JSON syntax highlighting         |
| `consult_note.txt`        | Free-text clinical note, previewed as plain text                         |
| `consult_note.pdf`        | PDF that can be uploaded and downloaded (not previewed in the browser)   |
| `variant_review_memo.md`  | Markdown memo, including a table                                         |
| `karyotype.png`           | Generated schematic karyogram — the image-preview path                   |

## Suggested demo order

1. `tumor_wes_variants.vcf` — upload to **Research data → Genomics**, open it, show the table.
2. `serial_cbc.csv` — upload to **Clinical**, point at the haemoglobin column.
3. `karyotype.png` — upload to **Imaging**, show the image preview.
4. `lab_results.json` — upload anywhere, show the JSON preview.
5. `consult_note.txt` or `.pdf` — upload to **Other**, then download it back.

## Not included, and why

There is no `.xlsx` sample. Spreadsheets have no preview in the app, so a workbook adds a
download but nothing to look at. If you want to show the `.xlsx` type is accepted during a
demo, any small spreadsheet works — the allowlist accepts it.
