import { geoEqualEarth, geoPath } from 'd3-geo'
import { useMemo } from 'react'
import {
  COUNTRIES_BY_NUMERIC,
  COUNTRY_FEATURES,
  type Country,
} from '../data/countries'

type WorldMapProps = {
  answerNumeric?: string
  disabled?: boolean
  pickedNumeric?: string | null
  reveal?: boolean
  onPick?: (numeric: string) => void
}

const WORLD_WIDTH = 720
const WORLD_HEIGHT = 390

export function WorldMap({
  answerNumeric,
  disabled = false,
  pickedNumeric,
  reveal = false,
  onPick,
}: WorldMapProps) {
  const path = useMemo(() => {
    const projection = geoEqualEarth().fitExtent(
      [
        [10, 12],
        [WORLD_WIDTH - 10, WORLD_HEIGHT - 12],
      ],
      { type: 'FeatureCollection', features: COUNTRY_FEATURES },
    )

    return geoPath(projection)
  }, [])

  return (
    <svg
      aria-label="Interactive world map"
      className="world-map"
      role="img"
      viewBox={`0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`}
    >
      <rect className="world-map__water" height={WORLD_HEIGHT} width={WORLD_WIDTH} />
      {COUNTRY_FEATURES.map((countryFeature) => {
        const numeric = String(countryFeature.id).padStart(3, '0')
        const country = COUNTRIES_BY_NUMERIC.get(numeric)

        if (!country) {
          return null
        }

        const isPicked = pickedNumeric === numeric
        const isAnswer = answerNumeric === numeric
        const showAnswer = reveal && isAnswer
        const className = [
          'world-map__country',
          isPicked ? 'is-picked' : '',
          showAnswer ? 'is-answer' : '',
          disabled ? 'is-disabled' : '',
        ]
          .filter(Boolean)
          .join(' ')

        return (
          <path
            aria-label={country.name}
            className={className}
            d={path(countryFeature) ?? undefined}
            key={numeric}
            onClick={() => {
              if (!disabled) {
                onPick?.(numeric)
              }
            }}
            role="button"
            tabIndex={disabled ? -1 : 0}
            onKeyDown={(event) => {
              if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault()
                onPick?.(numeric)
              }
            }}
          />
        )
      })}
    </svg>
  )
}

type CountryOutlineProps = {
  country: Country
}

export function CountryOutline({ country }: CountryOutlineProps) {
  const outlinePath = useMemo(() => {
    const countryFeature = COUNTRY_FEATURES.find(
      (featureItem) => String(featureItem.id).padStart(3, '0') === country.numeric,
    )

    if (!countryFeature) {
      return null
    }

    const projection = geoEqualEarth().fitExtent(
      [
        [14, 14],
        [246, 156],
      ],
      countryFeature,
    )
    const path = geoPath(projection)

    return path(countryFeature)
  }, [country.numeric])

  return (
    <svg
      aria-label={`Outline of ${country.name}`}
      className="country-outline"
      role="img"
      viewBox="0 0 260 170"
    >
      <rect className="country-outline__backdrop" height="170" width="260" />
      {outlinePath ? <path className="country-outline__shape" d={outlinePath} /> : null}
    </svg>
  )
}
