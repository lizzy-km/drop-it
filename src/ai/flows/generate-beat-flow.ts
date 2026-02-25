'use server';
/**
 * @fileOverview AI Rhythm Architect Flow.
 * Generates a sequencer grid pattern based on available samples and a user prompt.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateBeatInputSchema = z.object({
  prompt: z.string().describe('The vibe or genre of the beat to generate (e.g., "Heavy Phonk", "Lo-fi Chill").'),
  availableClips: z.array(z.object({
    id: z.string(),
    name: z.string(),
  })).describe('List of clips currently in the user library.'),
  numChannels: z.number().describe('Number of tracks to arrange.'),
  numSteps: z.number().describe('Number of sequencer steps (usually 16 or 32).'),
});

export type GenerateBeatInput = z.infer<typeof GenerateBeatInputSchema>;

const GenerateBeatOutputSchema = z.object({
  grid: z.record(z.array(z.string())).describe('The generated sequencer grid mapping "channel-step" to an array of clip IDs.'),
  bpm: z.number().describe('Suggested BPM for this vibe.'),
  title: z.string().describe('A cool, AI-generated name for this project.'),
});

export type GenerateBeatOutput = z.infer<typeof GenerateBeatOutputSchema>;

const beatPrompt = ai.definePrompt({
  name: 'generateBeatPrompt',
  input: { schema: GenerateBeatInputSchema },
  output: { schema: GenerateBeatOutputSchema },
  prompt: `You are a world-class electronic music producer and rhythm theorist. 
Your task is to arrange a drum pattern using ONLY the provided clip IDs.

USER PROMPT: "{{{prompt}}}"
CHANNELS: {{numChannels}}
STEPS: {{numSteps}}

AVAILABLE CLIPS:
{{#each availableClips}}
- ID: {{id}}, NAME: {{name}}
{{/each}}

RULES:
1. Map the clips strategically. Usually, clips named like "KICK" or "BASS" go on Channel 0, "SNARE/CLAP" on Channel 1, "HIHAT" on Channel 2, etc.
2. Create a professional-grade pattern. Use syncopation, ghosts notes, and genre-appropriate spacing.
3. The output "grid" must be a JSON object where keys are "channelIndex-stepIndex" (e.g., "0-0", "0-4") and values are arrays containing one or more Clip IDs from the list provided.
4. If a prompt asks for a specific genre, respect its typical rhythm characteristics.
5. Suggest a BPM between 80 and 160.

Return the grid, bpm, and a stylistic title.`,
});

export async function generateBeat(input: GenerateBeatInput): Promise<GenerateBeatOutput> {
  const { output } = await beatPrompt(input);
  if (!output) throw new Error('AI failed to generate a rhythm pattern.');
  return output;
}
