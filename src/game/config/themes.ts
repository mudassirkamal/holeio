import type { ObjectKindId } from "./objectCatalog";

export type ThemeId = "metro" | "suburbs" | "neon" | "frost" | "beach";

export type ZoneType =
  | "downtown"
  | "commercial"
  | "residential"
  | "park"
  | "parking"
  | "plaza"
  | "beach";

export type Weighted<T> = readonly (readonly [T, number])[];

export interface ThemeLighting {
  sunColor: string;
  sunIntensity: number;
  /** Sun elevation above the horizon, degrees. */
  sunElevation: number;
  /** Sun azimuth, degrees (0 = +Z). */
  sunAzimuth: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  skyTop: string;
  skyHorizon: string;
  skyBottom: string;
  fogColor: string;
  fogDensity: number;
  exposure: number;
  /** 0 = broad daylight, 1 = full night (lit windows, glowing lamps). */
  night: number;
  bloom: number;
  envIntensity: number;
}

export interface ThemePalette {
  grass: string;
  grassAlt: string;
  asphalt: string;
  sidewalk: string;
  curb: string;
  laneLine: string;
  centerLine: string;
  plaza: string;
  dirt: string;
  sand: string;
  outer: string;
  water: string;
  buildingTints: readonly string[];
  roofTints: readonly string[];
  carTints: readonly string[];
  clothTints: readonly string[];
  foliage: readonly string[];
  accent: readonly string[];
}

export interface ThemeDef {
  id: ThemeId;
  name: string;
  tagline: string;
  zones: Weighted<ZoneType>;
  centerZones: Weighted<ZoneType>;
  streetTree: ObjectKindId | null;
  parkTree: ObjectKindId;
  streetProps: Weighted<ObjectKindId>;
  parkProps: Weighted<ObjectKindId>;
  vehicles: Weighted<ObjectKindId>;
  /** Moving cars per road segment. */
  trafficDensity: number;
  /** Walkers per city block. */
  walkerDensity: number;
  outer: "grass" | "water" | "snow";
  weather: "none" | "snow" | "fireflies" | "leaves";
  palette: ThemePalette;
  lighting: ThemeLighting;
}

const CITY_CARS = ["#e63946", "#f1faee", "#457b9d", "#1d3557", "#2a9d8f", "#e9c46a", "#f4a261", "#8d99ae", "#222831", "#6a4c93"];
const CLOTHES = ["#e63946", "#457b9d", "#2a9d8f", "#f4a261", "#6a4c93", "#ffb703", "#219ebc", "#fb8500", "#8338ec", "#3a86ff"];

export const THEMES: Record<ThemeId, ThemeDef> = {
  metro: {
    id: "metro",
    name: "Metro City",
    tagline: "Sunny downtown with towers, taxis and busy plazas",
    zones: [["downtown", 3], ["commercial", 3], ["plaza", 2], ["park", 2], ["parking", 1.5], ["residential", 1.5]],
    centerZones: [["downtown", 6], ["plaza", 2], ["commercial", 1]],
    streetTree: "tree",
    parkTree: "tree",
    streetProps: [["lampPost", 0], ["hydrant", 3], ["trashCan", 3], ["bench", 2], ["mailbox", 1.5], ["parkingMeter", 2], ["bicycle", 1.5], ["newsStand", 1], ["phoneBooth", 0.6], ["flowerPot", 1.5], ["cone", 1.2]],
    parkProps: [["bench", 3], ["bush", 4], ["flowerPot", 2], ["trashCan", 1], ["lampPost", 1], ["rock", 1]],
    vehicles: [["car", 6], ["taxi", 3], ["van", 1.5], ["bus", 0.8], ["truck", 0.8]],
    trafficDensity: 0.9,
    walkerDensity: 7,
    outer: "grass",
    weather: "none",
    palette: {
      grass: "#6fc257",
      grassAlt: "#62b44b",
      asphalt: "#4a4f58",
      sidewalk: "#c9ccd3",
      curb: "#9aa0aa",
      laneLine: "#f5f5f5",
      centerLine: "#ffd23f",
      plaza: "#d8cfc4",
      dirt: "#c9a978",
      sand: "#ecd9a3",
      outer: "#5fae4a",
      water: "#3fa7d6",
      buildingTints: ["#f4f1de", "#e0e7ef", "#cfd8dc", "#f2cc8f", "#e07a5f", "#81b29a", "#a8dadc", "#ffd6a5", "#bdb2ff", "#caffbf"],
      roofTints: ["#5c6b73", "#7d8597", "#3d405b", "#8d6e63"],
      carTints: CITY_CARS,
      clothTints: CLOTHES,
      foliage: ["#4caf50", "#5cb85c", "#3e9e48", "#6cc070"],
      accent: ["#ff595e", "#ffca3a", "#8ac926", "#1982c4", "#6a4c93"],
    },
    lighting: {
      sunColor: "#fff3e0",
      sunIntensity: 3.1,
      sunElevation: 52,
      sunAzimuth: 35,
      hemiSky: "#bfe3ff",
      hemiGround: "#8a9a6b",
      hemiIntensity: 1.25,
      skyTop: "#3b8fe0",
      skyHorizon: "#bfe6ff",
      skyBottom: "#e6f4ff",
      fogColor: "#cfe9ff",
      fogDensity: 0.0024,
      exposure: 1.0,
      night: 0,
      bloom: 0.35,
      envIntensity: 0.9,
    },
  },
  suburbs: {
    id: "suburbs",
    name: "Sunset Suburbs",
    tagline: "Golden hour over houses, lawns and quiet streets",
    zones: [["residential", 6], ["park", 2], ["commercial", 1.5], ["parking", 0.6], ["plaza", 0.6]],
    centerZones: [["commercial", 3], ["plaza", 2], ["park", 2], ["residential", 2]],
    streetTree: "tree",
    parkTree: "tree",
    streetProps: [["hydrant", 3], ["trashCan", 2], ["mailbox", 3], ["bench", 1], ["bicycle", 2], ["flowerPot", 2], ["bush", 2], ["cone", 0.6]],
    parkProps: [["bench", 3], ["bush", 5], ["flowerPot", 2], ["rock", 2], ["trashCan", 1]],
    vehicles: [["car", 7], ["van", 2], ["truck", 0.6], ["bus", 0.4], ["taxi", 0.6]],
    trafficDensity: 0.6,
    walkerDensity: 5,
    outer: "grass",
    weather: "leaves",
    palette: {
      grass: "#9ccc65",
      grassAlt: "#8bc34a",
      asphalt: "#55505a",
      sidewalk: "#d9cdbf",
      curb: "#a89f95",
      laneLine: "#fff8e7",
      centerLine: "#ffc857",
      plaza: "#e3d2bd",
      dirt: "#c49a6c",
      sand: "#f1d9a7",
      outer: "#93c35a",
      water: "#4aa3c7",
      buildingTints: ["#fff1e6", "#fde2e4", "#e2ece9", "#fad2e1", "#bee1e6", "#f0efeb", "#dfe7fd", "#ffe5b4", "#cddafd", "#f8edeb"],
      roofTints: ["#b5523b", "#8c4a3a", "#5d4e6d", "#46637a", "#7a4e2d"],
      carTints: CITY_CARS,
      clothTints: CLOTHES,
      foliage: ["#e9a23b", "#d96c27", "#8fbf3f", "#c2561f", "#6aa84f"],
      accent: ["#ff7b54", "#ffb26b", "#ffd56b", "#939b62", "#e76f51"],
    },
    lighting: {
      sunColor: "#ffb36b",
      sunIntensity: 3.3,
      sunElevation: 20,
      sunAzimuth: -55,
      hemiSky: "#ffd1a1",
      hemiGround: "#6d5a7a",
      hemiIntensity: 1.1,
      skyTop: "#5b4b8a",
      skyHorizon: "#ff9e6d",
      skyBottom: "#ffd6a0",
      fogColor: "#f5b889",
      fogDensity: 0.0028,
      exposure: 1.02,
      night: 0.15,
      bloom: 0.5,
      envIntensity: 0.8,
    },
  },
  neon: {
    id: "neon",
    name: "Neon Nights",
    tagline: "A glowing night metropolis of neon and skyscrapers",
    zones: [["downtown", 5], ["plaza", 2], ["commercial", 2.5], ["parking", 1], ["park", 1]],
    centerZones: [["downtown", 8], ["plaza", 1]],
    streetTree: null,
    parkTree: "tree",
    streetProps: [["hydrant", 2], ["trashCan", 3], ["bench", 1.5], ["newsStand", 2], ["phoneBooth", 1.5], ["parkingMeter", 2], ["bicycle", 1], ["cone", 1.5], ["flowerPot", 0.8]],
    parkProps: [["bench", 3], ["bush", 3], ["lampPost", 2], ["trashCan", 1]],
    vehicles: [["car", 5], ["taxi", 4], ["van", 1], ["bus", 1], ["truck", 0.7]],
    trafficDensity: 1.1,
    walkerDensity: 7,
    outer: "grass",
    weather: "fireflies",
    palette: {
      grass: "#2f5d3a",
      grassAlt: "#2a5234",
      asphalt: "#2b2d38",
      sidewalk: "#6e7385",
      curb: "#4b5063",
      laneLine: "#d7e3ff",
      centerLine: "#ffcf4a",
      plaza: "#5a5870",
      dirt: "#5a4a3b",
      sand: "#7a6d58",
      outer: "#1f3a2a",
      water: "#1c3d6e",
      buildingTints: ["#3a3f58", "#454b6b", "#2f3549", "#51587a", "#39425e", "#5a4e7a", "#34505c", "#48405e"],
      roofTints: ["#22242e", "#2c2f3d", "#1b1d26"],
      carTints: ["#ff2e63", "#08d9d6", "#f9ed69", "#eaeaea", "#252a34", "#9d4edd", "#f15bb5", "#00bbf9"],
      clothTints: ["#ff2e63", "#08d9d6", "#f9ed69", "#9d4edd", "#f15bb5", "#00f5d4", "#fee440"],
      foliage: ["#2e7d4f", "#357a55", "#2a6b47"],
      accent: ["#ff2e63", "#08d9d6", "#f9ed69", "#9d4edd", "#00f5d4", "#f15bb5"],
    },
    lighting: {
      sunColor: "#8aa6ff",
      sunIntensity: 1.25,
      sunElevation: 48,
      sunAzimuth: 120,
      hemiSky: "#5a5ab8",
      hemiGround: "#2a2440",
      hemiIntensity: 1.25,
      skyTop: "#05061a",
      skyHorizon: "#2a1f5c",
      skyBottom: "#3d2466",
      fogColor: "#1a1538",
      fogDensity: 0.003,
      exposure: 1.2,
      night: 1,
      bloom: 1.05,
      envIntensity: 0.55,
    },
  },
  frost: {
    id: "frost",
    name: "Frost Town",
    tagline: "A snowy winter village with pines and snowmen",
    zones: [["residential", 4], ["park", 3], ["commercial", 2], ["plaza", 1.5], ["parking", 0.8]],
    centerZones: [["plaza", 3], ["commercial", 2], ["downtown", 1.5], ["park", 1]],
    streetTree: "pineTree",
    parkTree: "pineTree",
    streetProps: [["hydrant", 2], ["trashCan", 2], ["mailbox", 2], ["bench", 1.5], ["snowman", 2.5], ["cone", 1], ["flowerPot", 0.5], ["bicycle", 0.6]],
    parkProps: [["snowman", 4], ["bench", 2], ["bush", 2], ["rock", 2], ["lampPost", 1]],
    vehicles: [["car", 6], ["van", 2], ["truck", 1], ["bus", 0.6], ["taxi", 0.8]],
    trafficDensity: 0.6,
    walkerDensity: 5,
    outer: "snow",
    weather: "snow",
    palette: {
      grass: "#eef4fb",
      grassAlt: "#e3ecf6",
      asphalt: "#5b6270",
      sidewalk: "#d6dde8",
      curb: "#aab4c3",
      laneLine: "#f7fbff",
      centerLine: "#ffd166",
      plaza: "#dfe6ef",
      dirt: "#c9d3df",
      sand: "#e8eef5",
      outer: "#f1f6fc",
      water: "#7fb3d5",
      buildingTints: ["#b5523b", "#c97b63", "#8e5b4a", "#e9d8a6", "#94a3b8", "#6b8f71", "#a4133c", "#f1faee", "#bc6c25"],
      roofTints: ["#f5f9ff", "#eef3fa", "#e8eef7"],
      carTints: CITY_CARS,
      clothTints: ["#d62828", "#003049", "#f77f00", "#2a9d8f", "#6a4c93", "#e63946"],
      foliage: ["#2f6b4f", "#3a7a5a", "#285e45"],
      accent: ["#e63946", "#f1faee", "#a8dadc", "#457b9d"],
    },
    lighting: {
      sunColor: "#fff6ea",
      sunIntensity: 2.4,
      sunElevation: 30,
      sunAzimuth: 20,
      hemiSky: "#dbeafe",
      hemiGround: "#b8c4d6",
      hemiIntensity: 1.5,
      skyTop: "#8fb3d9",
      skyHorizon: "#e4eef8",
      skyBottom: "#f4f8fc",
      fogColor: "#e4edf7",
      fogDensity: 0.0038,
      exposure: 0.95,
      night: 0.1,
      bloom: 0.3,
      envIntensity: 1.0,
    },
  },
  beach: {
    id: "beach",
    name: "Palm Beach",
    tagline: "A tropical resort town with palms and umbrellas",
    zones: [["beach", 4], ["residential", 2], ["commercial", 2], ["plaza", 1.5], ["park", 1], ["parking", 0.8]],
    centerZones: [["downtown", 3], ["plaza", 2], ["commercial", 2]],
    streetTree: "palmTree",
    parkTree: "palmTree",
    streetProps: [["hydrant", 1.5], ["trashCan", 2], ["bench", 2], ["bicycle", 2], ["flowerPot", 2], ["cactus", 1], ["newsStand", 1], ["cone", 0.6]],
    parkProps: [["bush", 3], ["bench", 2], ["cactus", 2], ["rock", 2], ["flowerPot", 1]],
    vehicles: [["car", 6], ["van", 2], ["taxi", 1.5], ["bus", 0.7], ["truck", 0.5]],
    trafficDensity: 0.7,
    walkerDensity: 8,
    outer: "water",
    weather: "none",
    palette: {
      grass: "#8fd16a",
      grassAlt: "#7cc55a",
      asphalt: "#5a5a62",
      sidewalk: "#efe3c8",
      curb: "#c9b995",
      laneLine: "#ffffff",
      centerLine: "#ffcf40",
      plaza: "#f3e2c0",
      dirt: "#e0c48f",
      sand: "#f6e3b4",
      outer: "#f3dfae",
      water: "#1fb5c9",
      buildingTints: ["#ffffff", "#fef9ef", "#ffd6e0", "#c1f0e8", "#fff3b0", "#a0e7e5", "#ffcfd2", "#f1c0e8", "#b4f8c8", "#fbe7c6"],
      roofTints: ["#e76f51", "#2a9d8f", "#f4a261", "#264653"],
      carTints: ["#ffffff", "#ff6b6b", "#4ecdc4", "#ffe66d", "#1a535c", "#ff9f1c", "#2ec4b6", "#e71d36"],
      clothTints: ["#ff6b6b", "#4ecdc4", "#ffe66d", "#ff9f1c", "#2ec4b6", "#f15bb5", "#00bbf9"],
      foliage: ["#3fa34d", "#5cb85c", "#2b9348", "#55a630"],
      accent: ["#ff6b6b", "#4ecdc4", "#ffe66d", "#ff9f1c", "#f15bb5"],
    },
    lighting: {
      sunColor: "#fff1d6",
      sunIntensity: 3.4,
      sunElevation: 58,
      sunAzimuth: -30,
      hemiSky: "#a8e6ff",
      hemiGround: "#e8d3a0",
      hemiIntensity: 1.3,
      skyTop: "#1e90ff",
      skyHorizon: "#aee9ff",
      skyBottom: "#e9fbff",
      fogColor: "#c6efff",
      fogDensity: 0.0022,
      exposure: 1.0,
      night: 0,
      bloom: 0.35,
      envIntensity: 1.0,
    },
  },
};

export const THEME_ORDER: readonly ThemeId[] = ["metro", "suburbs", "neon", "frost", "beach"];
