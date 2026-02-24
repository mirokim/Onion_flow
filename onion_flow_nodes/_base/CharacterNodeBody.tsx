import { useMemo } from 'react'
import { useWikiStore } from '@/stores/wikiStore'
import { useWorldStore } from '@/stores/worldStore'

interface CharacterNodeBodyProps {
  data: Record<string, any>
  nodeId: string
}

const ARCHETYPE_LABELS: Record<string, { label: string; color: string }> = {
  protagonist: { label: '주인공', color: 'bg-blue-500/20 text-blue-400' },
  antagonist: { label: '적대자', color: 'bg-red-500/20 text-red-400' },
  helper: { label: '조력자', color: 'bg-green-500/20 text-green-400' },
  mentor: { label: '멘토', color: 'bg-cyan-500/20 text-cyan-400' },
  betrayer: { label: '배신자', color: 'bg-orange-500/20 text-orange-400' },
  guardian: { label: '수호자', color: 'bg-emerald-500/20 text-emerald-400' },
  trickster: { label: '트릭스터', color: 'bg-amber-500/20 text-amber-400' },
  shapeshifter: { label: '변신자', color: 'bg-purple-500/20 text-purple-400' },
  herald: { label: '전령', color: 'bg-sky-500/20 text-sky-400' },
  shadow: { label: '그림자', color: 'bg-gray-500/20 text-gray-400' },
  threshold_guardian: { label: '문턱의 수호자', color: 'bg-indigo-500/20 text-indigo-400' },
  ally: { label: '동맹', color: 'bg-teal-500/20 text-teal-400' },
  other: { label: '기타', color: 'bg-slate-500/20 text-slate-400' },
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  alive: { label: '생존', color: 'bg-green-500/20 text-green-400' },
  dead: { label: '사망', color: 'bg-red-500/20 text-red-400' },
  missing: { label: '실종', color: 'bg-yellow-500/20 text-yellow-400' },
  unknown: { label: '불명', color: 'bg-gray-500/20 text-gray-400' },
}

export function CharacterNodeBody({ data, nodeId }: CharacterNodeBodyProps) {
  const allWikiEntries = useWikiStore(s => s.entries)
  const characters = useWorldStore(s => s.characters)

  // Find linked character from wiki
  const linkedCharacter = useMemo(() => {
    if (!data.wikiEntryId) return null
    const wikiEntry = allWikiEntries.find(e => e.id === data.wikiEntryId)
    if (!wikiEntry?.linkedEntityId) return null
    return characters.find(c => c.id === wikiEntry.linkedEntityId) || null
  }, [data.wikiEntryId, allWikiEntries, characters])

  if (!linkedCharacter) {
    return null
  }

  const archetype = linkedCharacter.archetype || 'other'
  const status = linkedCharacter.status || 'alive'
  const archetypeInfo = ARCHETYPE_LABELS[archetype] || ARCHETYPE_LABELS.other
  const statusInfo = STATUS_LABELS[status] || STATUS_LABELS.alive

  return (
    <div className="mt-1.5 space-y-1">
      {/* Image */}
      {linkedCharacter.imageUrl && (
        <img
          src={linkedCharacter.imageUrl}
          alt={linkedCharacter.name}
          className="w-full h-16 rounded object-cover border border-border"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      )}

      {/* Archetype + Status badges (read-only from wiki) */}
      <div className="flex items-center gap-1 flex-wrap">
        <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${archetypeInfo.color}`}>
          {archetypeInfo.label}
        </span>
        <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${statusInfo.color}`}>
          {statusInfo.label}
        </span>
      </div>

      {/* Job / Affiliation */}
      {(linkedCharacter.job || linkedCharacter.affiliation) && (
        <p className="text-[9px] text-text-muted truncate">
          {[linkedCharacter.job, linkedCharacter.affiliation].filter(Boolean).join(' · ')}
        </p>
      )}

      {/* Logline */}
      {linkedCharacter.logline && (
        <p className="text-[9px] text-text-muted leading-relaxed italic">
          {linkedCharacter.logline.length > 60
            ? linkedCharacter.logline.slice(0, 60) + '...'
            : linkedCharacter.logline}
        </p>
      )}
    </div>
  )
}
