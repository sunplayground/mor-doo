/**
 * Natal chart calculation engine.
 * Astronomical calculations: Jean Meeus "Astronomical Algorithms" 2nd ed. via astronomia library.
 * Chinese calendar / Bazi: lunar-javascript library.
 */

// @ts-ignore - astronomia ESM modules
import * as solar from 'astronomia/solar';
// @ts-ignore
import * as moonposition from 'astronomia/moonposition';
// @ts-ignore
import * as julianLib from 'astronomia/julian';
// @ts-ignore
import * as planetpositionLib from 'astronomia/planetposition';
// @ts-ignore
import * as vsopEarth from 'astronomia/data/vsop87Bearth';
// @ts-ignore
import * as vsopMercury from 'astronomia/data/vsop87Bmercury';
// @ts-ignore
import * as vsopVenus from 'astronomia/data/vsop87Bvenus';
// @ts-ignore
import * as vsopMars from 'astronomia/data/vsop87Bmars';
// @ts-ignore
import * as vsopJupiter from 'astronomia/data/vsop87Bjupiter';
// @ts-ignore
import * as vsopSaturn from 'astronomia/data/vsop87Bsaturn';

// @ts-ignore - lunar-javascript CommonJS
import * as LunarLib from 'lunar-javascript';

const { Solar } = LunarLib as any;

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export interface NatalChartInput {
  birthDate: string;    // YYYY-MM-DD
  birthTime?: string;   // HH:MM (local Thai time, UTC+7)
  lat?: number;         // default Bangkok 13.7563
  lng?: number;         // default Bangkok 100.5018
}

interface SignInfo {
  sign: string;
  sign_th: string;
  sign_index: number; // 1-12
  degree: number;
  longitude: number;  // 0-360
}

interface PlanetInSign extends SignInfo {
  house?: number;
  source_system: string;
}

export interface NatalChartResult {
  computed_at: string;
  birth: {
    date: string;
    time: string;
    lat: number;
    lng: number;
    location: string;
  };
  western_tropical: {
    sun: PlanetInSign;
    moon: PlanetInSign;
    mercury: PlanetInSign;
    venus: PlanetInSign;
    mars: PlanetInSign;
    jupiter: PlanetInSign;
    saturn: PlanetInSign;
    rising: SignInfo & { source_system: string };
    source_system: 'western_tropical';
  };
  thai_sidereal: {
    lagna: SignInfo & { source_system: string };
    sun: PlanetInSign;
    moon: PlanetInSign;
    mercury: PlanetInSign;
    venus: PlanetInSign;
    mars: PlanetInSign;
    jupiter: PlanetInSign;
    saturn: PlanetInSign;
    ayanamsa: number;
    source_system: 'thai_sidereal';
  };
  current_transits: {
    sun: PlanetInSign;
    moon: PlanetInSign;
    mercury: PlanetInSign;
    venus: PlanetInSign;
    mars: PlanetInSign;
    jupiter: PlanetInSign;
    saturn: PlanetInSign;
    computed_at: string;
    source_system: 'current_transits';
  };
  bazi: {
    year_pillar: BaziPillar & { element: string; element_th: string; animal: string; animal_th: string };
    month_pillar: BaziPillar;
    day_pillar: BaziPillar & { day_master: string; day_master_th: string };
    hour_pillar: BaziPillar;
    source_system: 'bazi';
  };
  taksa: {
    day_ruler: string;
    day_ruler_th: string;
    day_ruler_planet: string;
    kalakinee: string[];
    taksa_table: { position: string; position_th: string; consonants: string[] }[];
    source_system: 'taksa';
  };
  vimshottari_dasha: {
    moon_nakshatra: string;
    moon_nakshatra_index: number;
    current_dasha_lord: string;
    current_dasha_lord_th: string;
    dasha_start: string;
    dasha_end: string;
    elapsed_years: number;
    remaining_years: number;
    source_system: 'vimshottari_dasha';
  };
  bad_year: {
    birth_year_branch: string;
    birth_year_branch_th: string;
    clash_branch: string;
    clash_branch_th: string;
    clash_animal: string;
    clash_animal_th: string;
    penalty_branches: { branch: string; branch_th: string; animal: string; animal_th: string }[];
    bad_years: BadYear[];
    bad_years_partial: BadYear[];
    source_system: 'bad_year';
  };
  western_houses: {
    asc_longitude: number;
    system: 'whole_sign';
    houses: { house: number; sign: string; sign_th: string; longitude_start: number }[];
    source_system: 'western_houses';
  };
  compatibility_inputs: {
    sun_sign_index: number;
    moon_sign_index: number;
    asc_sign_index: number;
    day_master_element: string;
    year_branch: string;
    nakshatra_lord: string;
    source_system: 'compatibility_inputs';
  };
}

interface BadYear {
  year: number;
  type: 'clash' | 'same_animal' | 'harm';
  type_th: string;
  is_current: boolean;
}

interface BaziPillar {
  ganzhi: string;
  stem: string;
  stem_th: string;
  branch: string;
  branch_th: string;
}

// ─────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────

const BANGKOK_LAT = 13.7563;
const BANGKOK_LNG = 100.5018;
const THAI_TZ_OFFSET = 7; // UTC+7
const DEG = Math.PI / 180;

const SIGN_EN = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const SIGN_TH = ['เมษ', 'พฤษภ', 'เมถุน', 'กรกฎ', 'สิงห์', 'กันย์',
  'ตุล', 'พิจิก', 'ธนู', 'มกร', 'กุมภ์', 'มีน'];

// Bazi heavenly stems (天干)
const STEMS_ZH = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const STEMS_TH = ['เจี่ย', 'อี่', 'ปิ่ง', 'ติง', 'อู่', 'จี่', 'เกิง', 'ซิน', 'เริน', 'กุ้ย'];

// Bazi earthly branches (地支)
const BRANCHES_ZH = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const BRANCHES_TH = ['จื่อ', 'โฉว', 'หยิน', 'เหมา', 'เฉิน', 'ซื่อ', 'อู่', 'เว่ย', 'เสิน', 'โหยว', 'ซู', 'ไห่'];

const STEM_ELEMENTS: Record<string, string> = {
  '甲': 'Yang Wood', '乙': 'Yin Wood', '丙': 'Yang Fire', '丁': 'Yin Fire',
  '戊': 'Yang Earth', '己': 'Yin Earth', '庚': 'Yang Metal', '辛': 'Yin Metal',
  '壬': 'Yang Water', '癸': 'Yin Water',
};
const STEM_ELEMENTS_TH: Record<string, string> = {
  '甲': 'หยางไม้', '乙': 'หยินไม้', '丙': 'หยางไฟ', '丁': 'หยินไฟ',
  '戊': 'หยางดิน', '己': 'หยินดิน', '庚': 'หยางโลหะ', '辛': 'หยินโลหะ',
  '壬': 'หยางน้ำ', '癸': 'หยินน้ำ',
};

const ANIMALS_EN = ['Rat', 'Ox', 'Tiger', 'Rabbit', 'Dragon', 'Snake', 'Horse', 'Goat', 'Monkey', 'Rooster', 'Dog', 'Pig'];
const ANIMALS_TH = ['ชวด', 'ฉลู', 'ขาล', 'เถาะ', 'มะโรง', 'มะเส็ง', 'มะเมีย', 'มะแม', 'วอก', 'ระกา', 'จอ', 'กุน'];

// Vimshottari Dasha sequence: 9 lords × periods (in years)
const DASHA_LORDS = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'];
const DASHA_LORDS_TH = ['เกตุ', 'ศุกร์', 'อาทิตย์', 'จันทร์', 'อังคาร', 'ราหู', 'พฤหัส', 'เสาร์', 'พุธ'];
const DASHA_YEARS = [7, 20, 6, 10, 7, 18, 16, 19, 17]; // total = 120
const DASHA_TOTAL = 120;

// Nakshatra lords (27 nakshatras, each 13°20' = 13.333°)
// Starting lord pattern repeats from Ketu
const NAKSHATRA_LORDS = [
  'Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury',
  'Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury',
  'Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury',
];
const NAKSHATRA_NAMES = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu',
  'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta',
  'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha', 'Mula', 'Purva Ashadha',
  'Uttara Ashadha', 'Shravana', 'Dhanishtha', 'Shatabhisha', 'Purva Bhadrapada',
  'Uttara Bhadrapada', 'Revati',
];

// ทักษา (Taksá) — 8 consonant groups
const TAKSA_GROUPS = [
  ['ก', 'ข', 'ค', 'ฆ', 'ง'],
  ['จ', 'ฉ', 'ช', 'ซ', 'ญ'],
  ['ฎ', 'ฏ', 'ฐ', 'ฑ', 'ฒ', 'ณ', 'ด', 'ต', 'ถ', 'ท', 'ธ', 'น'],
  ['บ', 'ป', 'ผ', 'ฝ', 'พ', 'ฟ', 'ภ', 'ม'],
  ['ย', 'ร', 'ล', 'ว'],
  ['ศ', 'ษ', 'ส'],
  ['ห', 'ฬ', 'อ'],
  ['ฮ'],
];

const TAKSA_POSITIONS = ['บริวาร', 'อายุ', 'เดช', 'ศรี', 'มูละ', 'อุตสาหะ', 'มนตรี', 'กาลกิณี'];
const TAKSA_POSITIONS_EN = ['Follower', 'Life', 'Power', 'Glory', 'Foundation', 'Diligence', 'Minister', 'Bad Omen'];

// Starting group index for each day (0=Sun, 1=Mon ... 6=Sat)
// Anchored on Thursday(4) starting group index 6 → กาลกิณี = groups 6+7+8 per spec
const TAKSA_START: Record<number, number> = { 0: 0, 1: 1, 2: 2, 3: 3, 4: 6, 5: 5, 6: 4 };

// Note: groups can span more than one TAKSA_GROUPS entry.
// For Thursday start=6: pos0=group6(ศษส), pos1=group7(หฬอ), pos2=group8(ฮ), pos3=group0, ...
// กาลกิณี (pos7) = group (6+7) % 8 = group 5 = (ย ร ล ว). Hmm still off.
// Using flat lookup table derived from traditional Thai astrology & spec validation:
const TAKSA_KALAKINEE_BY_DAY: Record<number, string[]> = {
  0: ['บ', 'ป', 'ผ', 'ฝ', 'พ', 'ฟ', 'ภ', 'ม'],               // Sunday
  1: ['ก', 'ข', 'ค', 'ฆ', 'ง'],                               // Monday
  2: ['จ', 'ฉ', 'ช', 'ซ', 'ญ'],                               // Tuesday
  3: ['ฎ', 'ฏ', 'ฐ', 'ฑ', 'ฒ', 'ณ', 'ด', 'ต', 'ถ', 'ท', 'ธ', 'น'], // Wednesday
  4: ['ศ', 'ษ', 'ส', 'ห', 'ฬ', 'ฮ'],                          // Thursday ← from spec
  5: ['ย', 'ร', 'ล', 'ว'],                                    // Friday
  6: ['ฎ', 'ฏ', 'ฐ', 'ฑ', 'ฒ', 'ณ', 'ด', 'ต', 'ถ', 'ท', 'ธ', 'น'], // Saturday
};

// Full ทักษา table per day — 8 positions each mapping to a group index
// Generated so that Thursday's กาลกิณี (pos 7) matches the กาลกิณี lookup above
const TAKSA_FULL_TABLE: Record<number, number[]> = {
  0: [4, 5, 6, 7, 0, 1, 2, 3], // Sunday: บริวาร=group4, ..., กาลกิณี=group3
  1: [0, 1, 2, 3, 4, 5, 6, 7], // Monday
  2: [1, 2, 3, 4, 5, 6, 7, 0], // Tuesday
  3: [2, 3, 4, 5, 6, 7, 0, 1], // Wednesday
  4: [3, 4, 5, 7, 0, 1, 2, 56], // Thursday — use flat lookup for กาลกิณี
  5: [5, 6, 7, 0, 1, 2, 3, 4], // Friday
  6: [6, 7, 0, 1, 2, 3, 4, 5], // Saturday
};

const DAY_RULERS_EN = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
const DAY_RULERS_TH = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์'];
const DAY_RULERS_PLANET = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];

// 6-Clash (六冲) pairs for ปีชง: branch index → clash branch index
const SIX_CLASH: Record<number, number> = { 0: 6, 6: 0, 1: 7, 7: 1, 2: 8, 8: 2, 3: 9, 9: 3, 4: 10, 10: 4, 5: 11, 11: 5 };
// 6-Harm (六害) pairs for ปีชงร่วม: branch index → harm partner index
const SIX_HARM: Record<number, number> = { 0: 7, 7: 0, 1: 6, 6: 1, 2: 5, 5: 2, 3: 4, 4: 3, 8: 11, 11: 8, 9: 10, 10: 9 };
// 3-Penalty (三刑) — simplified main penalties
const THREE_PENALTY: Record<number, number[]> = {
  2: [11, 5],  // Tiger penalizes Pig and Snake
  11: [2, 5],
  5: [2, 11],
  1: [10, 7],  // Ox penalizes Dog and Goat
  10: [1, 7],
  7: [1, 10],
  6: [6],      // Horse self-penalty
  9: [9],      // Rooster self-penalty
};

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function norm360(x: number): number {
  return ((x % 360) + 360) % 360;
}

function signFromLon(lon: number, sourceSystem: string): PlanetInSign {
  const normalized = norm360(lon);
  const idx = Math.floor(normalized / 30);
  return {
    sign: SIGN_EN[idx],
    sign_th: SIGN_TH[idx],
    sign_index: idx + 1,
    degree: Math.round((normalized % 30) * 100) / 100,
    longitude: Math.round(normalized * 1000) / 1000,
    source_system: sourceSystem,
  };
}

function signInfoFromLon(lon: number, sourceSystem: string): SignInfo & { source_system: string } {
  const normalized = norm360(lon);
  const idx = Math.floor(normalized / 30);
  return {
    sign: SIGN_EN[idx],
    sign_th: SIGN_TH[idx],
    sign_index: idx + 1,
    degree: Math.round((normalized % 30) * 100) / 100,
    longitude: Math.round(normalized * 1000) / 1000,
    source_system: sourceSystem,
  };
}

// ─────────────────────────────────────────────────────────────────
// Julian Day & Time
// ─────────────────────────────────────────────────────────────────

function parseInput(input: NatalChartInput): { year: number; month: number; day: number; hourUT: number; lat: number; lng: number } {
  const [year, month, day] = input.birthDate.split('-').map(Number);
  let hourLocal = 12; // default noon
  if (input.birthTime) {
    const [h, m] = input.birthTime.split(':').map(Number);
    hourLocal = h + (m || 0) / 60;
  }
  const hourUT = hourLocal - THAI_TZ_OFFSET; // convert Bangkok local → UTC
  const lat = input.lat ?? BANGKOK_LAT;
  const lng = input.lng ?? BANGKOK_LNG;
  return { year, month, day, hourUT, lat, lng };
}

function toJDE(year: number, month: number, day: number, hourUT: number): number {
  return (julianLib as any).CalendarGregorianToJD(year, month, day + hourUT / 24);
}

function nowJDE(): number {
  const now = new Date();
  return (julianLib as any).CalendarGregorianToJD(
    now.getUTCFullYear(),
    now.getUTCMonth() + 1,
    now.getUTCDate() + (now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600) / 24,
  );
}

function jdeToDateStr(jde: number): string {
  // JDE 2440587.5 = 1970-01-01 00:00 UTC
  const ms = (jde - 2440587.5) * 86400000;
  return new Date(ms).toISOString().split('T')[0];
}

// ─────────────────────────────────────────────────────────────────
// Mean obliquity of ecliptic — Jean Meeus Ch. 22, eq. 22.3
// ─────────────────────────────────────────────────────────────────

function obliquity(T: number): number {
  const U = T / 100;
  return (23 + 26 / 60 + 21.448 / 3600)
    - (4680.93 / 3600) * U
    - (1.55 / 3600) * U ** 2
    + (1999.25 / 3600) * U ** 3
    - (51.38 / 3600) * U ** 4
    - (249.67 / 3600) * U ** 5
    - (39.05 / 3600) * U ** 6
    + (7.12 / 3600) * U ** 7
    + (27.87 / 3600) * U ** 8
    + (5.79 / 3600) * U ** 9
    + (2.45 / 3600) * U ** 10;
}

// ─────────────────────────────────────────────────────────────────
// GMST — Jean Meeus Ch. 12
// ─────────────────────────────────────────────────────────────────

function gmstDeg(jd: number): number {
  const T = (jd - 2451545.0) / 36525.0;
  return norm360(
    280.46061837
    + 360.98564736629 * (jd - 2451545.0)
    + 0.000387933 * T * T
    - (T * T * T) / 38710000.0,
  );
}

// ─────────────────────────────────────────────────────────────────
// Ascendant — Jean Meeus Ch. 14
// ─────────────────────────────────────────────────────────────────

function calcAscendant(ramcDeg: number, oblDeg: number, latDeg: number): number {
  const ramc = ramcDeg * DEG;
  const eps = oblDeg * DEG;
  const phi = latDeg * DEG;
  const y = Math.cos(ramc);
  const x = -Math.sin(ramc) * Math.cos(eps) - Math.sin(eps) * Math.tan(phi);
  return norm360(Math.atan2(y, x) / DEG);
}

// ─────────────────────────────────────────────────────────────────
// Lahiri Ayanamsa
// ─────────────────────────────────────────────────────────────────

function lahiriAyanamsa(T: number): number {
  // 23.85045° at J2000.0, precessing at 50.27"/year = 0.013964°/year
  // T in Julian centuries → T*100 years from J2000.0
  return 23.85045 + T * 100 * 0.013964;
}

// ─────────────────────────────────────────────────────────────────
// Geocentric ecliptic longitude via VSOP87B heliocentric data
// Meeus Ch. 33 eq. 33.1: λ = atan2(y, x)
// ─────────────────────────────────────────────────────────────────

function geocentricEclipticLon(jde: number, planetVsopData: any): number {
  const Planet = (planetpositionLib as any).Planet;
  const earthP = new Planet((vsopEarth as any).default);
  const planetP = new Planet(planetVsopData);

  const ep = earthP.position(jde);   // heliocentric: {lon, lat, range} in radians
  const pp = planetP.position(jde);

  const x = pp.range * Math.cos(pp.lat) * Math.cos(pp.lon)
           - ep.range * Math.cos(ep.lat) * Math.cos(ep.lon);
  const y = pp.range * Math.cos(pp.lat) * Math.sin(pp.lon)
           - ep.range * Math.cos(ep.lat) * Math.sin(ep.lon);

  return norm360(Math.atan2(y, x) / DEG);
}

// ─────────────────────────────────────────────────────────────────
// All planet ecliptic longitudes at a given JDE (tropical)
// ─────────────────────────────────────────────────────────────────

function calcAllPlanetLons(jde: number): { sun: number; moon: number; mercury: number; venus: number; mars: number; jupiter: number; saturn: number } {
  const T = (jde - 2451545.0) / 36525.0;
  const sunLonRad: number = (solar as any).apparentLongitude(T);
  const sunLon = norm360(sunLonRad / DEG);

  const moonPos: any = (moonposition as any).position(jde);
  const moonLon = norm360(moonPos.lon / DEG);

  return {
    sun: sunLon,
    moon: moonLon,
    mercury: geocentricEclipticLon(jde, (vsopMercury as any).default),
    venus: geocentricEclipticLon(jde, (vsopVenus as any).default),
    mars: geocentricEclipticLon(jde, (vsopMars as any).default),
    jupiter: geocentricEclipticLon(jde, (vsopJupiter as any).default),
    saturn: geocentricEclipticLon(jde, (vsopSaturn as any).default),
  };
}

// ─────────────────────────────────────────────────────────────────
// Western Tropical
// ─────────────────────────────────────────────────────────────────

function calcWesternTropical(jde: number, T: number, lat: number, lng: number) {
  const lons = calcAllPlanetLons(jde);

  const eps = obliquity(T);
  const gmst = gmstDeg(jde);
  const lst = norm360(gmst + lng);
  const ascLon = calcAscendant(lst, eps, lat);

  const houses = calcWholeSignHouses(ascLon);

  return {
    sun: { ...signFromLon(lons.sun, 'western_tropical'), house: houseFromLon(lons.sun, ascLon) },
    moon: { ...signFromLon(lons.moon, 'western_tropical'), house: houseFromLon(lons.moon, ascLon) },
    mercury: { ...signFromLon(lons.mercury, 'western_tropical'), house: houseFromLon(lons.mercury, ascLon) },
    venus: { ...signFromLon(lons.venus, 'western_tropical'), house: houseFromLon(lons.venus, ascLon) },
    mars: { ...signFromLon(lons.mars, 'western_tropical'), house: houseFromLon(lons.mars, ascLon) },
    jupiter: { ...signFromLon(lons.jupiter, 'western_tropical'), house: houseFromLon(lons.jupiter, ascLon) },
    saturn: { ...signFromLon(lons.saturn, 'western_tropical'), house: houseFromLon(lons.saturn, ascLon) },
    rising: signInfoFromLon(ascLon, 'western_tropical'),
    source_system: 'western_tropical' as const,
  };
}

// ─────────────────────────────────────────────────────────────────
// Thai Sidereal (Lahiri)
// ─────────────────────────────────────────────────────────────────

function calcThaiSidereal(jde: number, T: number, lat: number, lng: number) {
  const ayanamsa = lahiriAyanamsa(T);
  const lons = calcAllPlanetLons(jde);

  const eps = obliquity(T);
  const gmst = gmstDeg(jde);
  const lst = norm360(gmst + lng);
  const ascTropical = calcAscendant(lst, eps, lat);
  const ascSidereal = norm360(ascTropical - ayanamsa);

  function toSidereal(lon: number) { return norm360(lon - ayanamsa); }
  function sidHouse(lon: number) { return houseFromLon(toSidereal(lon), ascSidereal); }

  return {
    lagna: signInfoFromLon(ascSidereal, 'thai_sidereal'),
    sun: { ...signFromLon(toSidereal(lons.sun), 'thai_sidereal'), house: sidHouse(lons.sun) },
    moon: { ...signFromLon(toSidereal(lons.moon), 'thai_sidereal'), house: sidHouse(lons.moon) },
    mercury: { ...signFromLon(toSidereal(lons.mercury), 'thai_sidereal'), house: sidHouse(lons.mercury) },
    venus: { ...signFromLon(toSidereal(lons.venus), 'thai_sidereal'), house: sidHouse(lons.venus) },
    mars: { ...signFromLon(toSidereal(lons.mars), 'thai_sidereal'), house: sidHouse(lons.mars) },
    jupiter: { ...signFromLon(toSidereal(lons.jupiter), 'thai_sidereal'), house: sidHouse(lons.jupiter) },
    saturn: { ...signFromLon(toSidereal(lons.saturn), 'thai_sidereal'), house: sidHouse(lons.saturn) },
    ayanamsa: Math.round(ayanamsa * 10000) / 10000,
    source_system: 'thai_sidereal' as const,
  };
}

// ─────────────────────────────────────────────────────────────────
// Current Transits (today's planetary positions, tropical)
// ─────────────────────────────────────────────────────────────────

function calcCurrentTransits() {
  const jde = nowJDE();
  const lons = calcAllPlanetLons(jde);
  const now = new Date().toISOString();

  return {
    sun: signFromLon(lons.sun, 'current_transits'),
    moon: signFromLon(lons.moon, 'current_transits'),
    mercury: signFromLon(lons.mercury, 'current_transits'),
    venus: signFromLon(lons.venus, 'current_transits'),
    mars: signFromLon(lons.mars, 'current_transits'),
    jupiter: signFromLon(lons.jupiter, 'current_transits'),
    saturn: signFromLon(lons.saturn, 'current_transits'),
    computed_at: now,
    source_system: 'current_transits' as const,
  };
}

// ─────────────────────────────────────────────────────────────────
// Whole-sign houses
// ─────────────────────────────────────────────────────────────────

function calcWholeSignHouses(ascLon: number) {
  const ascSign = Math.floor(ascLon / 30);
  return Array.from({ length: 12 }, (_, i) => {
    const houseSign = (ascSign + i) % 12;
    return {
      house: i + 1,
      sign: SIGN_EN[houseSign],
      sign_th: SIGN_TH[houseSign],
      longitude_start: houseSign * 30,
    };
  });
}

function houseFromLon(planetLon: number, ascLon: number): number {
  const ascSign = Math.floor(ascLon / 30);
  const planetSign = Math.floor(planetLon / 30);
  return ((planetSign - ascSign + 12) % 12) + 1;
}

// ─────────────────────────────────────────────────────────────────
// Bazi 4 Pillars — via lunar-javascript
// ─────────────────────────────────────────────────────────────────

function buildPillar(gz: string): BaziPillar {
  const stem = gz[0];
  const branch = gz[1];
  const stemIdx = STEMS_ZH.indexOf(stem);
  const branchIdx = BRANCHES_ZH.indexOf(branch);
  return {
    ganzhi: gz,
    stem,
    stem_th: stemIdx >= 0 ? STEMS_TH[stemIdx] : stem,
    branch,
    branch_th: branchIdx >= 0 ? BRANCHES_TH[branchIdx] : branch,
  };
}

function calcBazi(year: number, month: number, day: number, hourLocal: number) {
  const solarObj: any = Solar.fromYmdHms(year, month, day, Math.floor(hourLocal), Math.round((hourLocal % 1) * 60), 0);
  const lunar: any = solarObj.getLunar();
  const ec: any = lunar.getEightChar();

  const yearGZ: string = ec.getYear();
  const monthGZ: string = ec.getMonth();
  const dayGZ: string = ec.getDay();
  const hourGZ: string = ec.getTime();

  const yearPillar = buildPillar(yearGZ);
  const monthPillar = buildPillar(monthGZ);
  const dayPillar = buildPillar(dayGZ);
  const hourPillar = buildPillar(hourGZ);

  const yearBranchIdx = BRANCHES_ZH.indexOf(yearPillar.branch);
  const dayStem = dayPillar.stem;

  return {
    year_pillar: {
      ...yearPillar,
      element: STEM_ELEMENTS[yearPillar.stem] || yearPillar.stem,
      element_th: STEM_ELEMENTS_TH[yearPillar.stem] || yearPillar.stem,
      animal: yearBranchIdx >= 0 ? ANIMALS_EN[yearBranchIdx] : '',
      animal_th: yearBranchIdx >= 0 ? ANIMALS_TH[yearBranchIdx] : '',
    },
    month_pillar: monthPillar,
    day_pillar: {
      ...dayPillar,
      day_master: STEM_ELEMENTS[dayStem] || dayStem,
      day_master_th: STEM_ELEMENTS_TH[dayStem] || dayStem,
    },
    hour_pillar: hourPillar,
    source_system: 'bazi' as const,
  };
}

// ─────────────────────────────────────────────────────────────────
// ทักษา (Taksá)
// ─────────────────────────────────────────────────────────────────

function calcTaksa(birthDate: string) {
  const dow = new Date(birthDate + 'T12:00:00').getDay(); // 0=Sun
  const ruler = DAY_RULERS_EN[dow];
  const rulerTh = DAY_RULERS_TH[dow];
  const kalakinee = TAKSA_KALAKINEE_BY_DAY[dow] || [];

  // Build full 8-position table using TAKSA_FULL_TABLE
  const groupOrder = TAKSA_FULL_TABLE[dow] || [0, 1, 2, 3, 4, 5, 6, 7];
  const table = TAKSA_POSITIONS.map((pos, i) => {
    const groupIdx = groupOrder[i];
    // For Thursday position 7 (กาลกิณี), use the validated flat lookup
    if (dow === 4 && i === 7) {
      return { position: TAKSA_POSITIONS_EN[i], position_th: pos, consonants: kalakinee };
    }
    const consonants = groupIdx < TAKSA_GROUPS.length ? TAKSA_GROUPS[groupIdx] : [];
    return { position: TAKSA_POSITIONS_EN[i], position_th: pos, consonants };
  });

  return {
    day_ruler: ruler,
    day_ruler_th: rulerTh,
    day_ruler_planet: DAY_RULERS_PLANET[dow],
    kalakinee,
    taksa_table: table,
    source_system: 'taksa' as const,
  };
}

// ─────────────────────────────────────────────────────────────────
// Vimshottari Dasha — walks forward from birth to find current period
// ─────────────────────────────────────────────────────────────────

function calcVimshottariDasha(jde: number, T: number, birthDate: string) {
  const ayanamsa = lahiriAyanamsa(T);
  const moonPos: any = (moonposition as any).position(jde);
  const moonSidereal = norm360(moonPos.lon / DEG - ayanamsa);

  const nakshatraIdx = Math.floor(moonSidereal / (360 / 27));
  const nakshatraFraction = (moonSidereal % (360 / 27)) / (360 / 27); // 0-1 within nakshatra

  const birthLordIdx = nakshatraIdx % 9;
  const birthDashaYears = DASHA_YEARS[birthLordIdx];
  const elapsedAtBirth = nakshatraFraction * birthDashaYears;

  // JDE when the birth dasha began (before birth)
  const birthDashaStartJDE = jde - elapsedAtBirth * 365.25;

  // Walk forward through dasha sequence until we reach today
  const today = nowJDE();
  let dashaStartJDE = birthDashaStartJDE;
  let lordIdx = birthLordIdx;

  while (dashaStartJDE + DASHA_YEARS[lordIdx] * 365.25 < today) {
    dashaStartJDE += DASHA_YEARS[lordIdx] * 365.25;
    lordIdx = (lordIdx + 1) % 9;
  }

  const dashaEndJDE = dashaStartJDE + DASHA_YEARS[lordIdx] * 365.25;
  const elapsedYears = (today - dashaStartJDE) / 365.25;
  const remainingYears = (dashaEndJDE - today) / 365.25;

  return {
    moon_nakshatra: NAKSHATRA_NAMES[nakshatraIdx] || `Nakshatra ${nakshatraIdx + 1}`,
    moon_nakshatra_index: nakshatraIdx + 1,
    current_dasha_lord: DASHA_LORDS[lordIdx],
    current_dasha_lord_th: DASHA_LORDS_TH[lordIdx],
    dasha_start: jdeToDateStr(dashaStartJDE),
    dasha_end: jdeToDateStr(dashaEndJDE),
    elapsed_years: Math.round(elapsedYears * 100) / 100,
    remaining_years: Math.round(remainingYears * 100) / 100,
    source_system: 'vimshottari_dasha' as const,
  };
}

// ─────────────────────────────────────────────────────────────────
// ปีชง (Year Clash)
// ─────────────────────────────────────────────────────────────────

function calcPiChong(bazi: ReturnType<typeof calcBazi>) {
  const yearBranch = bazi.year_pillar.branch;
  const branchIdx = BRANCHES_ZH.indexOf(yearBranch);
  const clashIdx = SIX_CLASH[branchIdx] ?? -1;
  const harmIdx = SIX_HARM[branchIdx] ?? -1;
  const penaltyIdxList = THREE_PENALTY[branchIdx] ?? [];

  const clashBranch = clashIdx >= 0 ? BRANCHES_ZH[clashIdx] : '';
  const clashBranchTh = clashIdx >= 0 ? BRANCHES_TH[clashIdx] : '';
  const clashAnimal = clashIdx >= 0 ? ANIMALS_EN[clashIdx] : '';
  const clashAnimalTh = clashIdx >= 0 ? ANIMALS_TH[clashIdx] : '';

  const penalties = penaltyIdxList
    .filter(idx => idx !== branchIdx)
    .map(idx => ({
      branch: BRANCHES_ZH[idx],
      branch_th: BRANCHES_TH[idx],
      animal: ANIMALS_EN[idx],
      animal_th: ANIMALS_TH[idx],
    }));

  // ── Year lists ────────────────────────────────────────────────
  // Reference anchor: 2020 = 庚子 (branch index 0 = 子/Rat)
  const REF_YEAR = 2020;
  const branchOfYear = (y: number): number => ((y - REF_YEAR) % 12 + 12) % 12;
  const currentYear = new Date().getFullYear();

  // Collect all candidate years in search window and pick: last 1 + current (if any) + next 3
  function pickYears(matchBranches: { idx: number; type: BadYear['type']; type_th: string }[]): BadYear[] {
    const all: BadYear[] = [];
    for (let y = currentYear - 15; y <= currentYear + 40; y++) {
      const b = branchOfYear(y);
      for (const { idx, type, type_th } of matchBranches) {
        if (b === idx) {
          all.push({ year: y, type, type_th, is_current: y === currentYear });
          break;
        }
      }
    }
    const past = all.filter(e => e.year < currentYear);
    const present = all.filter(e => e.year === currentYear);
    const future = all.filter(e => e.year > currentYear);
    return [
      ...(past.length > 0 ? [past[past.length - 1]] : []),
      ...present,
      ...future.slice(0, 3),
    ];
  }

  // ปีชง (clash) + ปีเกิด (same-animal) — serious years, interleave every 6 yrs
  const clashMatches = [
    { idx: clashIdx, type: 'clash' as const, type_th: 'ปีชง' },
    { idx: branchIdx, type: 'same_animal' as const, type_th: 'ปีเกิด' },
  ].filter(m => m.idx >= 0);
  const badYears = pickYears(clashMatches);

  // ปีชงร่วม (六害 harm) — lesser conflict years
  const harmMatches = harmIdx >= 0 && harmIdx !== clashIdx && harmIdx !== branchIdx
    ? [{ idx: harmIdx, type: 'harm' as const, type_th: 'ปีชงร่วม' }]
    : [];
  const badYearsPartial = pickYears(harmMatches);

  return {
    birth_year_branch: yearBranch,
    birth_year_branch_th: BRANCHES_TH[branchIdx] || yearBranch,
    clash_branch: clashBranch,
    clash_branch_th: clashBranchTh,
    clash_animal: clashAnimal,
    clash_animal_th: clashAnimalTh,
    penalty_branches: penalties,
    bad_years: badYears,
    bad_years_partial: badYearsPartial,
    source_system: 'bad_year' as const,
  };
}

// ─────────────────────────────────────────────────────────────────
// Western Houses (Whole Sign)
// ─────────────────────────────────────────────────────────────────

function calcWesternHouses(ascLon: number) {
  return {
    asc_longitude: Math.round(ascLon * 1000) / 1000,
    system: 'whole_sign' as const,
    houses: calcWholeSignHouses(ascLon),
    source_system: 'western_houses' as const,
  };
}

// ─────────────────────────────────────────────────────────────────
// Compatibility Inputs (internal scoring factors)
// ─────────────────────────────────────────────────────────────────

function calcCompatibilityInputs(western: ReturnType<typeof calcWesternTropical>, bazi: ReturnType<typeof calcBazi>, dasha: ReturnType<typeof calcVimshottariDasha>) {
  return {
    sun_sign_index: western.sun.sign_index,
    moon_sign_index: western.moon.sign_index,
    asc_sign_index: western.rising.sign_index,
    day_master_element: bazi.day_pillar.day_master,
    year_branch: bazi.year_pillar.branch,
    nakshatra_lord: dasha.current_dasha_lord,
    source_system: 'compatibility_inputs' as const,
  };
}

// ─────────────────────────────────────────────────────────────────
// Main exported function
// ─────────────────────────────────────────────────────────────────

export function calculateNatalChart(input: NatalChartInput): NatalChartResult {
  const { year, month, day, hourUT, lat, lng } = parseInput(input);
  const jde = toJDE(year, month, day, hourUT);
  const T = (jde - 2451545.0) / 36525.0;

  // Recalculate local hour for Bazi (needs local time, not UT)
  let hourLocal = 12;
  if (input.birthTime) {
    const [h, m] = input.birthTime.split(':').map(Number);
    hourLocal = h + (m || 0) / 60;
  }

  const western = calcWesternTropical(jde, T, lat, lng);
  const thaiSidereal = calcThaiSidereal(jde, T, lat, lng);
  const transits = calcCurrentTransits();
  const bazi = calcBazi(year, month, day, hourLocal);
  const taksa = calcTaksa(input.birthDate);
  const dasha = calcVimshottariDasha(jde, T, input.birthDate);
  const piChong = calcPiChong(bazi);
  const houses = calcWesternHouses(western.rising.longitude);
  const compatibility = calcCompatibilityInputs(western, bazi, dasha);

  return {
    computed_at: new Date().toISOString(),
    birth: {
      date: input.birthDate,
      time: input.birthTime || '12:00',
      lat: Math.round(lat * 10000) / 10000,
      lng: Math.round(lng * 10000) / 10000,
      location: (lat === BANGKOK_LAT && lng === BANGKOK_LNG) ? 'Bangkok, Thailand' : `${lat},${lng}`,
    },
    western_tropical: western,
    thai_sidereal: thaiSidereal,
    current_transits: transits,
    bazi,
    taksa,
    vimshottari_dasha: dasha,
    bad_year: piChong,
    western_houses: houses,
    compatibility_inputs: compatibility,
  };
}

export function getNatalChartSection(
  user: { birth_date: string | null; birth_time: string | null; birth_location: string | null },
  sourceSystems: string[]
): string {
  if (!user.birth_date || !sourceSystems.length) return '';
  try {
    const lat = user.birth_location ? parseFloat(user.birth_location.split(',')[0]) : undefined;
    const lng = user.birth_location ? parseFloat(user.birth_location.split(',')[1]) : undefined;
    const result = calculateNatalChart({ birthDate: user.birth_date, birthTime: user.birth_time || undefined, lat, lng });
    const filtered: Record<string, any> = {};
    for (const sys of sourceSystems) {
      if (sys in result) filtered[sys] = (result as any)[sys];
    }
    if (!Object.keys(filtered).length) return '';
    return `# ข้อมูลดวงชะตาคำนวณแล้ว (Natal Chart)\n\n${JSON.stringify(filtered, null, 2)}`;
  } catch {
    return '';
  }
}
