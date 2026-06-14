
# Odyssey

<img width="1231" height="603" alt="Screenshot 2026-06-13 at 4 52 18 PM" src="https://github.com/user-attachments/assets/acec8a96-b75e-4ddd-a765-e6b9a10c3689" />

### Background

Odyssey is a project at the intersection of AI, VR, virtual worlds, and the human experience. Participants enter a journey guided by Omni, their winged AI companion. Omni navigates them through a set of virtual environments strung together to maximize symbolic significance for the participant's life story. The result ideally leaves them with greater self-understanding and a more grounded optimism about building a meaningful life.

Odyssey was heavily inspired by the work done by [OdysseyWorks](https://www.odysseyworks.org/). They craft large-scale personalized experiences interwoven into real life for their participants. They might be walking down the street and hear a violin playing their favorite song coming through a window. While their Odyssey is occurring, the lines blur between life and art. 

The goal was to create a similar experience digitally. After an extensive intake interview, the worlds are hand-picked for the participant to maximize personal significance. 

### Process

```
Participant
   │
   ▼
Interview / Intake ──────────► informs world selection + Omni's context
   │
   ▼
World Selection ─────────────► per-participant ordering for symbolic significance
   │
   ▼
┌─────────────── Odyssey Runtime ───────────────┐
│                                               │
│  Omni              Environment    Narrative   │
│  (ElevenLabs   ◄──►  System    ◄──►  State    │
│   agent)            (R3F / XR)                │
│                         ▲                     |
│              Gaussian Splat scenes            |
└───────────────────────────────────────────────┘
   │
   ▼
Guided Journey
```

### Technical Details

**Real-time agent grounded in the scene state**: Omni is powered by the Elevenlabs conversational agents API. I designed their system prompt and agent workflow through Elevenlabs's platform to give the agent context on each environment it's in. The emitted audio from the agent is spatial to maximize the immersion. Additionally, I am working on real-time emotional expressions for agent by decoding the emotion tags ElevenLabs provides and piping them into the GLSL shader uniforms of Omni's body. 

**Gaussian splat rendering in VR**: Web-based tooling for Gaussian splat rendering has improved rapidly. I render with Spark, World Labs' open-source THREE.js splat renderer. World Labs builds both sides of this stack: Spark for rendering and Marble for generating the environments themselves. After I storyboard and generate the worlds I put them into an environments.ts file which serves as a template for world-rendering sequence. I take advantage of Spark's Lod system to ensure the splat rendering performance works well in VR. The VR stack itself is powered by React Three Fiber and React Three XR.

Here's an example of a [splat transition](https://youtu.be/PkUmYTC9haQ) and a preview of the [emotion system](https://youtu.be/HI1s7uaGDd0).

### Current Status 

The project is still an active work-in-progress. Some future next steps include:

1. Finalize the real-time emotion system.
2. Design a custom dome mesh for the Odyssey Chamber.
3. Design the ending scene (secret for now).
4. More complex scenes (meshes with physics).





