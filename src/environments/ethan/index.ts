import type { EnvironmentProps } from "../../components/Environment";

/**
 * Ethan's Odyssey environment set.
 *
 * Each entry represents a distinct environment the agent can transition to.
 */
export const ethanEnvironments: EnvironmentProps[] = [
  {
    name: "Default",
    lights: [
      { type: "ambient", intensity: 1 },
      { type: "directional", intensity: 1, position: [0, 5, 5] },
    ],
    backgroundColor: "#000000",
  },
  {
    name: "Apocalyptic City",
    splatUrl: "/splats/apocalypticCity.spz",
    lights: [
      { type: "ambient", intensity: 0.8 },
      { type: "directional", intensity: 2, position: [5, 6, -20] },
    ],
    backgroundColor: "#000000",
  },
  {
    name: "Peaceful Swamp",
    splatUrl: "/splats/swamp.spz",
    lights: [
      { type: "ambient", intensity: 0.8 },
      { type: "directional", intensity: 2, position: [0, 6, -20] },
    ],
    backgroundColor: "#000000",
  },
  {
    name: "Renaissance Workshop",
    splatUrl: "/splats/renaissanceWorkshop.spz",
    lights: [
      { type: "ambient", intensity: 2.5 },
      { type: "directional", intensity: 1, position: [0, 6, -20] },
    ],
    backgroundColor: "#000000",
  },
  // Add more environments to this set as splats become available:
];
