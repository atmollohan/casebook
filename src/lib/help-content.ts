/**
 * Content for the in-app guide at /help.
 *
 * This is user-facing documentation that lives inside the app, so a researcher, a
 * colleague, or a stakeholder can understand the workflow without leaving it. It is
 * data rather than markup for two reasons: the page stays quiet and consistent, and the
 * content can be asserted in tests (unique anchors, no promises about features that do
 * not exist yet).
 *
 * Rule: describe only what is built. Planned work belongs in .planning/ROADMAP.md, and a
 * promise in here that the app does not keep is a defect.
 */

export type HelpBlock =
  | { kind: "p"; text: string }
  | { kind: "note"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "terms"; items: Array<[term: string, meaning: string]> }
  | { kind: "table"; head: string[]; rows: string[][] };

export type HelpSection = {
  id: string;
  title: string;
  blocks: HelpBlock[];
};

export const HELP_INTRO =
  "Casebook keeps everything about one patient investigation in one place: the data you upload, the analyses you run, what you conclude from them, and the report you hand off at the end.";

export const HELP_SECTIONS: HelpSection[] = [
  {
    id: "orientation",
    title: "How this workspace is organised",
    blocks: [
      {
        kind: "p",
        text: "Work is grouped by patient. Each patient has one research program, and the program is where the investigation lives. Opening a program from the dashboard takes you to seven tabs that follow the same order every time: the question, the evidence, the reasoning, and the output.",
      },
      {
        kind: "table",
        head: ["Tab", "What it holds", "When you use it"],
        rows: [
          [
            "Overview",
            "The program summary, headline counts, recent findings, and a suggested next step.",
            "Starting or resuming work.",
          ],
          [
            "Research data",
            "Every file you upload, tagged by category, with previews and download.",
            "Adding evidence to the case.",
          ],
          [
            "Activities",
            "The analyses you run, each with a hypothesis and a status.",
            "Recording what you did and why.",
          ],
          [
            "Findings",
            "What you concluded, with a significance level and supporting evidence.",
            "Turning an analysis into a conclusion.",
          ],
          [
            "Evidence & sources",
            "The publications, databases, records, and datasets behind those conclusions.",
            "Citing your sources.",
          ],
          ["Reports", "The assembled document, as a draft until you finalize it.", "Handing the case off."],
          [
            "History",
            "An automatic record of everything that changed.",
            "Auditing or reconstructing the case.",
          ],
        ],
      },
    ],
  },
  {
    id: "lifecycle",
    title: "Moving a program through its lifecycle",
    blocks: [
      {
        kind: "p",
        text: "A program is not active the moment you create it. When you register a patient you choose whether the program starts as Planned or Active, and a new case defaults to Planned: the investigation is scoped, and the work begins when you are ready. Where a program sits in this lifecycle tells you — and anyone reading the case later — whether the work is scoped, underway, on hold, or finished. The status appears next to the patient's name, so it is visible from every tab, and the moves available to you sit on the Overview tab.",
      },
      {
        kind: "table",
        head: ["Status", "What it means", "You can move it to"],
        rows: [
          [
            "Planned",
            "The program is scoped but the investigation has not started.",
            "Active, to start the work. Closed, if the plan is dropped.",
          ],
          ["Active", "The investigation is underway.", "Paused, or Closing to wind it down."],
          ["Paused", "Work is on hold and can be picked up again.", "Active to resume, or Closing."],
          [
            "Closing",
            "The work is done and the program is being tidied up before it ends.",
            "Active to reopen, or Closed to finish it.",
          ],
          ["Closed", "The program has ended.", "Nothing. This is the final status."],
        ],
      },
      {
        kind: "p",
        text: "Each move is a deliberate step rather than a free-text field: only the moves that make sense from where the program currently sits are offered, and the same rule is applied when the request arrives, so a program cannot be moved somewhere the lifecycle does not allow. Every move is recorded in History with the time and the researcher who made it.",
      },
      {
        kind: "note",
        text: "Closing a program does not delete anything. The data, analyses, findings, evidence, reports, and history all stay exactly where they are and remain readable; closing only says the work has ended.",
      },
    ],
  },
  {
    id: "uploading",
    title: "Adding data",
    blocks: [
      {
        kind: "p",
        text: "Open Research data and choose Upload data. Give the file a display title, pick a category, and add a note if the file needs context to be read later. The original file is always kept as uploaded.",
      },
      {
        kind: "ul",
        items: [
          "Accepted types: CSV, TSV, VCF, JSON, TXT, FASTA, BED, GFF, PDF, PNG or JPG, XLSX, and Markdown.",
          "Maximum size is 25 MB per file.",
          "Tabular, JSON, plain-text, Markdown, and image files preview in the browser. PDFs and spreadsheets download rather than preview.",
          "Downloads are authorized: a file is only served to a signed-in researcher who can see that program.",
        ],
      },
      {
        kind: "note",
        text: "Category is for your own navigation — clinical, genomics, transcriptomics, imaging, lab, or other. It does not change how a file is interpreted.",
      },
    ],
  },
  {
    id: "reasoning",
    title: "Activities, findings, and evidence",
    blocks: [
      {
        kind: "p",
        text: "These three tabs are the reasoning chain, and they are meant to be used together. An activity is the work, a finding is what you concluded from it, and evidence is what supports the conclusion.",
      },
      {
        kind: "ol",
        items: [
          "Create an activity for the analysis, with the type of work and the hypothesis you are testing.",
          "Move it through planned, in progress, and completed as you go.",
          "Record findings against it. Each finding carries a significance level and can link back to the activity that produced it.",
          "Attach evidence to the finding, not to the activity. A conclusion without a source is the thing this workspace exists to prevent.",
        ],
      },
      {
        kind: "note",
        text: "Findings can also be created directly from the Findings tab when the conclusion does not come from a single analysis.",
      },
    ],
  },
  {
    id: "reports",
    title: "Reports: draft to final",
    blocks: [
      {
        kind: "p",
        text: "A report is assembled from the current state of the program: patient and program summary, a data index, the activities, the findings with their evidence, and the history. Generate one from the Reports tab at any point.",
      },
      {
        kind: "ul",
        items: [
          "Every new report starts as a draft. Drafts can be regenerated as the case develops, which is the normal way to work.",
          "Finalizing locks the current version and stamps it. That is the point at which the report is meant to be read and shared.",
          "The report view is built for printing, so Print or Save as PDF produces a clean document without the app chrome.",
          "Finalizing a report is recorded in the program history.",
        ],
      },
      {
        kind: "note",
        text: "Report content reflects the state of the program at the moment it was generated. Regenerate after new findings if the report needs to include them.",
      },
    ],
  },
  {
    id: "history",
    title: "What the history tab records",
    blocks: [
      {
        kind: "p",
        text: "History is written for you. Creating a program, moving it to a new status, uploading or deleting a file, walking an activity through its statuses, recording a finding, adding or removing evidence, and generating or finalizing a report all append an entry with the time and the researcher who did it. Nothing in History is editable.",
      },
      {
        kind: "p",
        text: "Use it to reconstruct how a conclusion was reached, to confirm what changed before a report was finalized, or to see who contributed what to a case.",
      },
    ],
  },
  {
    id: "environment",
    title: "This workspace",
    blocks: [
      {
        kind: "p",
        text: "The workspace starts life with a few fabricated demo cases so you can try the workflow without your own files in it. The badge in the header carries the full disclosure and is worth reading before you show a report to anyone. Anything you upload yourself is your own data and is not treated as synthetic.",
      },
      {
        kind: "p",
        text: "Everything lives on the machine running the app: the database is a single file under the data folder, and uploaded files sit beside it. Backing the app up means copying that folder.",
      },
      {
        kind: "p",
        text: "Sample files for demonstrating the upload flow are kept in the samples folder of the project, and can be regenerated with npm run samples. They are listed in the project README.",
      },
    ],
  },
  {
    id: "troubleshooting",
    title: "If something goes wrong",
    blocks: [
      {
        kind: "terms",
        items: [
          [
            "A page will not load",
            "Try again from the error message. If it persists, the app is probably still starting up or the local database is not ready.",
          ],
          [
            "An upload is rejected",
            "Check the type and the size against the list in Adding data. The rejection message names the reason.",
          ],
          [
            "A preview says it is unavailable",
            "The file is not on disk. It was most likely deleted from another session while the record remained.",
          ],
          [
            "A patient link returns 404",
            "The program is not visible to your account. Each researcher only sees their own patients.",
          ],
          [
            "A generated report is missing recent work",
            "It was generated before that work existed. Regenerate it.",
          ],
          [
            "The walkthrough will not reopen",
            "The tour is hidden once dismissed. Clear this site's storage for localhost, or use the link on this page.",
          ],
        ],
      },
    ],
  },
];

export const HELP_GLOSSARY: Array<{ term: string; definition: string }> = [
  {
    term: "Research program",
    definition:
      "The container for one patient's investigation. It holds the hypothesis, the data, the activities, and the reports.",
  },
  {
    term: "Program status",
    definition:
      "Where the program sits in its lifecycle: Planned, Active, Paused, Closing, or Closed. Only the moves that make sense from the current status are offered, and each one is recorded in History.",
  },
  {
    term: "Hypothesis",
    definition:
      "The question the program is trying to answer, written down so it can be tested and, eventually, settled.",
  },
  { term: "Activity", definition: "One piece of analytical work, with a type, a hypothesis, and a status." },
  {
    term: "Finding",
    definition: "Something you concluded as a result of an activity, with a significance level attached.",
  },
  {
    term: "Evidence",
    definition:
      "A source that supports a finding: a publication, a database record, a clinical record, a dataset, or a note.",
  },
  { term: "Variant", definition: "A difference from the reference genome at a particular position." },
  {
    term: "SNV",
    definition: "Single nucleotide variant — a one-letter change. The most common kind of variant.",
  },
  {
    term: "Structural variant",
    definition: "A larger change: a deletion, a duplication, or an inversion spanning many bases.",
  },
  {
    term: "VCF",
    definition: "Variant Call Format, the standard text layout for a list of variants and their annotations.",
  },
  {
    term: "BED",
    definition: "A plain interval file listing genomic regions of interest, usually with coordinates.",
  },
  {
    term: "GFF",
    definition: "General Feature Format — a file describing where genes and transcripts sit on a genome.",
  },
  {
    term: "FASTA",
    definition: "A text format for biological sequences, used here to carry reference sequence excerpts.",
  },
  {
    term: "Read depth (DP)",
    definition: "How many times a position was read. Higher depth means more confidence in the call.",
  },
  {
    term: "Allele frequency (AF)",
    definition:
      "How common a variant is in the sample. A frequency near 1.0 suggests it is present in most reads.",
  },
  {
    term: "VUS",
    definition: "Variant of uncertain significance — a real difference whose effect is not yet established.",
  },
  {
    term: "Pathogenic",
    definition:
      "A classification meaning a variant is considered likely to cause disease. It is a claim about evidence, not a diagnosis.",
  },
  {
    term: "Karyotype",
    definition:
      "A schematic of a genome's chromosomes. Structural differences are often visible here before sequencing.",
  },
  {
    term: "Cohort",
    definition:
      "A group of patients compared against each other, used to see whether a finding is specific or common.",
  },
  {
    term: "Draft",
    definition: "A report that can still be regenerated. Reports stay drafts until explicitly finalized.",
  },
];

export const HELP_TOUR_HREF = "/?onboard=1";
