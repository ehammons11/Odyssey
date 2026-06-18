
# Odyssey

<img width="1231" height="603" alt="Screenshot 2026-06-13 at 4 52 18 PM" src="https://github.com/user-attachments/assets/acec8a96-b75e-4ddd-a765-e6b9a10c3689" />

> A guided journey through AI, VR, and virtual worlds — built to leave participants
> with greater self-understanding and a more grounded optimism about building a
> meaningful life.

Odyssey sits at the intersection of AI, VR, virtual worlds, and the human
experience. A participant enters a personalized journey guided by **Omni**, a winged
AI companion. Omni navigates them through a sequence of virtual environments,
hand-picked and ordered to maximize symbolic significance for that person's own life
story. The result, ideally, is an experience that leaves them more grounded, more
self-aware, and more hopeful about the life they're building.

## Demo

- **[Splat transition →](https://youtu.be/PkUmYTC9haQ)** — moving between Gaussian
  splat environments inside the journey.
- **[Emotion system preview →](https://youtu.be/HI1s7uaGDd0)** — an early look at
  Omni's real-time emotional expression.

## Inspiration

Odyssey is heavily inspired by [OdysseyWorks](https://www.odysseyworks.org/), who
craft large-scale, deeply personalized experiences woven directly into a
participant's life. You might be walking down the street and hear a violin
playing your favorite song coming out of a window. For the duration of your Odyssey,
the line between life and art dissolves.

This project asks: what does that experience look like when you build it digitally?
After an extensive intake interview, the worlds are chosen specifically for the
participant and sequenced to carry them through their own story.

## How It Works

```
Participant
   │
   ▼
Interview / Intake ──────────►  informs world selection + Omni's context
   │
   ▼
World Selection ─────────────►  per-participant ordering for symbolic significance
   │
   ▼
┌──────────────── Odyssey Runtime ────────────────┐
│                                                 │
│   Omni             Environment      Narrative   │
│  (ElevenLabs  ◄──►   System    ◄──►    State    │
│   agent)            (R3F / XR)                  │
│                         ▲                       │
│              Gaussian Splat scenes              │
└─────────────────────────────────────────────────┘
   │
   ▼
Guided Journey
```

The intake interview informs two things: which worlds are selected, and the context
Omni carries into the journey. World selection and ordering are per-participant, so
the same set of environments can tell a very different story depending on who's
walking through them.

## Technical Details

### A real-time agent grounded in the scene

Omni is powered by the **ElevenLabs Conversational Agents API**. I designed the
agent's system prompt and workflow on the ElevenLabs platform so that Omni always
has context on the environment it's currently in. The agent's audio is rendered
**spatially** to deepen immersion.

I'm also building **real-time emotional expression** for Omni: decoding the emotion
tags ElevenLabs emits and piping them straight into the **GLSL shader uniforms** that
drive Omni's body, so the companion's appearance responds to the feeling behind what
it's saying.

### Gaussian splat rendering in VR

Web-based tooling for Gaussian splats has improved fast. I render with
**[Spark](https://github.com/sparkjsdev/spark)**, World Labs' open-source three.js
splat renderer. World Labs builds both halves of this stack: Spark for rendering and
**Marble** for generating the environments themselves.

My workflow: storyboard and generate the worlds, then register them in an
`environments.ts` file that acts as the template for the world-rendering sequence. I
lean on Spark's **LOD system** to keep splat rendering performant in VR. The VR layer
itself runs on **React Three Fiber** and **React Three XR**.

## Tech Stack

- **Splat rendering**: Spark (World Labs' open-source three.js renderer)
- **VR / WebXR**: React Three Fiber, React Three XR
- **World generation**: Marble (World Labs)
- **Conversational AI**: ElevenLabs Conversational Agents API, with spatial audio
- **Shaders**: GLSL (Omni's body + emotion-driven uniforms)
- **Scene config**: `environments.ts` (per-participant world sequence)

## Status & Roadmap

Odyssey is an active work-in-progress. Next up:

1. Finalize the real-time emotion system.
2. Design a custom dome mesh for the Odyssey Chamber.
3. Design the ending scene *(secret for now)*.
4. Build more complex scenes (e.g. meshes with physics).
