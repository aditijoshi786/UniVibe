// Auto-tagging using Transformers.js (Hugging Face)
// Uses CLIP zero-shot image classification — asks "does this image match X?"
// No CDN dependency after first load, runs via WebAssembly in-browser
import { pipeline, env, type ZeroShotImageClassificationPipeline } from '@huggingface/transformers'

// Allow model download from Hugging Face Hub (cached in browser IndexedDB after first use)
env.allowLocalModels = false
env.useBrowserCache  = true

// Candidate tags scored against every uploaded image via CLIP zero-shot classification.
// Organised by college-event category so the search page is actually useful.
const CANDIDATE_TAGS = [
  // ── Tech / coding events ──────────────────────────────────────────
  'coding workshop', 'hackathon', 'technical seminar', 'programming competition',
  'robotics', 'electronics project', 'computer lab', 'tech presentation',
  'software demo', 'project exhibition',

  // ── Cultural / arts events ────────────────────────────────────────
  'cultural festival', 'dance performance', 'singing performance', 'drama theatre',
  'art exhibition', 'fashion show', 'cultural ceremony', 'traditional costume',
  'music band', 'street play',

  // ── Sports & fitness ──────────────────────────────────────────────
  'cricket match', 'football match', 'basketball game', 'athletics track',
  'outdoor sports', 'sports trophy ceremony', 'gym workout', 'yoga session',
  'swimming pool', 'badminton court',

  // ── Club activities ───────────────────────────────────────────────
  'club meeting', 'club recruitment stall', 'volunteering activity',
  'social service', 'community event', 'club photoshoot',
  'debate competition', 'quiz competition', 'business pitch',

  // ── Campus life ───────────────────────────────────────────────────
  'college campus', 'classroom lecture', 'college auditorium',
  'college canteen', 'college corridor', 'library', 'college gate',
  'college garden', 'hostel',

  // ── Group moments ─────────────────────────────────────────────────
  'group selfie', 'group photo outdoors', 'team celebration',
  'award ceremony', 'graduation ceremony', 'farewell party',
  'birthday celebration', 'seniors juniors',

  // ── Trips & travel ───────────────────────────────────────────────
  'college trip', 'industrial visit', 'trekking hiking',
  'beach trip', 'hill station', 'historical monument',
  'temple visit', 'tourist spot', 'road trip',

  // ── Talks & seminars ─────────────────────────────────────────────
  'guest lecture', 'panel discussion', 'conference presentation',
  'whiteboard explanation', 'audience listening', 'mic speech',

  // ── Food & informal ───────────────────────────────────────────────
  'food stall', 'street food', 'restaurant outing',
  'bonfire night', 'night event', 'outdoor gathering',

  // ── Nature / outdoors ────────────────────────────────────────────
  'mountains', 'beach', 'forest', 'lake', 'sunset', 'nature',
]

// Maps every candidate phrase → clean short tag stored in DB & used in search
const LABEL_TO_TAG: Record<string, string> = {
  // Tech
  'coding workshop': 'workshop', 'hackathon': 'hackathon',
  'technical seminar': 'seminar', 'programming competition': 'competition',
  'robotics': 'robotics', 'electronics project': 'electronics',
  'computer lab': 'technology', 'tech presentation': 'presentation',
  'software demo': 'technology', 'project exhibition': 'exhibition',
  // Cultural
  'cultural festival': 'cultural-fest', 'dance performance': 'dance',
  'singing performance': 'music', 'drama theatre': 'theatre',
  'art exhibition': 'art', 'fashion show': 'fashion',
  'cultural ceremony': 'cultural-fest', 'traditional costume': 'cultural-fest',
  'music band': 'music', 'street play': 'theatre',
  // Sports
  'cricket match': 'sports', 'football match': 'sports',
  'basketball game': 'sports', 'athletics track': 'sports',
  'outdoor sports': 'sports', 'sports trophy ceremony': 'award-ceremony',
  'gym workout': 'sports', 'yoga session': 'sports',
  'swimming pool': 'sports', 'badminton court': 'sports',
  // Club activities
  'club meeting': 'club-activity', 'club recruitment stall': 'club-activity',
  'volunteering activity': 'volunteering', 'social service': 'volunteering',
  'community event': 'club-activity', 'club photoshoot': 'photoshoot',
  'debate competition': 'debate', 'quiz competition': 'quiz',
  'business pitch': 'competition',
  // Campus
  'college campus': 'campus', 'classroom lecture': 'lecture',
  'college auditorium': 'auditorium', 'college canteen': 'campus',
  'college corridor': 'campus', 'library': 'campus',
  'college gate': 'campus', 'college garden': 'campus', 'hostel': 'campus',
  // Group moments
  'group selfie': 'group-photo', 'group photo outdoors': 'group-photo',
  'team celebration': 'celebration', 'award ceremony': 'award-ceremony',
  'graduation ceremony': 'graduation', 'farewell party': 'farewell',
  'birthday celebration': 'celebration', 'seniors juniors': 'group-photo',
  // Trips
  'college trip': 'trip', 'industrial visit': 'trip',
  'trekking hiking': 'trekking', 'beach trip': 'beach',
  'hill station': 'trip', 'historical monument': 'trip',
  'temple visit': 'trip', 'tourist spot': 'trip', 'road trip': 'trip',
  // Talks
  'guest lecture': 'seminar', 'panel discussion': 'seminar',
  'conference presentation': 'seminar', 'whiteboard explanation': 'lecture',
  'audience listening': 'seminar', 'mic speech': 'speech',
  // Food & informal
  'food stall': 'food', 'street food': 'food',
  'restaurant outing': 'outing', 'bonfire night': 'celebration',
  'night event': 'celebration', 'outdoor gathering': 'group-photo',
  // Nature
  'mountains': 'mountains', 'beach': 'beach', 'forest': 'nature',
  'lake': 'nature', 'sunset': 'sunset', 'nature': 'nature',
}

let classifier: ZeroShotImageClassificationPipeline | null = null
let classifierLoading: Promise<ZeroShotImageClassificationPipeline> | null = null

async function getClassifier(): Promise<ZeroShotImageClassificationPipeline> {
  if (classifier) return classifier
  if (classifierLoading) return classifierLoading
  classifierLoading = (async () => {
    console.log('[AutoTagger] Loading CLIP model from Hugging Face…')
    const pipe = await pipeline('zero-shot-image-classification', 'Xenova/clip-vit-base-patch32')
    classifier = pipe
    console.log('[AutoTagger] CLIP model ready')
    return pipe
  })()
  return classifierLoading
}

export type AutoTagResult = {
  tags:    string[]
  caption: string
}

// ── Caption builder ───────────────────────────────────────────────────────────
// Constructs a natural-language description from CLIP's top-scoring labels
// plus the event/club context available at upload time.

const TAG_STARTERS: Record<string, string> = {
  'group-photo':    'A group photo',
  'dance':          'A dance performance',
  'hackathon':      'Hackathon in action',
  'workshop':       'A workshop session',
  'seminar':        'A seminar',
  'lecture':        'A classroom lecture',
  'sports':         'A sports moment',
  'trip':           'A trip photo',
  'trekking':       'Trekking adventure',
  'cultural-fest':  'A cultural festival moment',
  'music':          'A musical performance',
  'theatre':        'A theatre performance',
  'art':            'An art exhibition piece',
  'award-ceremony': 'An award ceremony',
  'celebration':    'A celebration',
  'campus':         'A campus shot',
  'food':           'Food at the event',
  'nature':         'A nature shot',
  'beach':          'At the beach',
  'mountains':      'In the mountains',
  'sunset':         'A beautiful sunset',
}

function buildCaption(
  topLabels: { label: string; score: number }[],
  eventName: string,
  clubName:  string,
): string {
  const topTags = topLabels
    .filter(r => r.score > 0.03)
    .slice(0, 3)
    .map(r => LABEL_TO_TAG[r.label])
    .filter(Boolean) as string[]

  if (topTags.length === 0) return eventName ? `Photo from ${eventName}` : ''

  const starter = TAG_STARTERS[topTags[0]] ?? `A photo featuring ${topTags[0]}`
  const extras  = topTags.slice(1).join(' and ')
  let caption   = extras ? `${starter} with ${extras}` : starter

  if (eventName) caption += ` — ${eventName}`
  if (clubName)  caption += ` (${clubName})`

  return caption
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function autoTagImage(
  file:      File,
  eventName = '',
  clubName  = '',
): Promise<AutoTagResult> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') {
    return { tags: [], caption: '' }
  }

  try {
    const pipe = await getClassifier()
    if (!pipe) return { tags: [], caption: '' }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload  = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

    const results   = await pipe(dataUrl, CANDIDATE_TAGS)
    const resultArr = (Array.isArray(results) ? results : [results]) as { label: string; score: number }[]

    console.log('[AutoTagger] CLIP scores:', resultArr.slice(0, 6).map(r => `${r.label}: ${(r.score * 100).toFixed(1)}%`))

    // CLIP softmax distributes probability across all 58 candidates, so
    // individual scores are naturally low (~1-10%). Use the top-N approach
    // rather than a high fixed threshold to avoid cutting off correct tags.
    const tags = new Set<string>()
    for (const r of resultArr.slice(0, 10)) {   // consider only top-10 results
      if (r.score > 0.03) {                      // min bar: must beat ~random
        const tag = LABEL_TO_TAG[r.label]
        if (tag) tags.add(tag)
      }
    }

    const tagList = Array.from(tags).slice(0, 6)
    const caption = buildCaption(resultArr, eventName, clubName)

    console.log('[AutoTagger] Tags:', tagList, '| Caption:', caption)
    return { tags: tagList, caption }

  } catch (err) {
    console.error('[AutoTagger] Failed:', err)
    return { tags: [], caption: '' }
  }
}
