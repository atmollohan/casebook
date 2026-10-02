import fs from "node:fs";
import { getDb, type Db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { createUser, logHistory } from "@/lib/db/repo";
import { saveUpload, resolveDataDir } from "@/lib/files/storage";
import { generateReport } from "@/lib/report/generate";
import { serializeAttributes } from "@/lib/attributes";
import { now, MS_DAY, newId } from "@/lib/utils/format";

const DAY = MS_DAY;

function at(daysAgo: number, hourOffset = 0): number {
  return now() - daysAgo * DAY + hourOffset * 3600_000;
}

interface SeedCtx {
  db: Db;
  userId: string;
  userName: string;
}

function seedUser(db: Db): { id: string; name: string } {
  const email = process.env.DEMO_EMAIL ?? "demo@example.com";
  const password = process.env.DEMO_PASSWORD ?? "demo-password";
  const found = db.$client.prepare("select * from users where email = ?").get(email) as
    schema.User | undefined;
  if (found) return { id: found.id, name: found.name };
  const user = createUser(db, {
    email,
    passwordHash: hashPassword(password),
    name: "Dr. Avery Lin",
    title: "Principal Investigator",
  });
  return { id: user.id, name: user.name };
}

function createCaseProgram(
  ctx: SeedCtx,
  input: {
    code: string;
    title: string;
    subtitle?: string;
    kind: string;
    summary: string;
    attributes?: Record<string, string>;
    program: {
      title: string;
      description: string;
      hypothesis: string;
      focusArea: string;
      status: string;
      createdAt: number;
    };
  },
): { caseId: string; programId: string } {
  const { db } = ctx;
  const caseId = newId("cas");
  const programId = newId("prg");
  const created = input.program.createdAt;
  db.insert(schema.cases)
    .values({
      id: caseId,
      code: input.code,
      ownerId: ctx.userId,
      title: input.title,
      subtitle: input.subtitle ?? null,
      kind: input.kind,
      summary: input.summary,
      attributes: serializeAttributes(input.attributes),
      createdAt: created,
      updatedAt: created,
    })
    .run();
  db.insert(schema.researchPrograms)
    .values({
      id: programId,
      caseId,
      title: input.program.title,
      description: input.program.description,
      hypothesis: input.program.hypothesis,
      focusArea: input.program.focusArea,
      status: input.program.status,
      createdAt: created,
      updatedAt: created,
    })
    .run();
  logHistory(db, {
    programId,
    actorId: ctx.userId,
    eventType: "program_created",
    entityType: "research_program",
    entityId: programId,
    summary: `Research program “${input.program.title}” created for ${input.code} “${input.title}”`,
    createdAt: created,
  });
  return { caseId, programId };
}

function seedDataFile(
  ctx: SeedCtx,
  input: {
    programId: string;
    programCreatedAt: number;
    filename: string;
    content: string;
    title: string;
    category: string;
    description?: string;
    uploadedDaysAgo: number;
  },
) {
  const { db } = ctx;
  const stored = saveUpload(Buffer.from(input.content, "utf8"), input.filename, input.programId);
  const uploadedAt = at(input.uploadedDaysAgo);
  const record: schema.DataRecord = {
    id: newId("rec"),
    programId: input.programId,
    uploadedById: ctx.userId,
    title: input.title,
    category: input.category,
    originalFilename: input.filename,
    mimeType: stored.mimeType,
    sizeBytes: stored.sizeBytes,
    storagePath: stored.storagePath,
    description: input.description ?? null,
    isSynthetic: true,
    uploadedAt,
  };
  db.insert(schema.dataRecords).values(record).run();
  logHistory(db, {
    programId: input.programId,
    actorId: ctx.userId,
    eventType: "data_uploaded",
    entityType: "data_record",
    entityId: record.id,
    summary: `Uploaded “${record.title}” (${record.originalFilename})`,
    metadataJson: JSON.stringify({ category: record.category }),
    createdAt: uploadedAt,
  });
  return record;
}

function seedActivity(
  ctx: SeedCtx,
  input: {
    programId: string;
    title: string;
    activityType: string;
    description: string;
    hypothesis?: string;
    status: "planned" | "in_progress" | "completed";
    createdAtDaysAgo: number;
    completedDaysAgo?: number;
  },
): schema.ResearchActivity {
  const { db } = ctx;
  const created = at(input.createdAtDaysAgo);
  const completedAt = input.completedDaysAgo != null ? at(input.completedDaysAgo) : null;
  const id = newId("act");
  db.insert(schema.researchActivities)
    .values({
      id,
      programId: input.programId,
      createdById: ctx.userId,
      title: input.title,
      activityType: input.activityType,
      description: input.description,
      hypothesis: input.hypothesis ?? null,
      status: input.status,
      startedAt: completedAt ? at(input.createdAtDaysAgo - 1) : input.status === "in_progress" ? at(2) : null,
      completedAt,
      createdAt: created,
      updatedAt: completedAt ?? created,
    })
    .run();
  logHistory(db, {
    programId: input.programId,
    actorId: ctx.userId,
    eventType: "activity_created",
    entityType: "research_activity",
    entityId: id,
    summary: `Activity “${input.title}” created`,
    createdAt: created,
  });
  if (input.status === "in_progress") {
    logHistory(db, {
      programId: input.programId,
      actorId: ctx.userId,
      eventType: "activity_started",
      entityType: "research_activity",
      entityId: id,
      summary: `Activity “${input.title}” started`,
      createdAt: at(2),
    });
  }
  if (completedAt) {
    logHistory(db, {
      programId: input.programId,
      actorId: ctx.userId,
      eventType: "activity_completed",
      entityType: "research_activity",
      entityId: id,
      summary: `Activity “${input.title}” completed`,
      createdAt: completedAt,
    });
  }
  return {
    id,
    programId: input.programId,
    activityType: input.activityType,
  } as unknown as schema.ResearchActivity;
}

function seedFinding(
  ctx: SeedCtx,
  input: {
    programId: string;
    activityId?: string | null;
    title: string;
    description: string;
    category: string;
    significance: string;
    createdAtDaysAgo: number;
  },
): schema.Finding {
  const { db } = ctx;
  const id = newId("fnd");
  const created = at(input.createdAtDaysAgo);
  db.insert(schema.findings)
    .values({
      id,
      programId: input.programId,
      activityId: input.activityId ?? null,
      reportedById: ctx.userId,
      title: input.title,
      description: input.description,
      category: input.category,
      significance: input.significance,
      createdAt: created,
      updatedAt: created,
    })
    .run();
  logHistory(db, {
    programId: input.programId,
    actorId: ctx.userId,
    eventType: "finding_created",
    entityType: "finding",
    entityId: id,
    summary: `Finding recorded: “${input.title}”`,
    metadataJson: JSON.stringify({ significance: input.significance }),
    createdAt: created,
  });
  return { id, programId: input.programId } as schema.Finding;
}

function seedEvidence(
  ctx: SeedCtx,
  input: {
    findingId: string;
    programId: string;
    sourceType: string;
    title: string;
    url?: string;
    doi?: string;
    note?: string;
    createdAtDaysAgo: number;
  },
) {
  const { db } = ctx;
  db.insert(schema.evidence)
    .values({
      id: newId("evd"),
      findingId: input.findingId,
      addedById: ctx.userId,
      sourceType: input.sourceType,
      title: input.title,
      url: input.url ?? null,
      doi: input.doi ?? null,
      note: input.note ?? null,
      attachmentDataRecordId: null,
      createdAt: at(input.createdAtDaysAgo),
    })
    .run();
  logHistory(db, {
    programId: input.programId,
    actorId: ctx.userId,
    eventType: "evidence_added",
    entityType: "evidence",
    entityId: input.findingId,
    summary: `Evidence added: ${input.title}`,
    createdAt: at(input.createdAtDaysAgo),
  });
}

// ---------------------------------------------------------------------------
// File contents
// ---------------------------------------------------------------------------

const CLL_VARIANTS_CSV = `gene,variant,chrom,pos,ref,alt,type,consequence,vaf,reads,total_depth,transcript,known_impact
TP53,del(17p)/LOH,17,7668402,-,-,deletion,gene_loss,0.86,NA,NA,ENST00000269305,loss_of_function
TP53,c.659A>G (p.Tyr220Cys),17,7673538,T,C,snv,missense_variant,0.41,183,446,ENST00000269305,pathogenic
ATM,c.5266dupA (p.Met1756Asnfs*10),11,108236082,A,AT,frameshift,others,0.22,97,440,ENST00000249349,deleterious
SF3B1,c.2098A>G (p.Lys700Glu),2,198267483,A,G,snv,missense_variant,0.34,152,447,ENST00000335508,deleterious
NOTCH1,c.7544_7545delCT (p.Pro2515Argfs*4),9,139390649,CT,-,frameshift,others,0.19,84,442,ENST00000277541,deleterious
MYD88,c.794T>C (p.Leu265Pro),3,38181441,T,C,snv,missense_variant,0.08,36,439,ENST00000326024,likely_deleterious
BIRC3,c.1726T>A (p.Ter576Arg),11,102198611,T,A,snv,stop_lost,others,0.14,61,436,ENST00000263047,del(11q) region
FBXW7,c.1168C>A (p.Pro390Thr),4,153247289,C,A,snv,missense_variant,0.11,48,435,ENST00000281755,conflicting
RPS15,c.284A>G (p.Tyr95Cys),19,14395876,A,G,snv,missense_variant,0.11,47,430,ENST00000251458,conflicting
XPO1,c.1712C>A (p.Ser571Tyr),2,61511920,C,A,snv,missense_variant,0.12,50,427,ENST00000393010,likely_deleterious
SAMHD1,c.1600C>T (p.Arg534Trp),20,35540329,C,T,snv,missense_variant,0.09,37,424,ENST00000372328,conflicting
DDX3X,c.1069G>A (p.Glu357Lys),X,41243232,G,A,snv,missense_variant,0.07,29,419,ENST00000329846,conflicting
ZNF292,c.4724C>T (p.Thr1575Met),6,87322380,C,T,snv,missense_variant,0.06,25,417,ENST00000366767,unknown
SETD2,c.7066C>T (p.Arg2356Trp),3,47152845,C,T,snv,missense_variant,0.13,54,415,ENST00000439484,likely_deleterious
CHD2,c.4834G>A (p.Val1612Met),15,93418985,G,A,snv,missense_variant,0.1,40,410,ENST00000534291,unknown`;

const CLL_SV_VCF = `##fileformat=VCFv4.2
##source=casebook-synthetic-sv-tool-v1 (DEMO)
##fileDate=2026-06-08
##reference=GRCh38
##contig=<ID=17>
##INFO=<ID=SVTYPE,Number=1,Type=String,Description="Type of structural variant">
##INFO=<ID>END,Number=1,Type=Integer,Description="End position of the variant described in this record">
##ALT=<ID>DEL,Description="Deletion">
##FILTER=<ID>PASS,Description="All filters passed">
#CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO
17	7668402	DUP40	C	<DEL>	NA	PASS	SVTYPE=DEL;END=7690003;VR=87;TIER=1
17	7668402	TP53_DEL	C	<DEL>	NA	PASS	SVTYPE=DEL;END=7695002;VR=92;TIER=1
13	49047777	DUP57	R	<DEL>	NA	PASS	SVTYPE=DEL;END=50030741;VR=71;TIER=2
12	1	DUP99	A	<DUP>	NA	PASS	SVTYPE=DUP;TIER=2
17	7668402	BAL_TP53	D	<GAIN>	NA	PASS	SVTYPE=GAIN;END=7693311;VR=5;TIER=3`;

const CBC_CSV = `date,wbc_k_ul,lymphocytes_k_ul,hemoglobin_g_dl,platelets_k_ul,note
2026-08-01,12.4,9.8,11.2,151,treatment cycle baseline
2026-08-22,14.1,11.3,10.9,143,post-cycle 1
2026-09-05,15.8,12.7,10.4,138,post-cycle 2 (rising lymphocytosis)
2026-09-19,17.2,14.1,10.1,129,current`;

const KARYOTYPE_TXT = `CYTOGENETIC ANALYSIS REPORT (SYNTHETIC, DEMO ONLY)

Specimen: peripheral blood
Protocol: stimulated lymphocyte culture, G-banding, 20 metaphases

Karyotype: 46,XX,del(17p13.1),del(13q14.3)[17]/46,XX[3]

Comments:
- clonal deletion of 17p13.1 observed in 85% of evaluated metaphases
- concurrent interstitial deletion of 13q14.3 present in the same clone
- residual normal clone in 3/20 metaphases
- consistent with TP53 locus disruption (17p13.1)

Note: synthetic deidentified result generated for demo purposes.`;

const TREATMENT_MD = `# Treatment history, synthetic deidentified

## Regimen
- **Front-line**: fludarabine, cyclophosphamide, rituximab (FCR) × 3 cycles, 2026 (demo dates)
- **Response**: partial; re-treatment declined due to persistent cytopenias
- **Current**: observation with serial monitoring while research enrollment active

## Notable toxicities
- Grade 2 neutropenia during cycle 2
- Discontinued earlier than standard 6 cycles per investigator discretion

> All entries are synthetic placeholders for demonstration of the workflow.`;

const CLINICAL_REFERENCE_TXT = `Initial consult summary (synthetic, deidentified)

Ms. P.O., 57y female referred for evaluation of refractory lymphocytosis with splenomegaly.

Diagnosis: chronic lymphocytic leukemia (CLL), Rai stage II at referral; treatment-refractory course.

Key finding on workup: FISH/cytogenetics demonstrate del(17p13.1) in the predominant clone.

Research objective: characterize TP53 pathway status and clonal dynamics to inform future
investigator-initiated studies. No individual treatment recommendations are part of this program.

This document is synthetic research-support material, not a clinical record.`;

const TNBC_QC_CSV = `sample_id,chr,pos,ref,alt,gene,consequence,vaf,quality,passed_qc
MB-00021-T,17,7668402,G,A,TP53,missense_variant,0.58,PASS,1
MB-00021-T,13,49047777,C,T,RB1,synonymous_variant,0.09,PASS,1
MB-00021-T,3,179198397,A,G,PIK3CA,missense_variant,0.71,PASS,1
MB-00021-T,17,37888897,G,A,ERBB2,missense_variant,0.12,PASS,1
MB-00021-T,16,23665127,A,C,PALB2,missense_variant,0.55,PASS,1
MB-00021-T,11,108236082,G,A,ATM,missense_variant,0.05,PASS,0`;

const HRD_JSON = `{
  "sample": "MB-00021-T",
  "assay": "targeted panel + shallow WGS",
  "hrd_score": 61,
  "components": {
    "lst": 12,
    "tai": 14,
    "loh": 35
  },
  "interpretation_flag": "elevated",
  "notes": "Synthetic placeholder values for demo. HRD scoring pipeline not implemented."
}`;

const IMAGING_TXT = `Imaging review note (synthetic)

Study: CT chest/abdomen/pelvis with contrast (demo)
Indication: treatment response assessment
Findings:
- Index hepatic lesion: two lesions in segment VIII (17 mm and 9 mm)
- No new lesions compared with prior study
- Mild ascites unchanged
- No pleural effusion

Assessment: stable disease per RECIST 1.1 (target lesions unchanged)
Note: synthetic image review note for workflow demonstration.`;

// ---------------------------------------------------------------------------
// Main seed
// ---------------------------------------------------------------------------

export function runSeed() {
  fs.mkdirSync(resolveDataDir(), { recursive: true });
  const db = getDb();
  const user = seedUser(db);
  const alreadySeeded = db.$client.prepare("select id from cases where code = ?").get("CB-C-0001") as
    { id: string } | undefined;
  if (alreadySeeded) {
    console.log("Seed data already present; skipping case seeding.");
    return user;
  }
  const ctx: SeedCtx = { db, userId: user.id, userName: user.name };

  // --- Case 1: flagship, fully built out ----------------------------------
  // The strongest worked example, and the one the DNA/oncology focus belongs to. It is a
  // `subject` case like any other; nothing about it is special-cased by the app.
  const case1 = createCaseProgram(ctx, {
    code: "CB-C-0001",
    title: "Patricia Okafor",
    subtitle: "treatment-refractory CLL",
    kind: "subject",
    summary:
      "Chronic lymphocytic leukemia (CLL), treatment-refractory course; research focus on TP53 disruption and clonal dynamics.",
    attributes: {
      "Birth year": "1969",
      Sex: "Female",
      "Consent status": "Consent on file",
      Specimen: "Peripheral blood, 3 draws",
      Enrolment: "2026-06-30",
    },
    program: {
      title: "TP53 disruption in treatment-refractory CLL",
      description:
        "Ongoing investigation of biallelic TP53 disruption and clonal dynamics as drivers of refractory CLL. The program catalogues genomic, cytogenetic, and laboratory data and records research activities, findings, and evidence as they accumulate.",
      hypothesis:
        "Loss of TP53 function via deletion (17p) and/or mutation underlies therapy resistance in CLL and is associated with expansion of high-risk clones.",
      focusArea: "Genomics, somatic variants",
      status: "active",
      createdAt: at(90),
    },
  });

  seedDataFile(ctx, {
    programId: case1.programId,
    programCreatedAt: at(90),
    filename: "okafor_wes_variant_calls.csv",
    content: CLL_VARIANTS_CSV,
    title: "WES variant calls, tumor sample",
    category: "genomics",
    description:
      "Somatic variant calls (tumor WES, 60-day window). Synthetic placeholders, workflow demo only.",
    uploadedDaysAgo: 66,
  });

  seedDataFile(ctx, {
    programId: case1.programId,
    programCreatedAt: at(90),
    filename: "okafor_sv_calls.vcf",
    content: CLL_SV_VCF,
    title: "Structural variant calls (VCF)",
    category: "genomics",
    description:
      "Structural variant calls highlighting 17p deletion and 13q deletion. Synthetic placeholders.",
    uploadedDaysAgo: 66,
  });

  seedDataFile(ctx, {
    programId: case1.programId,
    programCreatedAt: at(90),
    filename: "okafor_karyotype.txt",
    content: KARYOTYPE_TXT,
    title: "Cytogenetics, karyotype result",
    category: "clinical",
    description: "G-banded karyotype demonstrating del(17p13.1) in the predominant clone. Synthetic result.",
    uploadedDaysAgo: 52,
  });

  seedDataFile(ctx, {
    programId: case1.programId,
    programCreatedAt: at(90),
    filename: "okafor_treatment_history.md",
    content: TREATMENT_MD,
    title: "Treatment history, summary",
    category: "clinical",
    description: "Synthetic treatment history used for clinical correlate activities.",
    uploadedDaysAgo: 52,
  });

  seedDataFile(ctx, {
    programId: case1.programId,
    programCreatedAt: at(90),
    filename: "okafor_cbc_serial.csv",
    content: CBC_CSV,
    title: "Serial CBC trend",
    category: "lab",
    description: "Serial complete blood counts showing escalating lymphocytosis.",
    uploadedDaysAgo: 12,
  });

  seedDataFile(ctx, {
    programId: case1.programId,
    programCreatedAt: at(90),
    filename: "okafor_clinical_reference.txt",
    content: CLINICAL_REFERENCE_TXT,
    title: "Initial consult summary (reference)",
    category: "documentation",
    description: "Deidentified reference summary placed in the program context.",
    uploadedDaysAgo: 40,
  });

  const act1 = seedActivity(ctx, {
    programId: case1.programId,
    title: "Assess TP53 variant burden in tumor WES",
    activityType: "variant_analysis",
    description:
      "Review of somatic variant calls from tumor WES, focused on TP53, ATM, SF3B1, NOTCH1, and other recurrently mutated genes in CLL.",
    hypothesis: "TP53 pathway disruption is the dominant driver in this refractory case.",
    status: "completed",
    createdAtDaysAgo: 64,
    completedDaysAgo: 58,
  });

  const act2 = seedActivity(ctx, {
    programId: case1.programId,
    title: "Literature scan: 17p deletion and CLL therapy resistance",
    activityType: "literature_review",
    description:
      "Scan of recent literature on del(17p) and TP53 disruption as predictors of resistance to chemoimmunotherapy and targeted agents.",
    hypothesis: "Published cohorts associate del(17p) with shorter PFS across regimens.",
    status: "completed",
    createdAtDaysAgo: 56,
    completedDaysAgo: 48,
  });

  const act3 = seedActivity(ctx, {
    programId: case1.programId,
    title: "Correlate lymphocyte kinetics with TP53 status",
    activityType: "statistical_analysis",
    description:
      "Plot serial CBC data against genomic findings to describe the tempo of clone expansion. Companion analysis; results recorded manually.",
    hypothesis: "Serial lymphocytosis kinetics track the TP53-disrupted clone fraction.",
    status: "in_progress",
    createdAtDaysAgo: 10,
  });

  const f1 = seedFinding(ctx, {
    programId: case1.programId,
    activityId: act1.id,
    title: "Biallelic TP53 disruption in the dominant clone",
    description:
      "Tumor WES shows TP53 loss via 17p deletion (VAF 0.86 at the locus) together with a missense mutation (c.659A>G, p.Tyr220Cys, VAF 0.41). Together these indicate near-complete disruption of the TP53 pathway in the dominant clone, consistent with refractory disease.",
    category: "molecular",
    significance: "high",
    createdAtDaysAgo: 47,
  });

  const f2 = seedFinding(ctx, {
    programId: case1.programId,
    activityId: act3.id,
    title: "Expanding clone carrying SF3B1 K700E",
    description:
      "A subclone carrying SF3B1 K700E (VAF 0.34 in the most recent sample) is expanding. Cross-sectional serial measurement shows increasing burden aligned with rising lymphocytosis.",
    category: "molecular",
    significance: "medium",
    createdAtDaysAgo: 9,
  });

  const f3 = seedFinding(ctx, {
    programId: case1.programId,
    activityId: null,
    title: "Cytogenetic confirmation of 17p and 13q deletions",
    description:
      "G-banding confirms del(17p13.1) and del(13q14.3) in 17/20 metaphases. The 13q deletion is a common CLL alteration in the same clone.",
    category: "clinical",
    significance: "medium",
    createdAtDaysAgo: 44,
  });

  const f4 = seedFinding(ctx, {
    programId: case1.programId,
    activityId: act2.id,
    title: "Resistance profile aligns with published TP53-loss cohorts",
    description:
      "The observed pattern, 17p loss, short duration of response, and escalating lymphocytosis, aligns with published cohorts describing poor outcomes with conventional chemoimmunotherapy in TP53-disrupted CLL.",
    category: "clinical",
    significance: "high",
    createdAtDaysAgo: 42,
  });

  seedEvidence(ctx, {
    findingId: f1.id,
    programId: case1.programId,
    sourceType: "publication",
    title: "TP53 disruption and 17p deletion as independent risk factors in CLL",
    url: "https://pubmed.ncbi.nlm.nih.gov/26384929/",
    note: "Reference for TP53 loss in CLL.",
    createdAtDaysAgo: 47,
  });
  seedEvidence(ctx, {
    findingId: f1.id,
    programId: case1.programId,
    sourceType: "database",
    title: "COSMIC genomic mutation catalogue, TP53 (synthetic mirror)",
    url: "https://cancer.sanger.ac.uk/cosmic/gene/analysis?ln=TP53",
    note: "Database entry mirrored for demo.",
    createdAtDaysAgo: 46,
  });
  seedEvidence(ctx, {
    findingId: f2.id,
    programId: case1.programId,
    sourceType: "dataset",
    title: "Serial WES variant calls (synthetic sequencing dataset)",
    note: "Primary dataset analysed for clone expansion.",
    createdAtDaysAgo: 9,
  });
  seedEvidence(ctx, {
    findingId: f3.id,
    programId: case1.programId,
    sourceType: "clinical_record",
    title: "Cytogenetics result, karyotype analysis (synthetic)",
    note: "Clinical correlate within the research program.",
    createdAtDaysAgo: 44,
  });
  seedEvidence(ctx, {
    findingId: f4.id,
    programId: case1.programId,
    sourceType: "publication",
    title: "High-risk genomic features and survival in treatment-naive CLL",
    doi: "10.1182/blood.2020007684",
    note: "Cohort evidence supporting PFS association.",
    createdAtDaysAgo: 42,
  });

  seedReport(ctx, {
    programId: case1.programId,
    title: "Research report · Patricia Okafor",
    status: "draft",
    createdAtDaysAgo: 3,
  });

  // --- Case 2: mid-maturity ------------------------------------------------
  const case2 = createCaseProgram(ctx, {
    code: "CB-C-0002",
    title: "Marcus Whitfield",
    subtitle: "metastatic triple-negative breast cancer",
    kind: "subject",
    summary:
      "Metastatic triple-negative breast cancer (TNBC); research focus on homologous recombination deficiency and platinum sensitivity.",
    attributes: {
      "Birth year": "1974",
      Sex: "Male",
      "Consent status": "Consent on file",
      Stage: "IV, de novo",
      Specimen: "Tumor biopsy, primary + 2 mets",
    },
    program: {
      title: "Homologous recombination deficiency in TNBC",
      description:
        "Evaluating HRD-associated genomic scars in a TNBC case with a BRCA2-like copy-number profile. Sequences, QC, and HRD scores are catalogued; analysis in progress.",
      hypothesis:
        "Elevated HRD scar scores correlate with enhanced sensitivity to platinum-containing regimens in this clinical context.",
      focusArea: "Genomics, copy number",
      status: "active",
      createdAt: at(40),
    },
  });

  seedDataFile(ctx, {
    programId: case2.programId,
    programCreatedAt: at(40),
    filename: "whitfield_panel_qc.csv",
    content: TNBC_QC_CSV,
    title: "Targeted panel, QC-passed variant calls",
    category: "genomics",
    description: "Synthetic panel QC + variant calls.",
    uploadedDaysAgo: 27,
  });
  seedDataFile(ctx, {
    programId: case2.programId,
    programCreatedAt: at(40),
    filename: "whitfield_hrd_score.json",
    content: HRD_JSON,
    title: "HRD scar score (computed)",
    category: "genomics",
    description: "Synthetic HRD score placeholders.",
    uploadedDaysAgo: 20,
  });
  seedDataFile(ctx, {
    programId: case2.programId,
    programCreatedAt: at(40),
    filename: "whitfield_ct_imaging_note.txt",
    content: IMAGING_TXT,
    title: "On-treatment imaging review note",
    category: "imaging",
    description: "Synthetic imaging note: stable disease.",
    uploadedDaysAgo: 18,
  });

  const actB = seedActivity(ctx, {
    programId: case2.programId,
    title: "Verify HRD scar score against luminance thresholds",
    activityType: "statistical_analysis",
    description:
      "Internal check comparing computed HRD score (61) against an internal threshold matrix. Companion verification activity.",
    hypothesis: "Score exceeds threshold consistent with HRD phenotype.",
    status: "in_progress",
    createdAtDaysAgo: 15,
  });

  const fB = seedFinding(ctx, {
    programId: case2.programId,
    activityId: actB.id,
    title: "Composite HRD score above internal reference threshold",
    description:
      "The computed HRD score (61) is above the internal reference threshold (42). Interpretation is provisional pending protocol review.",
    category: "molecular",
    significance: "medium",
    createdAtDaysAgo: 14,
  });

  seedEvidence(ctx, {
    findingId: fB.id,
    programId: case2.programId,
    sourceType: "publication",
    title: "Genomic scars as biomarkers of homologous recombination deficiency",
    doi: "10.1056/NEJMoa1401443",
    note: "Landmark reference on HRD scar-based phenotyping.",
    createdAtDaysAgo: 14,
  });

  // --- Case 3: fresh start (empty states) ----------------------------------
  createCaseProgram(ctx, {
    code: "CB-C-0003",
    title: "Elena Kovalski",
    subtitle: "suspected familial adenomatous polyposis",
    kind: "subject",
    summary: "Suspected familial adenomatous polyposis; research protocol enrollment under active review.",
    attributes: {
      "Birth year": "1988",
      Sex: "Female",
      "Consent status": "Pending verification",
      Enrolment: "2026-09-23",
    },
    program: {
      title: "APC-associated polyposis risk characterization",
      description:
        "Program created on enrollment. Consent verification and data cataloguing are the next steps.",
      hypothesis: "Germline APC variant profiling will clarify surveillance pathways for enrollment cohort.",
      focusArea: "Genetics, germline",
      status: "planned",
      createdAt: at(6),
    },
  });

  // --- Case 4: paused ------------------------------------------------------
  const case4 = createCaseProgram(ctx, {
    code: "CB-C-0004",
    title: "Raymond Silva",
    subtitle: "clival chordoma",
    kind: "subject",
    summary: "Chordoma (clival); research cohort on brachyury-driven tumor biology. Enrollment paused.",
    attributes: {
      "Birth year": "1952",
      Sex: "Male",
      "Consent status": "Consent on file",
      "Tissue available": "Pending adjudication",
    },
    program: {
      title: "Brachyury pathway status in clival chordoma",
      description: "Research data catalogued; program paused pending tissue-availability decision.",
      hypothesis: "Brachyury (T) expression correlates with locally aggressive disease.",
      focusArea: "Molecular oncology",
      status: "paused",
      createdAt: at(150),
    },
  });

  seedDataFile(ctx, {
    programId: case4.programId,
    programCreatedAt: at(150),
    filename: "silva_rnaseq_gene_counts.csv",
    content: `gene,counts_1,counts_2,mean_tpm,fpkm
T,412,388,186.2,91.4
KRT18,3201,3054,730.1,358.0
VIM,2401,2488,510.4,250.2
TBXT,412,388,186.2,91.4
SLC5A5,22,18,3.1,1.5
CD24,1402,1301,296.2,145.2`,
    title: "RNA-seq gene counts (T locus)",
    category: "transcriptomics",
    description: "Synthetic gene counts highlighting the brachyury (T/TBXT) locus.",
    uploadedDaysAgo: 98,
  });
  seedDataFile(ctx, {
    programId: case4.programId,
    programCreatedAt: at(150),
    filename: "silva_enrollment_qc.txt",
    content: `Enrollment & QC record (synthetic)
- Enrollment: complete
- Consent: on file
- Tissue availability: pending adjudication
- Program status: paused by investigator
`,
    title: "Enrollment / QC record",
    category: "documentation",
    description: "Administrative reference note.",
    uploadedDaysAgo: 96,
  });

  seedActivity(ctx, {
    programId: case4.programId,
    title: "Draft analysis plan for T-locus expression",
    activityType: "manuscript_draft",
    description: "Outlined analysis plan for brachyury expression cohort write-up. Superseded by pause.",
    hypothesis: "T expression strata define outcome subgroups.",
    status: "planned",
    createdAtDaysAgo: 30,
  });

  // -------------------------------------------------------------------------
  // Non-human cases. These exist to make the general model visible: a subject is
  // one case kind among several, and the app itself treats them identically.
  // -------------------------------------------------------------------------

  // --- Case 5: a material sample, not a person ------------------------------
  const case5 = createCaseProgram(ctx, {
    code: "CB-C-0005",
    title: "Sediment core 14-B",
    subtitle: "lake basin, 0–40 cm",
    kind: "material",
    summary:
      "Frozen sediment core from a monitored catchment. Research focus on nutrient flux and organic-matter stability.",
    attributes: {
      "Sample type": "Sediment core",
      Depth: "0–40 cm",
      "Collection date": "2026-08-11",
      Storage: "-20 °C",
      "Chain of custody": "CB-CUST-0442",
    },
    program: {
      title: "Phosphorus retention across the sediment column",
      description:
        "Serial porewater extractions and burn-loss fractions across depth, compared against upstream reference sites.",
      hypothesis: "Legacy phosphorus is concentrated in the upper 12 cm and declines sharply with depth.",
      focusArea: "Environmental chemistry",
      status: "active",
      createdAt: at(70),
    },
  });

  seedDataFile(ctx, {
    programId: case5.programId,
    programCreatedAt: at(70),
    filename: "core14b_porewater.csv",
    content: `depth_cm,dissolved_p_ug_l,ammonium_ug_l,ph
0,84.2,61.0,6.8
4,77.9,58.4,6.9
8,71.3,55.1,7.0
12,52.6,48.7,7.1
20,31.4,39.2,7.2
30,19.8,30.6,7.3
40,12.1,26.9,7.4`,
    title: "Porewater chemistry by depth",
    category: "measurement",
    description: "Synthetic depth profile, triplicate means.",
    uploadedDaysAgo: 58,
  });
  seedDataFile(ctx, {
    programId: case5.programId,
    programCreatedAt: at(70),
    filename: "core14b_burn_loss.csv",
    content: `depth_cm,organic_carbon_pct,total_n_pct,loi_pct
0,11.4,1.02,32.6
4,10.9,0.98,31.1
8,10.1,0.94,28.8
12,8.6,0.81,24.2
20,6.2,0.59,17.4
30,4.1,0.38,11.6
40,2.8,0.26,7.9`,
    title: "Loss-on-ignition and organic carbon",
    category: "measurement",
    description: "Synthetic combustion-series results.",
    uploadedDaysAgo: 44,
  });

  const act5 = seedActivity(ctx, {
    programId: case5.programId,
    title: "Compare phosphorus depth profile against reference sites",
    activityType: "cohort_comparison",
    description:
      "Contrasting core 14-B against the two upstream reference cores to separate catchment effects from baseline.",
    hypothesis: "Catchment sites show a steeper surface phosphorus gradient than reference sites.",
    status: "in_progress",
    createdAtDaysAgo: 22,
  });

  const f5 = seedFinding(ctx, {
    programId: case5.programId,
    activityId: act5.id,
    title: "Legacy phosphorus concentrated in the upper 12 cm",
    description:
      "Dissolved phosphorus falls from 84.2 µg/L at the surface to 52.6 µg/L at 12 cm, a 38% decline, then tapers gradually below that. The surface enrichment is consistent with recent loading rather than steady-state release.",
    category: "observation",
    significance: "high",
    createdAtDaysAgo: 20,
  });

  seedEvidence(ctx, {
    findingId: f5.id,
    programId: case5.programId,
    sourceType: "dataset",
    title: "Upstream reference core chemistry, sites R1 and R2",
    note: "Companion reference dataset, same extraction protocol.",
    createdAtDaysAgo: 20,
  });

  // --- Case 6: a device under characterisation -----------------------------
  const case6 = createCaseProgram(ctx, {
    code: "CB-C-0006",
    title: "Thermal imaging rig 3",
    subtitle: "bench prototype",
    kind: "device",
    summary: "Bench prototype imaging rig under calibration study ahead of field deployment.",
    attributes: {
      Build: "Rev C",
      Sensor: "FLIR Lepton 3.5",
      Serial: "CB-DEV-0031",
      "Last serviced": "2026-07-30",
      Operator: "Lab 2",
    },
    program: {
      title: "Emissivity calibration across common surface finishes",
      description:
        "Comparing apparent-temperature error against reference readings for anodised, painted, and bare aluminium coupons.",
      hypothesis: "Bare aluminium shows the largest emissivity error and the largest correction band.",
      focusArea: "Instrumentation",
      status: "active",
      createdAt: at(55),
    },
  });

  seedDataFile(ctx, {
    programId: case6.programId,
    programCreatedAt: at(55),
    filename: "rig3_calibration_log.csv",
    content: `timestamp,surface,reference_c,apparent_c,error_c
2026-08-20T09:14,anodised,42.0,41.6,0.4
2026-08-20T09:22,anodised,58.5,57.9,0.6
2026-08-20T09:30,painted,42.0,41.1,0.9
2026-08-20T09:38,painted,58.5,57.2,1.3
2026-08-20T09:46,aluminium,42.0,38.4,3.6
2026-08-20T09:54,aluminium,58.5,53.1,5.4`,
    title: "Calibration sweep, reference vs apparent temperature",
    category: "measurement",
    description: "Synthetic six-point sweep with a contact reference thermometer.",
    uploadedDaysAgo: 48,
  });

  const act6 = seedActivity(ctx, {
    programId: case6.programId,
    title: "Fit correction bands per surface finish",
    activityType: "statistical_analysis",
    description:
      "Deriving per-surface offset and slope from the calibration sweep, and checking residuals against the instrument's stated accuracy.",
    hypothesis: "A single global correction will not hold across all three finishes.",
    status: "completed",
    createdAtDaysAgo: 30,
    completedDaysAgo: 25,
  });

  const f6 = seedFinding(ctx, {
    programId: case6.programId,
    activityId: act6.id,
    title: "Aluminium needs a surface-specific correction band",
    description:
      "Apparent temperature under-reads bare aluminium by 3.6 °C at 42 °C and 5.4 °C at 58.5 °C. A single global correction derived from the painted coupon would leave errors above the instrument's ±2 °C spec.",
    category: "limitation",
    significance: "medium",
    createdAtDaysAgo: 24,
  });

  seedEvidence(ctx, {
    findingId: f6.id,
    programId: case6.programId,
    sourceType: "measurement",
    title: "Reference thermometer calibration certificate, 2026-03",
    note: "Traceability for the contact reference used in all six points.",
    createdAtDaysAgo: 24,
  });

  return seedUser(db);
}

function seedReport(
  ctx: SeedCtx,
  input: { programId: string; title: string; status: "draft" | "final"; createdAtDaysAgo: number },
) {
  const { db } = ctx;
  let contentJson: string;
  try {
    const report = generateReport(db, input.programId, ctx.userId);
    contentJson = JSON.stringify(report.content);
  } catch {
    contentJson = "[]";
  }
  const created = at(input.createdAtDaysAgo);
  const reportId = newId("rpt");
  db.insert(schema.reports)
    .values({
      id: reportId,
      programId: input.programId,
      generatedById: ctx.userId,
      title: input.title,
      status: input.status,
      summary: "",
      contentJson,
      createdAt: created,
      finalizedAt: null,
    })
    .run();
  logHistory(db, {
    programId: input.programId,
    actorId: ctx.userId,
    eventType: "report_generated",
    entityType: "report",
    entityId: reportId,
    summary: `Report generated: “${input.title}”`,
    createdAt: created,
  });
}
