import { StoryScript } from '../types';

/**
 * Demo series engineered for the 3-minute Insights path:
 * - Eps 3–5: same kidnap → chase → hospital arc (repetition)
 * - Ep 4: three new names dumped in one scene (confusion)
 * - Ep 5 mid-beat: weak / paused conflict (Another cut target)
 */
export const DEMO_SERIES: StoryScript = {
  id: 'demo-harbor-ward',
  title: 'Harbor Ward',
  genre: 'Medical thriller / family drama',
  targetAudience: 'Adult serial audio listeners',
  synopsis:
    'Night-shift nurse Mira finds her missing sister’s bracelet in the ER — then the same crisis keeps looping.',
  episodes: [
    {
      id: 'hw-ep1',
      episodeNumber: 1,
      title: 'Bracelet in Bay 3',
      scriptText: `[SFX: Distant siren, fluorescent hum]

NARRATOR:
Harbor General, 2:14 a.m. Mira Kade has worked nights long enough to stop flinching at blood. She has not stopped looking for her sister, Lena — missing six weeks.

MIRA:
"Bay 3. Male, mid-thirties, stable. Who brought the bracelet?"

ORDERLY:
"Found it under the gurney. No patient claim."

[SFX: Soft metal chain on steel tray]

NARRATOR:
The bracelet is Lena’s. Same scratched charm. Mira’s hands go cold.

MIRA (quiet):
"Whoever left this… they want me to know she’s still in the city."

[SFX: Curtain rings snap shut]`,
    },
    {
      id: 'hw-ep2',
      episodeNumber: 2,
      title: 'The Man Who Won’t Give a Name',
      scriptText: `[SFX: Heart monitor beep]

NARRATOR:
The Jane Doe from Bay 3 is gone by morning. In her place: a man with no ID and a bruised jaw who asks for Mira by name.

STRANGER:
"Lena said you’d come. She said don’t trust the night supervisor."

MIRA:
"Where is she?"

STRANGER:
"Warehouse row. Pier 9. But if you go alone—"

[SFX: Footsteps approaching fast]

NIGHT SUPERVISOR (off):
"Kade. My office. Now."

NARRATOR:
Mira pockets the bracelet. The stranger’s gurney is empty when she turns back.`,
    },
    {
      id: 'hw-ep3',
      episodeNumber: 3,
      title: 'Pier 9 — Again',
      scriptText: `[SFX: Water lapping against pilings, distant foghorn]

NARRATOR:
Mira reaches Pier 9. A van door slides. Hands grab her. Hood. Darkness.

MIRA (muffled):
"Lena—!"

[SFX: Tires screech, chase through alley]

NARRATOR:
She kicks free near the fish market. Runs. A white sedan cuts her off. Then — hospital lights. Someone dumps her at Harbor’s ambulance bay.

ER DOCTOR:
"Nurse down. Possible concussion. Get her to Trauma 2!"

[SFX: Stretchers, overlapping shout]

MIRA (dazed):
"Pier 9… van… they took her again—"

NARRATOR:
Same loop: taken, chased, returned to the ward. No new answers.`,
    },
    {
      id: 'hw-ep4',
      episodeNumber: 4,
      title: 'Three Names, One Room',
      scriptText: `[SFX: Curtain pull, monitor alarm]

NARRATOR:
Mira wakes in Trauma 2. Three people she has never heard of stand over her bed talking as if she should already know the plot.

DR. ANIKA RAO:
"If Calder’s shipment moved through Harbor last month, Mira is the leak."

OFFICER JAY VELASQUEZ:
"Rafael Soto already flipped. He says Lena was never at Pier 9 — she was at the cold storage on Binder Street."

RAFAEL SOTO:
"I only drove. Calder paid cash. Anika signed the diversion forms. Jay, you were supposed to bury the bracelet report."

MIRA:
"Who are you people? What diversion? Who is Calder?"

DR. ANIKA RAO:
"She’s playing dumb. Jay, get the sister’s file. Rafael — shut up."

[SFX: Chart clipboard slammed on tray]

NARRATOR:
Three new names. One scene. Mira’s head pounds. The bracelet is gone from her pocket.`,
    },
    {
      id: 'hw-ep5',
      episodeNumber: 5,
      title: 'Cold Storage, Same Script',
      scriptText: `[SFX: Freezer fans, metal door clang]

NARRATOR:
Binder Street cold storage. Mira finds Lena’s shoe. Then the van again. Hood. Chase. Somehow — Harbor’s ER doors.

ER NURSE:
"She’s back. Same bruises. Same story."

[SFX: Soft piano from the waiting room TV]

NARRATOR:
In the corridor, Mira stops. The night supervisor offers coffee. They talk about schedules. About overtime. About nothing that matters while Lena is still missing.

MIRA:
"I don’t know if I can keep running this loop."

NIGHT SUPERVISOR:
"Then rest. We’ll file another incident report in the morning."

[SFX: Clock tick, distant code blue]

NARRATOR:
Conflict pauses. No push. No reveal. The episode floats while the kidnap–chase–hospital pattern waits to repeat.

MIRA (to herself):
"If I go back to Binder Street tonight… someone has to break the pattern."`,
    },
  ],
};

/** Catalog shown on Home — demo series first; keep one short alternate for upload contrast. */
export const SAMPLE_SCRIPTS: StoryScript[] = [
  DEMO_SERIES,
  {
    id: 'sample-short-clean',
    title: 'Last Bus to Alwarpet',
    genre: 'Slice-of-life / romance',
    targetAudience: 'Young adult',
    synopsis: 'Two strangers share the last night bus — a clean single-episode sample.',
    episodes: [
      {
        id: 'bus-ep1',
        episodeNumber: 1,
        title: 'Seat 14',
        scriptText: `[SFX: Bus engine idle, rain on windows]

NARRATOR:
The last bus to Alwarpet is half empty. Priya takes seat 14. A man with a guitar case takes 15.

ARJUN:
"Does this one still stop at the flyover?"

PRIYA:
"Only if the driver feels generous."

[SFX: Soft laugh, bus pulls away]

NARRATOR:
They talk until the depot. Nothing stolen. Nothing missing. Just rain, and a number written on a ticket stub.`,
      },
    ],
  },
];
