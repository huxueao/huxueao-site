export const FACTIONS = {
  gold: { name: 'The Gilded Company', short: 'Gold', mark: '◆', motto: 'Everything has a price.', description: 'Sell ore, improve your tools, and turn a small advantage into a formidable expedition.', passive: 'Your one sale each turn earns 1 extra energy.' },
  gem: { name: 'The Prism Society', short: 'Gem', mark: '◇', motto: 'Look beneath the obvious.', description: 'Find different gemstones, see what lies ahead, and collect a quieter kind of victory.', passive: 'At scoring, each distinct gemstone name in your cargo adds 1 point.' },
  fossil: { name: 'The Ossuary', short: 'Fossil', mark: '✳', motto: 'Nothing stays buried.', description: 'Assemble a skeleton for points, or give up your discoveries to bring a giant back to life.', passive: 'The first fossil you collect each turn draws a strategy card.' },
};

export const MINERALS = {
  copper: { name: 'Copper', kind: 'ore', hardness: 1, value: 1, sell: 1, glyph: '▧' },
  iron: { name: 'Iron', kind: 'ore', hardness: 2, value: 2, sell: 1, glyph: '▥' },
  silver: { name: 'Silver', kind: 'ore', hardness: 2, value: 2, sell: 1, glyph: '◈' },
  gold: { name: 'Gold', kind: 'ore', hardness: 3, value: 3, sell: 2, glyph: '◆' },
  quartz: { name: 'Quartz', kind: 'gem', hardness: 2, value: 2, sell: 1, glyph: '◇' },
  ruby: { name: 'Ruby', kind: 'gem', hardness: 3, value: 4, sell: 1, glyph: '❖' },
  sapphire: { name: 'Sapphire', kind: 'gem', hardness: 2, value: 3, sell: 1, glyph: '⬡' },
  amber: { name: 'Amber', kind: 'gem', hardness: 1, value: 1, sell: 1, glyph: '◊' },
  rib: { name: 'Rib', kind: 'fossil', hardness: 2, value: 2, sell: 1, glyph: '☽' },
  limb: { name: 'Limb', kind: 'fossil', hardness: 2, value: 2, sell: 1, glyph: '╫' },
  skull: { name: 'Skull', kind: 'fossil', hardness: 3, value: 3, sell: 1, glyph: '☷' },
  spring: { name: 'Underground spring', kind: 'event', text: 'The active explorer restores 2 health.', glyph: '≈' },
  gas: { name: 'Volatile seam', kind: 'event', text: 'The active explorer loses 1 health and gains 2 energy this turn.', glyph: '≋' },
  collapse: { name: 'Cave-in', kind: 'event', text: 'The active explorer loses 2 health.', glyph: '▨' },
};

// Eight common pairs and seven faction pairs = a 30-card strategy deck.
export const CARDS = {
  worker: { name: 'Field assistant', cost: 2, type: 'crew', attack: 1, health: 3, text: 'A steady hand. Can attack, block, or assist an excavation.' },
  guard: { name: 'Night watch', cost: 3, type: 'crew', attack: 2, health: 4, text: 'Keeps the camp standing.' },
  scout: { name: 'Scout', cost: 1, type: 'crew', attack: 1, health: 1, text: 'A small investment in an uncertain future.' },
  dig: { name: 'Careful excavation', cost: 2, type: 'action', effect: 'dig', amount: 3, target: 'field', text: 'Add 3 excavation progress to a deposit.' },
  blast: { name: 'Controlled blast', cost: 2, type: 'action', effect: 'blast', amount: 4, target: 'nonfossil', text: 'Add 4 progress to an ore or gem deposit. Lose 2 health.' },
  repair: { name: 'First aid', cost: 2, type: 'action', effect: 'heal', amount: 4, text: 'Restore 4 camp health, up to 20.' },
  bolt: { name: 'Stone bolt', cost: 3, type: 'action', effect: 'damage', amount: 4, target: 'enemy', text: 'Deal 4 damage to an enemy crew member.' },
  research: { name: 'Field notes', cost: 2, type: 'action', effect: 'draw', amount: 2, text: 'Draw 2 strategy cards.' },
  foreman: { name: 'Foreman', cost: 4, type: 'crew', attack: 3, health: 5, faction: 'gold', text: 'An experienced pair of hands.' },
  mule: { name: 'Pack mule', cost: 2, type: 'crew', attack: 0, health: 4, dig: 2, faction: 'gold', text: 'Assist an excavation for 2 progress instead of 1.' },
  hire: { name: 'Hired muscle', cost: 5, type: 'crew', attack: 5, health: 4, faction: 'gold', text: 'Paid to settle an argument.' },
  credit: { name: 'Advance payment', cost: 0, type: 'action', effect: 'energy', amount: 2, faction: 'gold', text: 'Gain 2 energy this turn. Lose 1 health.' },
  smelt: { name: 'Molten offering', cost: 2, type: 'action', effect: 'throw', target: 'ore', amount: 3, faction: 'gold', text: 'Consume an ore from your cargo. Deal 3 damage to the enemy camp.' },
  tools: { name: 'Tempered steel', cost: 2, type: 'action', effect: 'upgrade', faction: 'gold', text: 'Improve your pickaxe by 1, up to level 3. Does not refresh it.' },
  dividend: { name: 'Assay certificate', cost: 2, type: 'action', effect: 'value', target: 'ore', amount: 2, faction: 'gold', text: 'Add 2 points to one ore in your cargo. Each ore can be certified once.' },
  lens: { name: 'Lens keeper', cost: 2, type: 'crew', attack: 1, health: 3, digKind: 'gem', faction: 'gem', text: 'Assist for 2 progress on gems, or 1 on anything else.' },
  warden: { name: 'Glass warden', cost: 4, type: 'crew', attack: 2, health: 6, faction: 'gem', text: 'A patient guardian.' },
  shard: { name: 'Shard dancer', cost: 3, type: 'crew', attack: 3, health: 2, faction: 'gem', text: 'Beautiful, and easily broken.' },
  survey: { name: 'Reading the strata', cost: 1, type: 'action', effect: 'survey', faction: 'gem', text: 'Privately inspect the next 3 mine cards. Choose which will be revealed next.' },
  polish: { name: 'A finer cut', cost: 2, type: 'action', effect: 'value', target: 'gem', amount: 2, faction: 'gem', text: 'Add 2 points to a gem in your cargo. Each gem can be polished once.' },
  resonance: { name: 'Resonance', cost: 2, type: 'action', effect: 'resonate', target: 'field', faction: 'gem', text: 'Add 2 progress; add 4 instead if the deposit is a gem.' },
  refraction: { name: 'Refraction', cost: 2, type: 'action', effect: 'damage', amount: 3, target: 'enemy', faction: 'gem', text: 'Deal 3 damage to an enemy crew member. Draw a card.' },
  curator: { name: 'Bone keeper', cost: 2, type: 'crew', attack: 1, health: 3, digKind: 'fossil', faction: 'fossil', text: 'Assist for 2 progress on fossils, or 1 on anything else.' },
  hound: { name: 'Relic hound', cost: 3, type: 'crew', attack: 3, health: 3, faction: 'fossil', text: 'Follows a scent older than memory.' },
  archivist: { name: 'Archivist', cost: 4, type: 'crew', attack: 2, health: 5, faction: 'fossil', text: 'Remembers what the earth forgets.' },
  brush: { name: 'Soft brush', cost: 1, type: 'action', effect: 'brush', amount: 3, target: 'fossilfield', faction: 'fossil', text: 'Add 3 progress to a fossil deposit.' },
  skeleton: { name: 'The complete specimen', cost: 3, type: 'action', effect: 'skeleton', faction: 'fossil', text: 'Consume a Rib, a Limb and a Skull. Create a 12-point exhibit.' },
  revive: { name: 'Something stirs', cost: 5, type: 'action', effect: 'revive', faction: 'fossil', text: 'Consume a Rib, a Limb and a Skull. Summon a 6/8 Ancient. It cannot act this turn.' },
  preserve: { name: 'Preservation', cost: 2, type: 'action', effect: 'value', target: 'fossil', amount: 2, faction: 'fossil', text: 'Add 2 points to a fossil in your cargo. Each fossil can be preserved once.' },
  ancient: { name: 'The Ancient', cost: 0, type: 'crew', attack: 6, health: 8, token: true, text: 'The past has unfinished business.' },
};

const common = ['worker','guard','scout','dig','blast','repair','bolt','research'];
export function strategyDeck(faction) {
  return [...common, ...Object.keys(CARDS).filter(id => CARDS[id].faction === faction)].flatMap(id => [id,id]);
}
export const MINE_RECIPES = {
  gold: ['copper','copper','iron','iron','silver','silver','gold','gold','quartz','amber','rib','limb','spring','gas','collapse'],
  gem: ['copper','copper','iron','silver','quartz','quartz','ruby','ruby','sapphire','sapphire','amber','amber','spring','gas','collapse'],
  fossil: ['copper','copper','iron','silver','rib','rib','limb','limb','skull','skull','quartz','amber','spring','gas','collapse'],
};
