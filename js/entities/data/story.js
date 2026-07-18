/**
 * data/story.js
 * Linear narrative chapters triggered by in-game events.
 *
 * triggerCondition types:
 *   { type: 'start' }                                      — fires on first game load
 *   { type: 'quest_completed', questId }                  — fires when a quest finishes
 *   { type: 'building_level', buildingId, level }         — fires when a building reaches level
 *   { type: 'player_level',   level }                     — fires when commander reaches level
 */
export const STORY_CHAPTERS = [
  {
    id: 'ch_beginning',
    title: 'The Abandoned Outpost',
    icon: '🏙️',
    arc: 'Prologue',
    arcColor: '#9b59b6',
    triggerCondition: { type: 'start' },
    dialogue: [
      { speaker: 'Narrator', text: 'A derelict outpost slumps on a forgotten rise, long-abandoned and choked with rust and weeds. Crows circle in the grey sky above its cracked concrete walls.' },
      { speaker: 'Scout', text: 'Commander, the walls still hold. The foundations are solid — poured in the old world, before the collapse. With enough salvage and resolve, this place could become a stronghold once more.' },
      { speaker: 'Commander', text: 'Then we start today. Shore up the foundations and send word: our people hold this ground now. Our story begins at this very slab.' },
    ],
    rewards: { money: 100, wood: 50 },
    unlocksQuestIds: ['first_building'],
  },
  {
    id: 'ch_first_harvest',
    title: 'First Harvest',
    icon: '🌾',
    arc: 'Prologue',
    arcColor: '#9b59b6',
    triggerCondition: { type: 'quest_completed', questId: 'first_building' },
    dialogue: [
      { speaker: 'Quartermaster', text: 'The first structure is up, Commander. But an outpost without food is just an elaborate tomb.' },
      { speaker: 'Commander', text: 'Put the growers to work clearing the southern fields. We need rations and we need them fast.' },
      { speaker: 'Quartermaster', text: 'Wise call. Wood and scrip will follow where there is will, but food is what carries people through a long lockdown. They look to you.' },
    ],
    rewards: { food: 150, money: 200 },
    unlocksQuestIds: ['recruit_army'],
  },
  {
    id: 'ch_enemy_advances',
    title: 'The Enemy Advances',
    icon: '⚔️',
    arc: 'Act I — The First War',
    arcColor: '#e74c3c',
    triggerCondition: { type: 'building_level', buildingId: 'barracks', level: 1 },
    dialogue: [
      { speaker: 'Scout', text: 'Commander! Reports from the eastern ridge — scavenger war camps have been spotted moving toward our perimeter. They grow bolder by the day.' },
      { speaker: 'Commander', text: 'Then we shall not wait for them to reach our walls. Drill the fighters. I want every able body ready to march within the week.' },
      { speaker: 'Warlord', text: 'Give me people and I will give you victory, Commander. The scavengers will learn to fear this crew — we will carve our name into their memory.' },
    ],
    rewards: { money: 500, food: 100 },
    unlocksQuestIds: ['first_victory'],
  },
  {
    id: 'ch_arcane_awakening',
    title: 'Power Grid Online',
    icon: '📡',
    arc: 'Act I — The First War',
    arcColor: '#e74c3c',
    triggerCondition: { type: 'building_level', buildingId: 'workshop', level: 1 },
    dialogue: [
      { speaker: 'Engineer', text: 'Commander, the old power lines beneath this outpost are extraordinary — far more intact than anything I have found in my travels. The Comms Tower is drawing straight from the buried grid.' },
      { speaker: 'Commander', text: 'Can we harness it for our forces? Turn this raw power into something that wins battles?' },
      { speaker: 'Engineer', text: 'With the right research, absolutely. Combat drones, signal jamming, fuel synthesis — the possibilities are limitless. But it demands time, power, and sharp minds willing to push into the unknown.' },
    ],
    rewards: { iron: 100, money: 300 },
    unlocksQuestIds: ['scholar'],
  },
  {
    id: 'ch_scholars_path',
    title: "The Engineer's Path",
    icon: '🔬',
    arc: 'Act II — The Age of Discovery',
    arcColor: '#2980b9',
    triggerCondition: { type: 'quest_completed', questId: 'scholar' },
    dialogue: [
      { speaker: 'Engineer', text: 'The breakthroughs we have made these past months surpass anything I had hoped for when I first walked through your gate, Commander.' },
      { speaker: 'Commander', text: 'And yet I feel we have only scratched the surface. There is old-world tech buried here that we have barely begun to understand.' },
      { speaker: 'Engineer', text: 'You are correct. There are sealed archives, lost technologies, and tactical data yet to be recovered. The true potential of this outpost — of your settlement — has barely woken up.' },
    ],
    rewards: { iron: 200, money: 1000, xp: 500 },
    unlocksQuestIds: ['rising_power'],
  },
];
