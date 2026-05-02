import type { Feature, FeatureCollection, Geometry } from 'geojson'
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import rawCountries from 'world-countries'
import worldAtlas from 'world-atlas/countries-110m.json'

type RawCountry = (typeof rawCountries)[number]

export type Country = {
  id: string
  iso2: string
  iso3: string
  numeric: string
  name: string
  officialName: string
  flag: string
  capital: string
  region: string
  subregion: string
  latlng: [number, number]
  area: number
  borders: string[]
  hasMap: boolean
}

export type CountryFeatureProperties = {
  name?: string
}

export type CountryFeature = Feature<Geometry, CountryFeatureProperties> & {
  id?: string | number
}

const topology = worldAtlas as unknown as Topology<{
  countries: GeometryCollection<CountryFeatureProperties>
}>

const countryCollection = feature(
  topology,
  topology.objects.countries,
) as FeatureCollection<Geometry, CountryFeatureProperties>

export const COUNTRY_FEATURES = countryCollection.features as CountryFeature[]

const featureNumerics = new Set(
  COUNTRY_FEATURES.map((countryFeature) =>
    String(countryFeature.id).padStart(3, '0'),
  ),
)

const compareByName = (left: Country, right: Country) =>
  left.name.localeCompare(right.name)

const toCountry = (country: RawCountry): Country | null => {
  if (
    !country.independent ||
    !country.capital?.length ||
    !country.ccn3 ||
    !country.cca2 ||
    !country.cca3 ||
    !country.latlng?.length
  ) {
    return null
  }

  const numeric = country.ccn3.padStart(3, '0')

  return {
    id: country.cca3,
    iso2: country.cca2,
    iso3: country.cca3,
    numeric,
    name: country.name.common,
    officialName: country.name.official,
    flag: country.flag,
    capital: country.capital[0],
    region: country.region,
    subregion: country.subregion || country.region,
    latlng: [country.latlng[0], country.latlng[1]],
    area: country.area,
    borders: country.borders ?? [],
    hasMap: featureNumerics.has(numeric),
  }
}

export const COUNTRIES = rawCountries
  .map(toCountry)
  .filter((country): country is Country => country !== null)
  .sort(compareByName)

export const COUNTRIES_BY_ISO3 = new Map(
  COUNTRIES.map((country) => [country.iso3, country]),
)

export const COUNTRIES_BY_NUMERIC = new Map(
  COUNTRIES.map((country) => [country.numeric, country]),
)

export const MAPPED_COUNTRIES = COUNTRIES.filter((country) => country.hasMap)

export const COUNTRIES_WITH_BORDERS = COUNTRIES.filter((country) =>
  country.borders.some((border) => COUNTRIES_BY_ISO3.has(border)),
)

export const REGIONS = Array.from(
  new Set(COUNTRIES.map((country) => country.region)),
).sort()
