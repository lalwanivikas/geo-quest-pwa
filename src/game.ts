import {
  COUNTRIES,
  COUNTRIES_BY_ISO3,
  COUNTRIES_WITH_BORDERS,
  MAPPED_COUNTRIES,
  REGIONS,
  type Country,
} from './data/countries'
import { PHYSICAL_FEATURES, type PhysicalFeature } from './data/physical'

export type GameMode =
  | 'mixed'
  | 'flags'
  | 'capitals'
  | 'map'
  | 'neighbors'
  | 'physical'

export type QuestionKind =
  | 'flag'
  | 'capital'
  | 'capitalReverse'
  | 'mapTap'
  | 'outline'
  | 'neighbor'
  | 'region'
  | 'physicalCategory'
  | 'physicalRegion'

export type ChoiceQuestion = {
  id: string
  kind: Exclude<QuestionKind, 'mapTap'>
  mode: GameMode
  prompt: string
  eyebrow: string
  answer: string
  options: string[]
  country?: Country
  feature?: PhysicalFeature
}

export type MapQuestion = {
  id: string
  kind: 'mapTap'
  mode: GameMode
  prompt: string
  eyebrow: string
  answer: string
  country: Country
  feature?: undefined
}

export type Question = ChoiceQuestion | MapQuestion

type QuestionFactory = (rng: RandomSource, mode: GameMode) => Question

export type RandomSource = () => number

const CATEGORY_LABELS: Record<PhysicalFeature['category'], string> = {
  desert: 'Desert',
  lake: 'Lake',
  mountain: 'Mountain range',
  ocean: 'Ocean',
  river: 'River',
  sea: 'Sea',
}

export const MODE_LABELS: Record<GameMode, string> = {
  capitals: 'Capitals',
  flags: 'Flags',
  map: 'Map Tap',
  mixed: 'Daily Sprint',
  neighbors: 'Neighbors',
  physical: 'Earth',
}

export const MODE_DESCRIPTIONS: Record<GameMode, string> = {
  capitals: 'Capital recall in both directions.',
  flags: 'Flag recognition and country recall.',
  map: 'Tap countries and read outlines.',
  mixed: 'A fast mix of everything that matters.',
  neighbors: 'Build a mental sense of what touches what.',
  physical: 'Oceans, rivers, mountains, deserts, and seas.',
}

const questionFactories: Record<GameMode, QuestionFactory[]> = {
  capitals: [makeCapitalQuestion, makeCapitalReverseQuestion],
  flags: [makeFlagQuestion],
  map: [makeMapTapQuestion, makeOutlineQuestion],
  mixed: [
    makeFlagQuestion,
    makeCapitalQuestion,
    makeCapitalReverseQuestion,
    makeMapTapQuestion,
    makeOutlineQuestion,
    makeNeighborQuestion,
    makeRegionQuestion,
    makePhysicalCategoryQuestion,
    makePhysicalRegionQuestion,
  ],
  neighbors: [makeNeighborQuestion, makeRegionQuestion],
  physical: [makePhysicalCategoryQuestion, makePhysicalRegionQuestion],
}

export const DAILY_GOAL = 12

export function createQuestion(mode: GameMode, rng: RandomSource): Question {
  const factories = questionFactories[mode]
  const factory = sample(factories, rng)

  return factory(rng, mode)
}

export function mulberry32(seed: number): RandomSource {
  let value = seed

  return () => {
    value += 0x6d2b79f5
    let next = value
    next = Math.imul(next ^ (next >>> 15), next | 1)
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61)
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296
  }
}

export function seedFromText(text: string): number {
  let hash = 2166136261

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

export function shuffle<T>(items: T[], rng: RandomSource): T[] {
  const copy = [...items]

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1))
    ;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
  }

  return copy
}

export function topicLabel(question: Question): string {
  if (question.country) {
    return `${question.country.flag} ${question.country.name}`
  }

  if (question.feature) {
    return question.feature.name
  }

  return question.eyebrow
}

export function explainQuestion(question: Question): string {
  if (question.kind === 'physicalCategory' && question.feature) {
    return `${question.feature.name} is a ${CATEGORY_LABELS[question.feature.category].toLowerCase()} in ${question.feature.region}.`
  }

  if (question.kind === 'physicalRegion' && question.feature) {
    return `${question.feature.name}: ${question.feature.clue}`
  }

  if (question.kind === 'neighbor' && question.country) {
    const borderNames = question.country.borders
      .map((border) => COUNTRIES_BY_ISO3.get(border)?.name)
      .filter((name): name is string => Boolean(name))
      .slice(0, 5)
      .join(', ')

    return `${question.country.name} borders ${borderNames}.`
  }

  if (question.kind === 'region' && question.country) {
    return `${question.country.name} is in ${question.country.subregion}, ${question.country.region}.`
  }

  if (question.country) {
    return `${question.country.name}: capital ${question.country.capital}, ${question.country.subregion}, ${question.country.region}.`
  }

  return 'Locked in.'
}

function makeFlagQuestion(rng: RandomSource, mode: GameMode): ChoiceQuestion {
  const country = sample(COUNTRIES, rng)

  return {
    id: `flag:${country.iso3}:${Math.floor(rng() * 100000)}`,
    kind: 'flag',
    mode,
    prompt: `Which country uses this flag?`,
    eyebrow: country.flag,
    answer: country.name,
    options: makeCountryNameOptions(country, rng),
    country,
  }
}

function makeCapitalQuestion(rng: RandomSource, mode: GameMode): ChoiceQuestion {
  const country = sample(COUNTRIES, rng)

  return {
    id: `capital:${country.iso3}:${Math.floor(rng() * 100000)}`,
    kind: 'capital',
    mode,
    prompt: `What is the capital of ${country.name}?`,
    eyebrow: `${country.flag} ${country.region}`,
    answer: country.capital,
    options: makeCapitalOptions(country, rng),
    country,
  }
}

function makeCapitalReverseQuestion(
  rng: RandomSource,
  mode: GameMode,
): ChoiceQuestion {
  const country = sample(COUNTRIES, rng)

  return {
    id: `capitalReverse:${country.iso3}:${Math.floor(rng() * 100000)}`,
    kind: 'capitalReverse',
    mode,
    prompt: `${country.capital} is the capital of which country?`,
    eyebrow: 'Reverse capital',
    answer: country.name,
    options: makeCountryNameOptions(country, rng),
    country,
  }
}

function makeMapTapQuestion(rng: RandomSource, mode: GameMode): MapQuestion {
  const country = sample(MAPPED_COUNTRIES, rng)

  return {
    id: `mapTap:${country.iso3}:${Math.floor(rng() * 100000)}`,
    kind: 'mapTap',
    mode,
    prompt: `Tap ${country.name} on the map.`,
    eyebrow: `${country.flag} ${country.subregion}`,
    answer: country.numeric,
    country,
  }
}

function makeOutlineQuestion(rng: RandomSource, mode: GameMode): ChoiceQuestion {
  const country = sample(MAPPED_COUNTRIES, rng)

  return {
    id: `outline:${country.iso3}:${Math.floor(rng() * 100000)}`,
    kind: 'outline',
    mode,
    prompt: `Which country has this outline?`,
    eyebrow: `${country.region} outline`,
    answer: country.name,
    options: makeCountryNameOptions(country, rng),
    country,
  }
}

function makeNeighborQuestion(rng: RandomSource, mode: GameMode): ChoiceQuestion {
  const country = sample(COUNTRIES_WITH_BORDERS, rng)
  const borders = country.borders
    .map((border) => COUNTRIES_BY_ISO3.get(border))
    .filter((border): border is Country => Boolean(border))
  const answerCountry = sample(borders, rng)
  const distractors = COUNTRIES.filter(
    (candidate) =>
      candidate.iso3 !== answerCountry.iso3 &&
      candidate.iso3 !== country.iso3 &&
      !country.borders.includes(candidate.iso3),
  )

  return {
    id: `neighbor:${country.iso3}:${Math.floor(rng() * 100000)}`,
    kind: 'neighbor',
    mode,
    prompt: `Which country borders ${country.name}?`,
    eyebrow: `${country.flag} Neighbor sense`,
    answer: answerCountry.name,
    options: shuffle(
      [
        answerCountry.name,
        ...shuffle(preferSameRegion(distractors, country.region), rng)
          .slice(0, 3)
          .map((candidate) => candidate.name),
      ],
      rng,
    ),
    country,
  }
}

function makeRegionQuestion(rng: RandomSource, mode: GameMode): ChoiceQuestion {
  const country = sample(COUNTRIES, rng)

  return {
    id: `region:${country.iso3}:${Math.floor(rng() * 100000)}`,
    kind: 'region',
    mode,
    prompt: `${country.name} belongs to which broad region?`,
    eyebrow: `${country.flag} World sense`,
    answer: country.region,
    options: shuffle(
      [country.region, ...REGIONS.filter((region) => region !== country.region)]
        .slice(0, 4),
      rng,
    ),
    country,
  }
}

function makePhysicalCategoryQuestion(
  rng: RandomSource,
  mode: GameMode,
): ChoiceQuestion {
  const physicalFeature = sample(PHYSICAL_FEATURES, rng)
  const answer = CATEGORY_LABELS[physicalFeature.category]
  const categoryOptions = Object.values(CATEGORY_LABELS).filter(
    (category) => category !== answer,
  )

  return {
    id: `physicalCategory:${physicalFeature.id}:${Math.floor(rng() * 100000)}`,
    kind: 'physicalCategory',
    mode,
    prompt: `${physicalFeature.name} is what kind of feature?`,
    eyebrow: 'Earth shape',
    answer,
    options: shuffle([answer, ...shuffle(categoryOptions, rng).slice(0, 3)], rng),
    feature: physicalFeature,
  }
}

function makePhysicalRegionQuestion(
  rng: RandomSource,
  mode: GameMode,
): ChoiceQuestion {
  const physicalFeature = sample(PHYSICAL_FEATURES, rng)

  return {
    id: `physicalRegion:${physicalFeature.id}:${Math.floor(rng() * 100000)}`,
    kind: 'physicalRegion',
    mode,
    prompt: `Where should you place ${physicalFeature.name}?`,
    eyebrow: CATEGORY_LABELS[physicalFeature.category],
    answer: physicalFeature.region,
    options: makePhysicalRegionOptions(physicalFeature, rng),
    feature: physicalFeature,
  }
}

function makeCountryNameOptions(country: Country, rng: RandomSource): string[] {
  return shuffle(
    [
      country.name,
      ...shuffle(
        preferSameRegion(
          COUNTRIES.filter((candidate) => candidate.iso3 !== country.iso3),
          country.region,
        ),
        rng,
      )
        .slice(0, 3)
        .map((candidate) => candidate.name),
    ],
    rng,
  )
}

function makeCapitalOptions(country: Country, rng: RandomSource): string[] {
  return shuffle(
    [
      country.capital,
      ...shuffle(
        preferSameRegion(
          COUNTRIES.filter((candidate) => candidate.iso3 !== country.iso3),
          country.region,
        ),
        rng,
      )
        .slice(0, 3)
        .map((candidate) => candidate.capital),
    ],
    rng,
  )
}

function makePhysicalRegionOptions(
  physicalFeature: PhysicalFeature,
  rng: RandomSource,
): string[] {
  const regions = PHYSICAL_FEATURES.filter(
    (featureItem) => featureItem.region !== physicalFeature.region,
  ).map((featureItem) => featureItem.region)

  return shuffle(
    [physicalFeature.region, ...Array.from(new Set(shuffle(regions, rng))).slice(0, 3)],
    rng,
  )
}

function preferSameRegion(countries: Country[], region: string): Country[] {
  return [
    ...countries.filter((country) => country.region === region),
    ...countries.filter((country) => country.region !== region),
  ]
}

function sample<T>(items: T[], rng: RandomSource): T {
  return items[Math.floor(rng() * items.length)]
}
