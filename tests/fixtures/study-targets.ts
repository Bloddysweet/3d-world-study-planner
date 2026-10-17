// User-supplied structure/semantics, with resource URLs anonymised before publication.
import type { AiPlan, AiTask } from "../../src/domain/ai-targets";
export const samplePaste = `MATHS

1) Practice 10 Multiply ( Set at Expert level- Maths Workout App

2) Attempt Calculation Mock-1 (Selection Way-Testranking App)

3) Basic Maths (Foundation Phase) - 1st 3 hours video

[https://resources.example/maths-foundation-video](https://resources.example/maths-foundation-video)

4) Learn Day- 1/5

                 Squares 1-30

                 Cubes 1-15

                 Tables 1-25

REASONING

1) Learn Coding - Decoding Alphabate Position.

Download : [https://resources.example/reasoning-folder](https://resources.example/reasoning-folder)

ENGLISH

1) English Tense Rules - from Neetu mam Vol-1

2) OWS - 1- 50 (from blackbook) (From starting)

[https://resources.example/english-ows-video](https://resources.example/english-ows-video)

3) Nimisha Ma'am - Daily Editorial

                      OR

English Madhyam Channel - Reading Comprehension

NOTE- If you dont have the books mentioned above, no need to worry, all the PDFs are uploaded on student pdf corner group.

[https://resources.example/shared-pdf-group](https://resources.example/shared-pdf-group)`;
const mathsVideo = "https://resources.example/maths-foundation-video",
  drive = "https://resources.example/reasoning-folder",
  englishVideo = "https://resources.example/english-ows-video",
  telegram = "https://resources.example/shared-pdf-group";
const task = (
  subjectId: string,
  subjectName: string,
  topicName: string,
  title: string,
  source: string,
  patch: Partial<AiTask> = {},
): AiTask => ({
  subjectId,
  subjectName,
  topicId: null,
  topicName,
  group: "",
  title,
  source,
  minutes: null,
  quantity: "",
  difficulty: "",
  range: "",
  coverage: "",
  priority: false,
  revision: null,
  resources: [],
  alternatives: [],
  warnings: [],
  ...patch,
});
export const expectedPlan: AiPlan = {
  tasks: [
    task(
      "maths",
      "SSC Mathematics",
      "Multiplication",
      "Practise 10 multiplication questions",
      "1) Practice 10 Multiply ( Set at Expert level- Maths Workout App",
      {
        quantity: "10 questions",
        difficulty: "Expert",
        resources: [
          { name: "Maths Workout App", url: null, source: "Maths Workout App" },
        ],
      },
    ),
    task(
      "maths",
      "SSC Mathematics",
      "Calculations",
      "Attempt Calculation Mock-1",
      "2) Attempt Calculation Mock-1 (Selection Way-Testranking App)",
      {
        resources: [
          {
            name: "Selection Way — Testranking App",
            url: null,
            source: "Selection Way-Testranking App",
          },
        ],
      },
    ),
    task(
      "maths",
      "SSC Mathematics",
      "Basic Maths",
      "Watch the foundation maths video",
      "3) Basic Maths (Foundation Phase) - 1st 3 hours video",
      {
        coverage: "Foundation Phase — first 3 hours of video",
        resources: [
          {
            name: "Foundation maths video",
            url: mathsVideo,
            source: mathsVideo,
          },
        ],
      },
    ),
    task(
      "maths",
      "SSC Mathematics",
      "Squares",
      "Learn squares 1–30",
      "Squares 1-30",
      { range: "1-30", coverage: "Day 1/5" },
    ),
    task(
      "maths",
      "SSC Mathematics",
      "Cubes",
      "Learn cubes 1–15",
      "Cubes 1-15",
      { range: "1-15", coverage: "Day 1/5" },
    ),
    task(
      "maths",
      "SSC Mathematics",
      "Tables",
      "Learn tables 1–25",
      "Tables 1-25",
      { range: "1-25", coverage: "Day 1/5" },
    ),
    task(
      "reasoning",
      "SSC Reasoning",
      "Coding–Decoding",
      "Learn alphabet positions",
      "1) Learn Coding - Decoding Alphabate Position.",
      {
        resources: [
          {
            name: "Coding–Decoding download folder",
            url: drive,
            source: drive,
          },
        ],
      },
    ),
    task(
      "english",
      "English & Vocabulary",
      "Tenses",
      "Learn English tense rules",
      "1) English Tense Rules - from Neetu mam Vol-1",
      {
        resources: [
          { name: "Neetu mam Vol-1", url: null, source: "Neetu mam Vol-1" },
        ],
      },
    ),
    task(
      "english",
      "English & Vocabulary",
      "One-word substitutions",
      "Learn OWS entries 1–50",
      "2) OWS - 1- 50 (from blackbook) (From starting)",
      {
        range: "1-50",
        coverage: "From the beginning",
        resources: [
          { name: "Blackbook", url: null, source: "blackbook" },
          { name: "OWS video", url: englishVideo, source: englishVideo },
        ],
      },
    ),
    task(
      "english",
      "English & Vocabulary",
      "Reading practice",
      "Complete one reading activity",
      "3) Nimisha Ma'am - Daily Editorial\n\n                      OR\n\nEnglish Madhyam Channel - Reading Comprehension",
      {
        alternatives: [
          {
            title: "Read the daily editorial",
            resources: [
              {
                name: "Nimisha Ma'am",
                url: null,
                source: "Nimisha Ma'am - Daily Editorial",
              },
            ],
            source: "Nimisha Ma'am - Daily Editorial",
          },
          {
            title: "Practise reading comprehension",
            resources: [
              {
                name: "English Madhyam Channel",
                url: null,
                source: "English Madhyam Channel - Reading Comprehension",
              },
            ],
            source: "English Madhyam Channel - Reading Comprehension",
          },
        ],
      },
    ),
  ],
  sharedResources: [
    {
      name: "Student PDF corner group — fallback PDFs",
      url: telegram,
      source: telegram,
    },
  ],
  sharedNotes: [
    {
      text: "PDFs of the mentioned books are available in the student PDF corner group.",
      source:
        "NOTE- If you dont have the books mentioned above, no need to worry, all the PDFs are uploaded on student pdf corner group.",
    },
  ],
  questions: [],
};
